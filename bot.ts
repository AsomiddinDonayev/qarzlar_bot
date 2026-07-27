import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { Bot, InlineKeyboard, webhookCallback } from "grammy";
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

const BOT_TOKEN       = getEnv("TELEGRAM_BOT_TOKEN", "BOT_TOKEN");
const SUPA_URL        = getEnv("SUPABASE_URL");
const SUPA_KEY        = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const WEBAPP_URL      = getEnv("WEBAPP_URL");
const CRON_SCHED      = process.env.CRON_SCHEDULE ?? "0 9 * * *";
const CRON_TZ         = process.env.CRON_TZ       ?? "Asia/Tashkent";
const DEFER_DAYS      = envInt("DEFER_DAYS", 3);
const RENDER_URL      = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || "";
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID || 0);

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------

const db: SupabaseClient = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// In-Memory States
// ---------------------------------------------------------------------------
const userFeedbackType = new Map<number, string>();
const adminWaitingForBroadcast = new Set<number>();

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
// Security: Telegram WebApp initData Validator
// ---------------------------------------------------------------------------
function validateTelegramInitData(initData: string, botToken: string): number | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return null;
    
    urlParams.delete("hash");
    const params: string[] = [];
    urlParams.sort();
    for (const [key, value] of urlParams.entries()) {
      params.push(`${key}=${value}`);
    }
    const dataCheckString = params.join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) return null;

    const userParam = urlParams.get("user");
    if (!userParam) return null;
    const userObj = JSON.parse(userParam);
    return userObj.id ? Number(userObj.id) : null;
  } catch (e) {
    return null;
  }
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
    .insert({ name: fullName, phone: "", is_active: false })
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

async function isBusinessActive(businessId: string): Promise<boolean> {
  const { data } = await db
    .from("businesses")
    .select("is_active, deleted_at")
    .eq("id", businessId)
    .maybeSingle();
  if (!data || data.deleted_at || !data.is_active) return false;
  return true;
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
    } else {
      const { data: biz } = await db.from("businesses").select("deleted_at").eq("id", user.business_id).maybeSingle();
      if (biz?.deleted_at) {
        await db.from("businesses").update({ deleted_at: null }).eq("id", user.business_id);
      }
    }

    const active = await isBusinessActive(user.business_id);
    if (!active) {
  // Obuna yoki biznes aktivligini tekshirish kodi ichida:
  await ctx.reply(
  `⚠️ **Diqqat!**\n\nSizning biznesingiz hali aktiv holatida emas.`
  );
      return;
    }

    const roleText = user.role === "owner" ? "Egasi" : "Menejer";
    const name = user.full_name ?? "Foydalanuvchi";

    await ctx.reply(
      `Assalomu alaykum, <b>${name}</b>!\n\n` +
      `Siz <b>${roleText}</b> sifatida kirgansiz. Quyidagi menyu orqali boshqarishingiz mumkin.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "📊 Statistika va Hisobotlar" }, { text: "⚙️ Profilni ko'rish" }],
            [{ text: "📒 Nasiya Daftarini ochish (WebApp)" }],
            [{ text: "💬 Taklif va Shikoyatlar" }]
          ],
          resize_keyboard: true,
        },
      }
    );
  } catch (err: any) {
    console.error("[/start]", err);
    await ctx.reply(`⚠️ Xatolik yuz berdi:\n<code>${err?.message || err}</code>`, { parse_mode: "HTML" });
  }
});

bot.command("admin", async (ctx) => {
  if (!ctx.from) return;
  if (ADMIN_TELEGRAM_ID && ctx.from.id !== ADMIN_TELEGRAM_ID) {
    await ctx.reply("⛔ Sizda bu buyruqdan foydalanish huquqi yo'q.");
    return;
  }

  await ctx.reply(
    `🛠 <b>Admin Boshqaruv Paneli</b>\n\n` +
    `Quyidagi tugmalar orqali bot va bizneslar faoliyatini nazorat qilishingiz mumkin:`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("📊 Aktivlik va Statistika", "admin:stats").row()
        .text("📋 Tasdiqlashni kutayotganlar", "admin:pending_biz").row()
        .text("📥 Murojaat va Fikrlar", "admin:messages").row()
        .text("📢 Hammaga xabar yuborish", "admin:broadcast"),
    }
  );
});

bot.hears("💬 Taklif va Shikoyatlar", async (ctx) => {
  if (!ctx.from) return;
  const user = await getUser(ctx.from.id);
  if (!user || !(await isBusinessActive(user.business_id))) {
    await ctx.reply("⚠️ Avval obunani faollashtiring.");
    return;
  }

  await ctx.reply("Ariza turini tanlang:", {
    reply_markup: new InlineKeyboard()
      .text("⚠️ Shikoyat", "fb_type:shikoyat")
      .text("💡 Taklif", "fb_type:taklif")
      .text("💬 Izoh", "fb_type:izoh")
  });
});

bot.on("message:text", async (ctx, next) => {
  if (!ctx.from) return next();
  const userId = ctx.from.id;
  const text = ctx.msg.text;

  if (text.startsWith("/")) return next();

  if (ADMIN_TELEGRAM_ID && userId === ADMIN_TELEGRAM_ID && adminWaitingForBroadcast.has(userId)) {
    adminWaitingForBroadcast.delete(userId);
    const { data: allUsers } = await db.from("users").select("telegram_id");
    const uniqueIds = Array.from(new Set(allUsers?.map((u: any) => u.telegram_id) || []));

    let success = 0;
    let failed = 0;
    await ctx.reply(`📢 Xabar yuborish boshlandi (${uniqueIds.length} ta foydalanuvchi)...`);

    for (const tid of uniqueIds) {
      try {
        await bot.api.sendMessage(tid, `📢 <b>Admin e'loni:</b>\n\n${text}`, { parse_mode: "HTML" });
        success++;
      } catch (e) {
        failed++;
      }
    }

    await ctx.reply(`✅ Xabar tarqatish yakunlandi!\n• Muvaffaqiyatli: ${success} ta\n• Xatolik: ${failed} ta`);
    return;
  }

  if (userFeedbackType.has(userId)) {
    const type = userFeedbackType.get(userId)!;
    userFeedbackType.delete(userId);

    await db.from("bot_feedback").insert({
      telegram_id: userId,
      full_name: displayName(ctx.from),
      text: text,
      type: type
    });

    await ctx.reply(`✅ Murojaatingiz qabul qilindi! Rahmat.`);

    if (ADMIN_TELEGRAM_ID) {
      const typeEmoji: Record<string, string> = { shikoyat: "⚠️", taklif: "💡", izoh: "💬" };
      await bot.api.sendMessage(
        ADMIN_TELEGRAM_ID,
        `${typeEmoji[type] || '📬'} <b>Yangi ${type.toUpperCase()}!</b>\n\n` +
        `👤 Kimdan: ${displayName(ctx.from)} (<code>${userId}</code>)\n` +
        `📝 Matn: ${text}`,
        { parse_mode: "HTML" }
      );
    }
    return;
  }

  return next();
});

bot.hears("📒 Nasiya Daftarini ochish (WebApp)", async (ctx) => {
  if (!ctx.from) return;
  const user = await getUser(ctx.from.id);
  if (!user || !(await isBusinessActive(user.business_id))) {
    await ctx.reply("⚠️ Tizimdan foydalanish uchun obunangiz faol bo'lishi kerak.");
    return;
  }

  await ctx.reply("Quyidagi tugma orqali ilovani oching:", {
    reply_markup: new InlineKeyboard().webApp("🚀 WebApp-ni ochish", WEBAPP_URL),
  });
});

bot.hears("⚙️ Profilni ko'rish", async (ctx) => {
  if (!ctx.from) return;
  try {
    const user = await getUser(ctx.from.id);
    if (!user) { await ctx.reply("Avval /start bosing."); return; }

    const { data: biz } = await db.from("businesses").select("name, phone, is_active, deleted_at").eq("id", user.business_id).maybeSingle();
    
    if (biz?.deleted_at) {
      await ctx.reply("⚠️ Sizning profilingiz o'chirish jarayonida. 1 soat ichida ortga qaytarishingiz mumkin.", {
        reply_markup: new InlineKeyboard().text("🔄 Profilni tiklash (Undo)", "profile:undo")
      });
      return;
    }

    const subStatus = biz?.is_active ? "✅ Faol (Obuna to'langan)" : "❌ Faol emas (Obuna kutilmoqda)";

    await ctx.reply(
      `⚙️ <b>Sizning Profilingiz:</b>\n\n` +
      `👤 Ism: <b>${user.full_name || 'Ko\'rsatilmagan'}</b>\n` +
      `🏢 Do'kon/Biznes: <b>${biz?.name || 'Noma\'lum'}</b>\n` +
      `📦 Obuna holati: <b>${subStatus}</b>\n` +
      `💼 Rol: <b>${user.role === 'owner' ? 'Rahbar (Owner)' : 'Menejer'}</b>\n` +
      `🆔 Biznes ID: <code>${user.business_id}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🗑 Profilni o'chirish", "profile:delete_prompt"),
      }
    );
  } catch (err: any) {
    console.error("[Profile]", err);
    await ctx.reply("Profilni yuklashda xatolik yuz berdi.");
  }
});

bot.hears("📊 Statistika va Hisobotlar", async (ctx) => {
  if (!ctx.from) return;
  try {
    const user = await getUser(ctx.from.id);
    if (!user || !(await isBusinessActive(user.business_id))) {
      await ctx.reply("⚠️ Obuna faol emas.");
      return;
    }

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

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------
bot.on("callback_query:data", async (ctx) => {
  if (!ctx.from) return;
  const data = ctx.callbackQuery.data;

  if (data === "profile:delete_prompt") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `⚠️ <b>Diqqat! Profilni o'chirish</b>\n\n` +
      `Haqiqatan ham profilingiz va barcha ma'lumotlaringizni o'chirmoqchimisiz? 1 soat ichida tiklab olishingiz mumkin.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("❌ Ha, o'chirish", "profile:delete_confirm")
          .text("🔙 Bekor qilish", "profile:cancel")
      }
    );
    return;
  }

  if (data === "profile:delete_confirm") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🔴 <b>Oxirgi tasdiqlash!</b> Tasdiqlaysizmi?`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("🔴 Tasdiqlash va o'chirish", "profile:delete_final")
          .text("🔙 Bekor qilish", "profile:cancel")
      }
    );
    return;
  }

  if (data === "profile:cancel") {
    await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
    await ctx.editMessageText("✅ Amal bekor qilindi.");
    return;
  }

  if (data === "profile:delete_final") {
    const user = await getUser(ctx.from.id);
    if (!user) { await ctx.answerCallbackQuery({ text: "Topilmadi" }); return; }

    const nowIso = new Date().toISOString();
    await db.from("businesses").update({ deleted_at: nowIso }).eq("id", user.business_id);

    await ctx.answerCallbackQuery({ text: "O'chirishga qo'yildi" });
    await ctx.editMessageText(
      `⚠️ <b>Profil o'chirishga belgilandi!</b> 1 soat ichida tiklashingiz mumkin.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔄 Profilni tiklash (Undo)", "profile:undo")
      }
    );
    return;
  }

  if (data === "profile:undo") {
    const user = await getUser(ctx.from.id);
    if (!user) { await ctx.answerCallbackQuery({ text: "Topilmadi" }); return; }

    await db.from("businesses").update({ deleted_at: null }).eq("id", user.business_id);
    await ctx.answerCallbackQuery({ text: "Profil tiklandi!" });
    await ctx.editMessageText("✅ Profilingiz muvaffaqiyatli tiklandi!");
    return;
  }

  if (data.startsWith("fb_type:")) {
    const type = data.split(":")[1];
    userFeedbackType.set(ctx.from.id, type);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`Iltimos, o'z murojaatingiz matnini yozib yuboring:`, { parse_mode: "HTML" });
    return;
  }

  if (data.startsWith("admin:")) {
    if (ADMIN_TELEGRAM_ID && ctx.from.id !== ADMIN_TELEGRAM_ID) {
      await ctx.answerCallbackQuery({ text: "Ruxsat yo'q" });
      return;
    }

    if (data === "admin:broadcast") {
      adminWaitingForBroadcast.add(ctx.from.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(`📢 Hammaga yuboriladigan xabarni yozing:`, { parse_mode: "HTML" });
      return;
    }

    if (data === "admin:pending_biz") {
      const { data: pending } = await db
        .from("businesses")
        .select("id, name, phone, created_at")
        .eq("is_active", false)
        .is("deleted_at", null);

      if (!pending || pending.length === 0) {
        await ctx.answerCallbackQuery({ text: "Tasdiqlashni kutayotganlar yo'q" });
        return;
      }

      const kb = new InlineKeyboard();
      pending.forEach((b: any) => {
        kb.text(`✅ ${b.name || 'Nomsiz'}`, `admin:activate:${b.id}`).row();
      });

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(`📋 <b>Tasdiqlashni kutayotgan bizneslar:</b>`, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (data.startsWith("admin:activate:")) {
      const bizId = data.split(":")[2];
      await db.from("businesses").update({ is_active: true }).eq("id", bizId);

      const ownerId = await getOwnerTelegramId(bizId);
      if (ownerId) {
       // YANGI KOD:
try {
  await ctx.editMessageText("✅ Biznes muvaffaqiyatli faollashtirildi!");
  await ctx.answerCallbackQuery({
    text: "Muvaffaqiyatli bajarildi!",
  });
} catch (error: any) {
  // Agar xatolik faqat "message is not modified" bo'lsa, uni e'tiborsiz qoldiramiz
  if (!error.description?.includes("message is not modified")) {
    throw error;
  }
  await ctx.answerCallbackQuery({
    text: "Bu biznes allaqachon faollashtirilgan!",
  });
}

    if (data === "admin:stats") {
      const { data: businesses } = await db.from("businesses").select("id, name, is_active");
      const totalBiz = businesses?.length || 0;
      const activeBiz = businesses?.filter((b: any) => b.is_active)?.length || 0;

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `📊 <b>Statistika</b>\n\n` +
        `🏢 Jami bizneslar: <b>${totalBiz} ta</b>\n` +
        `✅ Faol obunadagilar: <b>${activeBiz} ta</b>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "admin:messages") {
      const { data: msgs } = await db.from("bot_feedback").select("*").order("created_at", { ascending: false }).limit(10);
      if (!msgs || msgs.length === 0) {
        await ctx.answerCallbackQuery({ text: "Murojaatlar yo'q" });
        return;
      }
      let textReport = "📥 <b>Murojaatlar:</b>\n\n";
      msgs.forEach((m: any, i: number) => {
        textReport += `${i + 1}. [${m.type.toUpperCase()}] ${m.full_name}: ${m.text}\n\n`;
      });
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(textReport, { parse_mode: "HTML" });
      return;
    }
  }

  const match = /^(pay|defer):([0-9a-f-]{36})$/.exec(data);
  if (!match) { await ctx.answerCallbackQuery({ text: "Xato" }); return; }

  const [, action, debtId] = match;
  try {
    const user = await getUser(ctx.from.id);
    if (!user || !(await isBusinessActive(user.business_id))) {
      await ctx.answerCallbackQuery({ text: "Obuna faol emas" });
      return;
    }

    if (action === "pay") {
      const ok = await markDebtPaid(debtId, user.business_id);
      if (!ok) { await ctx.answerCallbackQuery({ text: "Topilmadi" }); return; }
      await ctx.answerCallbackQuery({ text: "✅ To'landi" });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply("✅ Nasiya to'landi.");
      return;
    }

    const newDue = await deferDebt(debtId, user.business_id, DEFER_DAYS);
    if (!newDue) { await ctx.answerCallbackQuery({ text: "Topilmadi" }); return; }
    await ctx.answerCallbackQuery({ text: `⏳ Surildi` });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply(`⏳ Muddat <b>${fmtDate(newDue)}</b> ga surildi.`, { parse_mode: "HTML" });
  } catch (err) {
    console.error(err);
    await ctx.answerCallbackQuery({ text: "Xatolik" });
  }
});

bot.catch((err) => {
  console.error(`Update:`, err.error);
});

// ---------------------------------------------------------------------------
// Background Cleanup Job (1 hour soft delete)
// ---------------------------------------------------------------------------
setInterval(async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: expiredBiz } = await db
      .from("businesses")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", oneHourAgo);

    if (expiredBiz && expiredBiz.length > 0) {
      for (const biz of expiredBiz) {
        await db.from("users").delete().eq("business_id", biz.id);
        await db.from("debts").delete().eq("business_id", biz.id);
        await db.from("customers").delete().eq("business_id", biz.id);
        await db.from("businesses").delete().eq("id", biz.id);
      }
    }
  } catch (err) {}
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// Daily Cron Job
// ---------------------------------------------------------------------------
async function sendReminders(): Promise<void> {
  let debts: DueDebt[];
  try { debts = await fetchDueDebts(); } catch (e) { return; }
  if (!debts.length) return;

  for (const debt of debts) {
    if (!(await isBusinessActive(debt.business_id))) continue;
    const ownerId = await getOwnerTelegramId(debt.business_id);
    if (!ownerId) continue;
    try {
      await bot.api.sendMessage(ownerId, debtMsg(debt), {
        parse_mode: "HTML",
        reply_markup: debtKeyboard(debt.id, debt.customers.phone),
      });
    } catch (e) {}
  }
}

cron.schedule(CRON_SCHED, () => void sendReminders(), { timezone: CRON_TZ });

// ---------------------------------------------------------------------------
// Express Web Server Setup & Security Limiter
// ---------------------------------------------------------------------------

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.use(cors());
app.use(express.json());

// Rate Limiter: Bitta IP'dan 15 daqiqada ko'pi bilan 100 ta so'rov kelishiga ruxsat beriladi (DDoS himoya)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Juda ko'p so'rov yuborildi. Birozdan so'ng urinib ko'ring." }
});

app.use("/auth/telegram", limiter);

const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;
app.use(WEBHOOK_PATH, webhookCallback(bot, "express"));

// Secured Telegram WebApp Auth API endpoint (initData orqali kriptografik tekshiruv)
app.post("/auth/telegram", async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      return res.status(400).json({ success: false, error: "initData talab qilinadi" });
    }

    const telegramId = validateTelegramInitData(initData, BOT_TOKEN);
    if (!telegramId) {
      return res.status(401).json({ success: false, error: "Autentifikatsiyadan o'tmadi (Xavfsizlik xatosi)" });
    }

    const user = await getUser(telegramId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }

    const active = await isBusinessActive(user.business_id);
    if (!active) {
      return res.status(403).json({ success: false, error: "Obuna faol emas" });
    }

    res.json({ success: true, message: "Ulanish muvaffaqiyatli", business_id: user.business_id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.send("Nasiya Daftari API & Bot is running securely.");
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Secure HTTP Server running on port ${PORT}`);

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
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    void bot.start();
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ success: false, error: err?.message || "Internal Server Error" });
});
