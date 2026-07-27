import "dotenv/config";
import express from "express";
import cors from "cors";
import { timingSafeEqual } from "node:crypto";
import { Bot, InlineKeyboard, GrammyError, HttpError, webhookCallback } from "grammy";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import cron from "node-cron";

// ---------------------------------------------------------------------------
// Environment Variables
// ---------------------------------------------------------------------------

function getEnv(primaryKey: string, fallbackKey?: string): string {
  const val = (process.env[primaryKey] || (fallbackKey ? process.env[fallbackKey] : undefined))?.trim();
  if (!val) throw new Error(`Missing environment variable: ${primaryKey}${fallbackKey ? ` or ${fallbackKey}` : ""}`);
  return val;
}

function envInt(k: string, fb: number): number {
  const v = parseInt(process.env[k] ?? "", 10);
  return isFinite(v) ? v : fb;
}

const BOT_TOKEN   = getEnv("TELEGRAM_BOT_TOKEN", "BOT_TOKEN");
const SUPA_URL    = getEnv("SUPABASE_URL");
const SUPA_KEY    = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const WEBAPP_URL  = getEnv("WEBAPP_URL");
const CRON_SCHED  = process.env.CRON_SCHEDULE ?? "0 9 * * *";
const CRON_TZ     = process.env.CRON_TZ       ?? "Asia/Tashkent";
const DEFER_DAYS  = envInt("DEFER_DAYS", 3);
const RENDER_URL  = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || "";

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------

const db: SupabaseClient = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

interface UserRow {
  telegram_id: number;
  business_id: string;
  role: "owner" | "manager";
  full_name: string | null;
}

interface DueDebt {
  id: string;
  amount: number;
  paid_amount?: number;
  note: string | null;
  due_date: string;
  created_at?: string;
  business_id: string;
  customers: { name: string; phone: string | null };
}

// ---------------------------------------------------------------------------
// Database Helpers
// ---------------------------------------------------------------------------

async function getUser(telegramId: number): Promise<UserRow | null> {
  const { data, error } = await db
    .from("users")
    .select("telegram_id, business_id, role, full_name")
    .eq("telegram_id", telegramId)
    .maybeSingle();
    
  if (error) throw new Error(`[Supabase getUser] ${error.message}`);
  return data as UserRow | null;
}

async function registerOwner(telegramId: number, fullName: string): Promise<UserRow> {
  const { data: biz, error: bizErr } = await db
    .from("businesses")
    .insert({ name: fullName, phone: "" })
    .select("id")
    .single();
  if (bizErr) throw new Error(`[Supabase Biz] ${bizErr.message}`);

  const { data: user, error: userErr } = await db
    .from("users")
    .insert({ telegram_id: telegramId, business_id: biz.id, role: "owner", full_name: fullName })
    .select("telegram_id, business_id, role, full_name")
    .single();
  if (userErr) throw new Error(`[Supabase User] ${userErr.message}`);
  return user as UserRow;
}

async function fetchDueDebts(): Promise<DueDebt[]> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CRON_TZ }).format(new Date());

  const { data, error } = await db
    .from("debts")
    .select(`
      id, amount, paid_amount, note, due_date, created_at, business_id,
      customers!inner(name, phone)
    `)
    .eq("status", "pending")
    .lte("due_date", today);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DueDebt[];
}

async function markDebtPaid(debtId: string, businessId: string): Promise<boolean> {
  // To'liq yopish uchun statusni paid qilamiz va paid_amount ni amount ga tenglaymiz (agar ustun mavjud bo'lsa)
  const { data: debt } = await db.from("debts").select("amount").eq("id", debtId).single();
  if (!debt) return false;

  const { data } = await db
    .from("debts")
    .update({ status: "paid", paid_amount: debt.amount })
    .eq("id", debtId)
    .eq("business_id", businessId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  return !!data;
}

async function deferDebt(debtId: string, businessId: string, days: number): Promise<string | null> {
  const { data: cur } = await db
    .from("debts")
    .select("due_date")
    .eq("id", debtId)
    .eq("business_id", businessId)
    .eq("status", "pending")
    .maybeSingle();
  if (!cur) return null;

  const next = new Date(cur.due_date);
  next.setDate(next.getDate() + days);
  const nextStr = next.toISOString().slice(0, 10);

  const { data } = await db
    .from("debts")
    .update({ due_date: nextStr })
    .eq("id", debtId)
    .eq("business_id", businessId)
    .select("due_date")
    .maybeSingle();
  return data?.due_date ?? null;
}

async function getOwnerTelegramId(businessId: string): Promise<number | null> {
  const { data } = await db
    .from("users")
    .select("telegram_id")
    .eq("business_id", businessId)
    .eq("role", "owner")
    .maybeSingle();
  return data?.telegram_id ?? null;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt(n: number) { return new Intl.NumberFormat("uz-UZ").format(n); }
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("uz-UZ", { timeZone: CRON_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function displayName(from: { first_name?: string; last_name?: string; id: number }) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || `User ${from.id}`;
}

function debtMsg(debt: DueDebt): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CRON_TZ }).format(new Date());
  const overdue = debt.due_date < today;
  const remaining = (debt.amount || 0) - (debt.paid_amount || 0);
  return [
    overdue ? "⚠️ <b>Muddati o'tgan nasiya</b>" : "🔔 <b>Bugun to'lov muddati</b>",
    "",
    `👤 <b>Mijoz:</b> ${debt.customers.name}`,
    debt.customers.phone ? `📞 <b>Telefon:</b> ${debt.customers.phone}` : null,
    `💰 <b>Qoldiq summa:</b> ${fmt(remaining)} so'm`,
    debt.note ? `📝 <b>Izoh:</b> ${debt.note}` : null,
    `📅 <b>Muddat:</b> ${fmtDate(debt.due_date)}`,
  ].filter(Boolean).join("\n");
}

function debtKeyboard(debtId: string, phone: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (phone) kb.url("📞 Qo'ng'iroq", `tel:${phone.replace(/\D/g, "").replace(/^998/, "+998")}`).row();
  return kb.text("✅ Pulni oldim", `pay:${debtId}`).text(`⏳ ${DEFER_DAYS}k surish`, `defer:${debtId}`);
}

// Asosiy klaviatura (Reply Keyboard)
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "📊 Statistika va Hisobotlar" }, { text: "⚙️ Profilni ko'rish" }],
      [{ text: "📒 Nasiya Daftarini ochish (WebApp)" }]
    ],
    resize_keyboard: true,
  },
};

// ---------------------------------------------------------------------------
// Bot Handlers
// ---------------------------------------------------------------------------

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  if (!ctx.from) return;
  try {
    let user = await getUser(ctx.from.id);
    if (!user) {
      user = await registerOwner(ctx.from.id, displayName(ctx.from));
    }

    const roleText = user.role === "owner" ? "Egasi" : "Menejer";
    const name = user.full_name ?? "Foydalanuvchi";

    await ctx.reply(
      `Assalomu alaykum, <b>${name}</b>!\n\n` +
      `Siz <b>${roleText}</b> sifatida kirgansiz. Quyidagi menyu orqali statistikani ko'rishingiz, profilingizni boshqarishingiz yoki WebApp'ni ochishingiz mumkin.`,
      {
        parse_mode: "HTML",
        ...mainKeyboard,
      }
    );
  } catch (err: any) {
    console.error("[/start]", err);
    const errorMsg = err?.message || String(err);
    await ctx.reply(`⚠️ Xatolik yuz berdi:\n<code>${errorMsg}</code>`, { parse_mode: "HTML" });
  }
});

// WebApp ochish tugmasi uchun text handler
bot.hears("📒 Nasiya Daftarini ochish (WebApp)", async (ctx) => {
  await ctx.reply("Quyidagi tugma orqali ilovani oching:", {
    reply_markup: new InlineKeyboard().webApp("🚀 WebApp-ni ochish", WEBAPP_URL),
  });
});

// Profilni ko'rish handler
bot.hears("⚙️ Profilni ko'rish", async (ctx) => {
  if (!ctx.from) return;
  try {
    const user = await getUser(ctx.from.id);
    if (!user) {
      await ctx.reply("Avval /start bosing.");
      return;
    }

    // Biznes nomini ham bazadan olib kelamiz
    const { data: biz } = await db.from("businesses").select("name, phone").eq("id", user.business_id).maybeSingle();

    await ctx.reply(
      `⚙️ <b>SizningProfilingiz:</b>\n\n` +
      `👤 Ism: <b>${user.full_name || 'Ko\'rsatilmagan'}</b>\n` +
      `🏢 Do'kon/Biznes: <b>${biz?.name || 'Noma\'lum'}</b>\n` +
      `💼 Rol: <b>${user.role === 'owner' ? 'Rahbar (Owner)' : 'Menejer'}</b>\n` +
      `🆔 Biznes ID: <code>${user.business_id}</code>\n\n` +
      `<i>Ma'lumotlarni o'zgartirish uchun WebApp'dan foydalaning.</i>`,
      { parse_mode: "HTML" }
    );
  } catch (err: any) {
    console.error("[Profile]", err);
    await ctx.reply("Profilni yuklashda xatolik yuz berdi.");
  }
});

// 1 haftalik, 1 oylik va umumiy statistika
bot.hears("📊 Statistika va Hisobotlar", async (ctx) => {
  if (!ctx.from) return;
  try {
    const user = await getUser(ctx.from.id);
    if (!user) { await ctx.reply("Avval /start bosing."); return; }

    const { data: debts, error } = await db
      .from("debts")
      .select("amount, paid_amount, created_at, due_date, status")
      .eq("business_id", user.business_id);

    if (error || !debts) {
      return ctx.reply("Statistikani olishda xatolik yuz berdi.");
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalDebt = 0;
    let weekDebt = 0;
    let monthDebt = 0;

    debts.forEach((d: any) => {
      const remaining = (d.amount || 0) - (d.paid_amount || 0);
      
      // Agar ochiq nasiya bo'lsa umumiy qarzga qo'shamiz
      if (d.status === 'pending') {
        totalDebt += remaining;
      }

      const createdAt = new Date(d.created_at || d.due_date);
      if (createdAt >= oneWeekAgo) {
        weekDebt += (d.amount || 0);
      }
      if (createdAt >= oneMonthAgo) {
        monthDebt += (d.amount || 0);
      }
    });

    await ctx.reply(
      `📊 <b>Nasiya Statistikasi va Hisobotlar</b>\n\n` +
      `• 📅 <b>So'nggi 1 haftadagi yangi nasiyalar:</b> ${fmt(weekDebt)} so'm\n` +
      `• 🗓 <b>So'nggi 1 oydagi yangi nasiyalar:</b> ${fmt(monthDebt)} so'm\n` +
      `• 💰 <b>Hozirgi umumiy qoldiq qarz:</b> ${fmt(totalDebt)} so'm`,
      { parse_mode: "HTML" }
    );
  } catch (err: any) {
    console.error("[Stats]", err);
    await ctx.reply(`⚠️ Xatolik: <code>${err?.message || err}</code>`, { parse_mode: "HTML" });
  }
});

// Eski /stats komandasi uchun ham moslashtirib qo'yamiz
bot.command("stats", async (ctx) => {
  if (!ctx.from) return;
  // Yuqoridagi statistika mantig'ini chaqiramiz yoki qisqacha chiqazamiz
  const user = await getUser(ctx.from.id);
  if (!user) { await ctx.reply("Avval /start bosing."); return; }
  
  const { count: totalCustomers } = await db.from("customers").select("*", { count: "exact", head: true }).eq("business_id", user.business_id);
  const { data: debts } = await db.from("debts").select("amount, paid_amount, status").eq("business_id", user.business_id).eq("status", "pending");
  
  const totalSum = (debts ?? []).reduce((s: number, r: any) => s + (Number(r.amount) - Number(r.paid_amount || 0)), 0);

  await ctx.reply(
    `📊 <b>Tekor Statistika</b>\n\n` +
    `👥 Mijozlar: <b>${totalCustomers ?? 0}</b>\n` +
    `📋 Ochiq nasiyalar soni: <b>${debts?.length ?? 0}</b>\n` +
    `💰 Jami qoldiq qarz: <b>${fmt(totalSum)} so'm</b>`,
    { parse_mode: "HTML" }
  );
});

bot.on("callback_query:data", async (ctx) => {
  if (!ctx.from) return;
  const data = ctx.callbackQuery.data;
  const match = /^(pay|defer):([0-9a-f-]{36})$/.exec(data);
  if (!match) { await ctx.answerCallbackQuery({ text: "Noto'g'ri so'rov" }); return; }

  const [, action, debtId] = match;
  try {
    const user = await getUser(ctx.from.id);
    if (!user) { await ctx.answerCallbackQuery({ text: "Avval /start bosing." }); return; }

    if (action === "pay") {
      const ok = await markDebtPaid(debtId, user.business_id);
      if (!ok) { await ctx.answerCallbackQuery({ text: "Qarz topilmadi yoki allaqachon yopilgan" }); return; }
      await ctx.answerCallbackQuery({ text: "✅ To'lov qabul qilindi" });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply("✅ Nasiya to'langan deb belgilandi.");
      return;
    }

    const newDue = await deferDebt(debtId, user.business_id, DEFER_DAYS);
    if (!newDue) { await ctx.answerCallbackQuery({ text: "Qarz topilmadi" }); return; }
    await ctx.answerCallbackQuery({ text: `⏳ ${DEFER_DAYS} kunga surildi` });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply(`⏳ Muddat <b>${fmtDate(newDue)}</b> ga surildi.`, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[callback]", err);
    await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi" });
  }
});

bot.catch((err) => {
  console.error(`Update ${err.ctx.update.update_id}:`, err.error);
  if (err.error instanceof GrammyError) console.error("Telegram Error:", err.error.description);
  else if (err.error instanceof HttpError) console.error("Network Error:", err.error.message);
});

// ---------------------------------------------------------------------------
// Daily Cron Job
// ---------------------------------------------------------------------------

async function sendReminders(): Promise<void> {
  console.log(`[cron] Sending reminders...`);
  let debts: DueDebt[];
  try { debts = await fetchDueDebts(); } catch (e) { console.error("[cron]", e); return; }
  if (!debts.length) { console.log("[cron] No due debts today."); return; }

  let sent = 0, failed = 0;
  for (const debt of debts) {
    const ownerId = await getOwnerTelegramId(debt.business_id);
    if (!ownerId) continue;
    try {
      await bot.api.sendMessage(ownerId, debtMsg(debt), {
        parse_mode: "HTML",
        reply_markup: debtKeyboard(debt.id, debt.customers.phone),
      });
      sent++;
    } catch (e) {
      failed++;
      console.error(`[cron] Failed for debt ${debt.id}:`, e);
    }
  }
  console.log(`[cron] Completed: ${sent} sent, ${failed} failed.`);
}

cron.schedule(CRON_SCHED, () => void sendReminders(), { timezone: CRON_TZ });

// ---------------------------------------------------------------------------
// Express Web Server Setup
// ---------------------------------------------------------------------------

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.use(cors());
app.use(express.json());

// Telegram Webhook Marshruti
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;
app.use(WEBHOOK_PATH, webhookCallback(bot, "express"));

// Frontend / Web App uchun Endpoint
app.post("/auth/telegram", (req, res) => {
  res.json({ success: true, message: "Ulanish muvaffaqiyatli" });
});

app.get("/", (_req, res) => {
  res.send("Nasiya Daftari API & Bot is running.");
});

// Graceful Shutdown
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

// Express Serverni Ishga Tushirish
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`HTTP Server running on port ${PORT}`);

  if (RENDER_URL) {
    const cleanUrl = RENDER_URL.replace(/\/$/, "");
    const fullWebhookUrl = `${cleanUrl}${WEBHOOK_PATH}`;
    try {
      await bot.api.setWebhook(fullWebhookUrl, { drop_pending_updates: true });
      console.log(`Webhook successfully set to: ${fullWebhookUrl}`);
    } catch (err) {
      console.error("Failed to set Telegram Webhook:", err);
    }
  } else {
    console.log("No RENDER_EXTERNAL_URL found. Falling back to Polling mode...");
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    void bot.start({
      onStart: (info) => console.log(`@${info.username} is running in Polling mode`),
    });
  }
});

// Express xatolarini ushlash uchun middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Express Error]:", err);
  res.status(500).json({ success: false, error: err?.message || "Internal Server Error" });
});

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Unhandled Rejection]:", reason);
});
