import "dotenv/config";
import { timingSafeEqual, createHmac } from "node:crypto";
import { Bot, Context, InlineKeyboard, GrammyError, HttpError } from "grammy";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import cron from "node-cron";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const BOT_TOKEN   = requireEnv("TELEGRAM_BOT_TOKEN");
const SUPA_URL    = requireEnv("SUPABASE_URL");
const SUPA_KEY    = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const WEBAPP_URL  = requireEnv("WEBAPP_URL");
const CRON_SCHED  = process.env.CRON_SCHEDULE ?? "0 9 * * *";
const CRON_TZ     = process.env.CRON_TZ        ?? "Asia/Tashkent";
const DEFER_DAYS  = envInt("DEFER_DAYS", 3);

function requireEnv(k: string): string {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}
function envInt(k: string, fb: number): number {
  const v = parseInt(process.env[k] ?? "", 10);
  return isFinite(v) ? v : fb;
}
function safeEq(a: string, b: string): boolean {
  const la = Buffer.from(a), lb = Buffer.from(b);
  return la.length === lb.length && timingSafeEqual(la, lb);
}

// ---------------------------------------------------------------------------
// Supabase (service role — bypasses RLS for bot operations)
// ---------------------------------------------------------------------------

const db: SupabaseClient = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Types
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
  note: string | null;
  due_date: string;
  business_id: string;
  customers: { name: string; phone: string | null };
  businesses: { telegram_id_owner: number };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getUser(telegramId: number): Promise<UserRow | null> {
  const { data } = await db
    .from("users")
    .select("telegram_id, business_id, role, full_name")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  return data as UserRow | null;
}

async function registerOwner(telegramId: number, fullName: string): Promise<UserRow> {
  // Create business first
  const { data: biz, error: bizErr } = await db
    .from("businesses")
    .insert({ name: fullName, phone: "" })
    .select("id")
    .single();
  if (bizErr) throw new Error(bizErr.message);

  const { data: user, error: userErr } = await db
    .from("users")
    .insert({ telegram_id: telegramId, business_id: biz.id, role: "owner", full_name: fullName })
    .select("telegram_id, business_id, role, full_name")
    .single();
  if (userErr) throw new Error(userErr.message);
  return user as UserRow;
}

async function fetchDueDebts(): Promise<DueDebt[]> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CRON_TZ }).format(new Date());

  const { data, error } = await db
    .from("debts")
    .select(`
      id, amount, note, due_date, business_id,
      customers!inner(name, phone),
      businesses!inner(id)
    `)
    .eq("status", "pending")
    .lte("due_date", today);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DueDebt[];
}

async function markDebtPaid(debtId: string, businessId: string): Promise<boolean> {
  const { data } = await db
    .from("debts")
    .update({ status: "paid" })
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

// Get owner telegram_id for a business
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
function esc(t: string) { return t.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1"); }
function displayName(from: { first_name?: string; last_name?: string; id: number }) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || `User ${from.id}`;
}

function debtMsg(debt: DueDebt): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CRON_TZ }).format(new Date());
  const overdue = debt.due_date < today;
  return [
    overdue ? "⚠️ *Muddati o'tgan nasiya*" : "🔔 *Bugun to'lov muddati*",
    "",
    `👤 *Mijoz:* ${esc(debt.customers.name)}`,
    debt.customers.phone ? `📞 *Telefon:* ${esc(debt.customers.phone)}` : null,
    `💰 *Summa:* ${esc(fmt(debt.amount))} so'm`,
    debt.note ? `📝 *Izoh:* ${esc(debt.note)}` : null,
    `📅 *Muddat:* ${esc(fmtDate(debt.due_date))}`,
  ].filter(Boolean).join("\n");
}

function debtKeyboard(debtId: string, phone: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (phone) kb.url("📞 Qo'ng'iroq", `tel:${phone.replace(/\D/g, "").replace(/^998/, "+998")}`).row();
  return kb.text("✅ Pulni oldim", `pay:${debtId}`).text(`⏳ ${DEFER_DAYS}k surish`, `defer:${debtId}`);
}

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  if (!ctx.from) return;
  try {
    let user = await getUser(ctx.from.id);
    if (!user) {
      user = await registerOwner(ctx.from.id, displayName(ctx.from));
    }

    const trialInfo = user.role === "owner"
      ? `\n\n🎁 3 kunlik sinov davri faol\\!` : "";

    await ctx.reply(
      `Assalomu alaykum, *${esc(user.full_name ?? "Foydalanuvchi")}*\\!\n\n` +
      `Siz *${esc(user.role === "owner" ? "Egasi" : "Menejer")}* sifatida kirgansiz\\.${trialInfo}`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: new InlineKeyboard().webApp("📒 Nasiya Daftarini ochish", WEBAPP_URL),
      }
    );
  } catch (err) {
    console.error("[/start]", err);
    await ctx.reply("Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.");
  }
});

bot.command("stats", async (ctx) => {
  if (!ctx.from) return;
  try {
    const user = await getUser(ctx.from.id);
    if (!user) { await ctx.reply("Avval /start bosing."); return; }

    const [{ count: totalCustomers }, { count: pendingDebts }, { data: sumData }] = await Promise.all([
      db.from("customers").select("*", { count: "exact", head: true }).eq("business_id", user.business_id),
      db.from("debts").select("*", { count: "exact", head: true }).eq("business_id", user.business_id).eq("status", "pending"),
      db.from("debts").select("amount").eq("business_id", user.business_id).eq("status", "pending"),
    ]);

    const totalSum = (sumData ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);

    await ctx.reply(
      `📊 *Statistika*\n\n` +
      `👥 Mijozlar: *${totalCustomers ?? 0}*\n` +
      `📋 Ochiq nasiyalar: *${pendingDebts ?? 0}*\n` +
      `💰 Jami qarz: *${esc(fmt(totalSum))} so'm*`,
      { parse_mode: "MarkdownV2" }
    );
  } catch (err) {
    console.error("[/stats]", err);
    await ctx.reply("Xatolik yuz berdi.");
  }
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
      await ctx.reply("✅ Nasiya to'langan deb belgilandi\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    const newDue = await deferDebt(debtId, user.business_id, DEFER_DAYS);
    if (!newDue) { await ctx.answerCallbackQuery({ text: "Qarz topilmadi" }); return; }
    await ctx.answerCallbackQuery({ text: `⏳ ${DEFER_DAYS} kunga surildi` });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply(`⏳ Muddat *${esc(fmtDate(newDue))}* ga surildi\\.`, { parse_mode: "MarkdownV2" });
  } catch (err) {
    console.error("[callback]", err);
    await ctx.answerCallbackQuery({ text: "Xatolik yuz berdi" });
  }
});

bot.catch((err) => {
  console.error(`Update ${err.ctx.update.update_id}:`, err.error);
  if (err.error instanceof GrammyError) console.error("Telegram:", err.error.description);
  else if (err.error instanceof HttpError) console.error("Network:", err.error);
});

// ---------------------------------------------------------------------------
// Daily Cron
// ---------------------------------------------------------------------------

async function sendReminders(): Promise<void> {
  console.log(`[cron] Sending reminders`);
  let debts: DueDebt[];
  try { debts = await fetchDueDebts(); } catch (e) { console.error("[cron]", e); return; }
  if (!debts.length) { console.log("[cron] No due debts"); return; }

  let sent = 0, failed = 0;
  for (const debt of debts) {
    const ownerId = await getOwnerTelegramId(debt.business_id);
    if (!ownerId) continue;
    try {
      await bot.api.sendMessage(ownerId, debtMsg(debt), {
        parse_mode: "MarkdownV2",
        reply_markup: debtKeyboard(debt.id, debt.customers.phone),
      });
      sent++;
    } catch (e) {
      failed++;
      console.error(`[cron] debt ${debt.id}:`, e);
    }
  }
  console.log(`[cron] ${sent} sent, ${failed} failed`);
}

cron.schedule(CRON_SCHED, () => void sendReminders(), { timezone: CRON_TZ });

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

console.log(`Bot starting. Cron: "${CRON_SCHED}" (${CRON_TZ})`);
void bot.start({ onStart: (i) => console.log(`@${i.username} running`) });
process.once("SIGINT",  () => bot.stop());
process.once("SIGTERM", () => bot.stop());
