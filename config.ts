import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  WEBAPP_URL: process.env.WEBAPP_URL!,

  // Auth Settings
  AUTH_ENABLED: process.env.AUTH_ENABLED === "true",
  BOT_LOGIN: process.env.BOT_LOGIN || "admin",
  BOT_PASSWORD: process.env.BOT_PASSWORD || "admin123",

  // Cron & Settings
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 9 * * *",
  CRON_TZ: process.env.CRON_TZ || "Asia/Tashkent",
  DEFER_DAYS: parseInt(process.env.DEFER_DAYS || "3", 10),

  // Bot Messages
  MESSAGES: {
    WELCOME_TITLE: process.env.MSG_WELCOME_TITLE,
    WELCOME_BODY: process.env.MSG_WELCOME_BODY,
    LOGIN_PROMPT: process.env.MSG_LOGIN_PROMPT,
    PASSWORD_PROMPT: process.env.MSG_PASSWORD_PROMPT,
    AUTH_SUCCESS: process.env.MSG_AUTH_SUCCESS,
    AUTH_FAILED: process.env.MSG_AUTH_FAILED,
    AUTH_REQUIRED: process.env.MSG_AUTH_REQUIRED,
    WEBAPP_BUTTON: process.env.MSG_WEBAPP_BUTTON,
  },
};