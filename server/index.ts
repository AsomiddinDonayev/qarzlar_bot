import "dotenv/config";
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const app  = express();
const PORT = process.env.PORT ?? 3001;

const BOT_TOKEN       = requireEnv("TELEGRAM_BOT_TOKEN");
const SUPA_URL        = requireEnv("SUPABASE_URL");
const SUPA_SERVICE    = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const JWT_SECRET      = requireEnv("SUPABASE_JWT_SECRET"); // from Supabase dashboard → Settings → API
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function requireEnv(k: string): string {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

const db = createClient(SUPA_URL, SUPA_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

app.use(express.json());

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

/**
 * Validates Telegram initData using HMAC-SHA256.
 * Returns parsed user object or null.
 */
function verifyInitData(initData: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash   = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const expected  = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const hashBuf     = Buffer.from(hash, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (hashBuf.length !== expectedBuf.length || !timingSafeEqual(hashBuf, expectedBuf)) return null;

  // Check freshness (5 min window)
  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  if (Date.now() / 1000 - authDate > 300) return null;

  return Object.fromEntries(params.entries());
}

// POST /auth/telegram
app.post("/auth/telegram", async (req, res) => {
  const { initData } = req.body as { initData?: string };
  if (!initData) { res.status(400).json({ error: "initData required" }); return; }

  const parsed = verifyInitData(initData);
  if (!parsed) { res.status(401).json({ error: "Invalid initData" }); return; }

  let tgUser: { id: number; first_name: string; username?: string };
  try {
    tgUser = JSON.parse(parsed.user ?? "{}");
    if (!tgUser.id) throw new Error();
  } catch {
    res.status(400).json({ error: "Invalid user payload" });
    return;
  }

  // Ensure user exists in DB (auto-register on first Mini App open)
  const { data: existing } = await db
    .from("users")
    .select("telegram_id, business_id, role")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  let businessId: string;
  let role: string;

  if (existing) {
    businessId = existing.business_id;
    role       = existing.role;
  } else {
    // Auto-register as owner (bot /start may not have been called yet)
    const { data: biz, error: bizErr } = await db
      .from("businesses")
      .insert({ name: tgUser.first_name, phone: "" })
      .select("id")
      .single();
    if (bizErr) { res.status(500).json({ error: bizErr.message }); return; }

    await db.from("users").insert({
      telegram_id: tgUser.id,
      business_id: biz.id,
      role: "owner",
      full_name: tgUser.first_name,
    });
    businessId = biz.id;
    role       = "owner";
  }

  // Issue Supabase-compatible JWT with telegram_id claim for RLS
  const token = jwt.sign(
    {
      sub:         String(tgUser.id),
      telegram_id: tgUser.id,
      business_id: businessId,
      role:        "authenticated",
      user_role:   role,
      iat:         Math.floor(Date.now() / 1000),
      exp:         Math.floor(Date.now() / 1000) + 60 * 60 * 8, // 8h
    },
    JWT_SECRET,
    { algorithm: "HS256" }
  );

  res.json({ token });
});

app.listen(PORT, () => console.log(`Auth server on :${PORT}`));
