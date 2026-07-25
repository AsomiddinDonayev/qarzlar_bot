# Nasiya Daftari — To'liq O'rnatish va Ishga Tushirish Qo'llanmasi

## 📋 Umumiy Tuzilma

```
Nasiya daftar 2/
├── bot.ts                 # Telegram Bot (grammY)
├── server/index.ts        # Auth Server (Express) — Render'da deploy
├── mini-app/              # React Mini App — Vercel'da deploy
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx
│   ├── FastDebtEntryScreen.tsx
│   ├── api.ts             # HMAC validation
│   ├── db.ts              # Supabase client
│   └── useOfflineSync.ts  # Offline queue
├── supabase/schema.sql    # Multi-tenant DB schema
└── package.json           # Root dependencies
```

---

## 🔧 1-QADAM: Mahalliy O'rnatish (Local Setup)

### 1.1 Supabase Loyihasi Yaratish

1. https://supabase.com ga kiring
2. **New Project** bosing
3. Loyiha nomi: `nasiya-daftar`
4. Database password: **Xavfsiz parol saqlab qo'ying**
5. Region: `Singapore` (yoki sizga yaqin)
6. **Create new project** bosing (2-3 daqiqa kutish)

### 1.2 Supabase Kalitlarini Olish

1. Loyihaga kiring → **Settings** → **API**
2. Quyidagilarni nusxalang:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
   - **JWT Secret** (Settings → API → JWT Secret) → `SUPABASE_JWT_SECRET`

### 1.3 Telegram Bot Yaratish

1. Telegram'da **@BotFather** ga yozing
2. `/newbot` buyrug'ini yuboring
3. Bot nomi: `Nasiya Daftari Bot`
4. Bot username: `nasiya_daftar_bot` (yoki boshqa noyob nom)
5. **Bot Token** ni nusxalang → `TELEGRAM_BOT_TOKEN`

### 1.4 Loyihani Klonlash va Bog'lash

```bash
cd "Nasiya daftar 2"
npm install
cd mini-app
npm install
cd ..
```

### 1.5 .env Faylini Yaratish

Root papkada `.env` fayli yarating:

```bash
# Root .env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here
WEBAPP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173

CRON_SCHEDULE=0 9 * * *
CRON_TZ=Asia/Tashkent
DEFER_DAYS=3
PORT=3001
```

Mini-app papkada `mini-app/.env` yarating:

```bash
# mini-app/.env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=http://localhost:3001
```

### 1.6 Supabase Schema Ishga Tushirish

1. Supabase → **SQL Editor** → **New Query**
2. `supabase/schema.sql` ning barcha kodi nusxalang
3. **Run** bosing
4. Xatosiz tugashi kutish

---

## 🚀 2-QADAM: Mahalliy Testlash (Local Testing)

### 2.1 Barcha Servislarni Ishga Tushirish

**Terminal 1 — Bot:**
```bash
npm run bot:dev
```

**Terminal 2 — Auth Server:**
```bash
npm run server:dev
```

**Terminal 3 — Mini App:**
```bash
cd mini-app
npm run dev
```

Kutish:
- Bot: `@your_bot_username is running`
- Server: `Auth server on :3001`
- Mini App: `Local: http://localhost:5173`

### 2.2 Telegram Bot Sozlamalari

1. **@BotFather** ga yozing
2. `/mybots` → bot tanlang
3. **Bot Settings** → **Menu Button** → **Web App**
4. URL: `http://localhost:5173`
5. Saqlang

### 2.3 Telegram'da Test Qilish

1. Telegram'da o'z botingizni toping
2. `/start` buyrug'ini yuboring
3. **"📒 Nasiya Daftarini ochish"** tugmasini bosing
4. Mini App ochilishi kerak

### 2.4 Nasiya Qo'shish Testi

1. Mini App'da:
   - Summa: `50000`
   - Mijoz ismi: `Akmal`
   - Telefon: `+998901234567`
   - Mahalla: `Markaz`
   - Toifa: `Oziq-ovqat`
   - **Nasiyani Saqlash** bosing

2. Supabase → **Table Editor** → `debts` → yangi qator ko'rinishi kerak

---

## 🌐 3-QADAM: Render'da Deploy (Bot + Auth Server)

### 3.1 Render Akkauntini Yaratish

1. https://render.com ga kiring
2. GitHub bilan ro'yxatdan o'ting
3. Dashboard → **New +** → **Web Service**

### 3.2 Bot Servisini Deploy Qilish

1. **GitHub** ni ulang (Nasiya daftar 2 repo)
2. **Create Web Service**
3. Sozlamalar:
   - **Name:** `nasiya-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run bot`
   - **Plan:** `Free`

4. **Environment** → **Add Environment Variable**:
   ```
   TELEGRAM_BOT_TOKEN=your_token
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   SUPABASE_JWT_SECRET=your_secret
   WEBAPP_URL=https://your-mini-app.vercel.app
   CRON_TZ=Asia/Tashkent
   ```

5. **Deploy** bosing

### 3.3 Auth Server Servisini Deploy Qilish

1. Render Dashboard → **New +** → **Web Service**
2. Sozlamalar:
   - **Name:** `nasiya-auth`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run server`
   - **Plan:** `Free`

3. **Environment Variables**:
   ```
   TELEGRAM_BOT_TOKEN=your_token
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   SUPABASE_JWT_SECRET=your_secret
   ALLOWED_ORIGINS=https://your-mini-app.vercel.app
   PORT=3001
   ```

4. **Deploy** bosing

5. Deploy tugagach, URL nusxalang (masalan: `https://nasiya-auth.onrender.com`)

---

## 🎨 4-QADAM: Vercel'da Deploy (Mini App)

### 4.1 Vercel Akkauntini Yaratish

1. https://vercel.com ga kiring
2. GitHub bilan ro'yxatdan o'ting

### 4.2 Mini App Loyihasi Yaratish

1. **Add New** → **Project**
2. GitHub repo tanlang
3. **Import Project**
4. Sozlamalar:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `mini-app`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

5. **Environment Variables** qo'shish:
   ```
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_API_URL=https://nasiya-auth.onrender.com
   ```

6. **Deploy** bosing

7. Deploy tugagach, URL nusxalang (masalan: `https://nasiya-daftar.vercel.app`)

---

## 🔗 5-QADAM: Barcha Bog'lanishlarni Yangilash

### 5.1 Render Bot Servisini Yangilash

1. Render → `nasiya-bot` → **Environment**
2. `WEBAPP_URL` ni yangilang:
   ```
   https://nasiya-daftar.vercel.app
   ```
3. **Save** bosing (auto-redeploy)

### 5.2 Render Auth Servisini Yangilash

1. Render → `nasiya-auth` → **Environment**
2. `ALLOWED_ORIGINS` ni yangilang:
   ```
   https://nasiya-daftar.vercel.app
   ```
3. **Save** bosing

### 5.3 Telegram Bot Sozlamalarini Yangilash

1. **@BotFather** ga yozing
2. `/mybots` → bot tanlang
3. **Bot Settings** → **Menu Button** → **Web App**
4. URL ni yangilang:
   ```
   https://nasiya-daftar.vercel.app
   ```
5. Saqlang

---

## ✅ 6-QADAM: Yakuniy Test

### 6.1 Telegram'da Test Qilish

1. Telegram'da o'z botingizni toping
2. `/start` buyrug'ini yuboring
3. **"📒 Nasiya Daftarini ochish"** tugmasini bosing
4. Mini App ochilishi kerak
5. Nasiya qo'shish testi:
   - Summa: `100000`
   - Mijoz: `Test Mijoz`
   - Telefon: `+998901234567`
   - **Saqlash** bosing
6. Supabase'da `debts` jadvalida yangi qator ko'rinishi kerak

### 6.2 Offline Test Qilish

1. Mini App'da DevTools ochish (F12)
2. **Network** → **Offline** qilish
3. Nasiya qo'shish
4. "Saqlanmoqda..." ko'rinishi kerak
5. **Online** qilish
6. Avtomatik sync bo'lishi kerak

### 6.3 Bot Statistikasi

1. Telegram'da `/stats` buyrug'ini yuboring
2. Mijozlar soni, nasiyalar soni, jami qarz ko'rinishi kerak

---

## 🐛 Umumiy Muammolar va Yechimlar

### "Telegram autentifikatsiya muvaffaqiyatsiz"
- ✅ `TELEGRAM_BOT_TOKEN` to'g'ri ekanligini tekshiring
- ✅ `SUPABASE_JWT_SECRET` to'g'ri ekanligini tekshiring
- ✅ Auth server ishga tushganligini tekshiring

### "Do'kon topilmadi. Avval botda /start bosing."
- ✅ Telegram'da `/start` buyrug'ini yuboring
- ✅ Supabase → `users` jadvalida qator ko'rinishi kerak

### Mini App ochilmaydi
- ✅ `VITE_API_URL` to'g'ri ekanligini tekshiring
- ✅ Auth server CORS sozlamalarini tekshiring
- ✅ DevTools → Console'da xatolarni tekshiring

### Nasiya saqlanmaydi
- ✅ Supabase RLS politikalarini tekshiring
- ✅ JWT `telegram_id` claim'ini tekshiring
- ✅ `business_id` to'g'ri ekanligini tekshiring

---

## 📊 Supabase Jadvallarini Tekshirish

### Foydalanuvchilar
```sql
SELECT * FROM users;
```

### Nasiyalar
```sql
SELECT d.*, c.name, b.name as business_name 
FROM debts d
JOIN customers c ON d.customer_id = c.id
JOIN businesses b ON d.business_id = b.id;
```

### Ochiq Nasiyalar
```sql
SELECT * FROM debts WHERE status = 'pending';
```

---

## 🎯 Keyingi Qadamlar

1. **Offline Sync Testi** — Internet o'chiring, nasiya qo'shing, qayta yoqing
2. **Multi-User Test** — Ikkinchi foydalanuvchi qo'shing (manager role)
3. **Cron Reminders** — Bugun 9:00 da reminder kelishi kerak
4. **Backup** — Supabase → Settings → Backups

---

## 📞 Yordam

Agar muammo bo'lsa:
1. Render/Vercel logs'ni tekshiring
2. Supabase SQL Editor'da schema'ni tekshiring
3. Telegram Bot API status'ni tekshiring
4. Browser DevTools → Console'da xatolarni tekshiring

**Omad! 🚀**
