# 🔧 Muammolarni Hal Qilish (Troubleshooting)

## 🚨 Umumiy Muammolar

### 1. "Telegram autentifikatsiya muvaffaqiyatsiz"

**Sababi:** HMAC validation muvaffaqiyatsiz

**Yechim:**
```bash
# 1. TELEGRAM_BOT_TOKEN to'g'ri ekanligini tekshiring
echo $TELEGRAM_BOT_TOKEN

# 2. SUPABASE_JWT_SECRET to'g'ri ekanligini tekshiring
# Supabase → Settings → API → JWT Secret

# 3. Auth server logs'ni tekshiring
npm run server:dev
# "Auth server on :3001" ko'rinishi kerak

# 4. Browser DevTools → Network → /auth/telegram
# Response status 401 bo'lsa, HMAC xatosi
```

---

### 2. "Do'kon topilmadi. Avval botda /start bosing."

**Sababi:** Foydalanuvchi `users` jadvalida yo'q

**Yechim:**
```bash
# 1. Telegram'da /start buyrug'ini yuboring
# Bot: "Assalomu alaykum..." javob berishi kerak

# 2. Supabase → Table Editor → users
# Yangi qator ko'rinishi kerak

# 3. Agar yo'q bo'lsa, bot logs'ni tekshiring
npm run bot:dev
# Xatolar ko'rinishi kerak
```

---

### 3. Mini App ochilmaydi

**Sababi:** CORS yoki API URL xatosi

**Yechim:**
```bash
# 1. VITE_API_URL to'g'ri ekanligini tekshiring
# mini-app/.env:
VITE_API_URL=http://localhost:3001

# 2. Auth server CORS sozlamalarini tekshiring
# .env:
ALLOWED_ORIGINS=http://localhost:5173

# 3. Browser DevTools → Console
# CORS xatosi ko'rinishi kerak

# 4. Auth server logs'ni tekshiring
npm run server:dev
```

---

### 4. Nasiya saqlanmaydi

**Sababi:** RLS politikasi yoki JWT xatosi

**Yechim:**
```bash
# 1. JWT telegram_id claim'ini tekshiring
# Browser DevTools → Application → Local Storage
# supabase.auth.token → decode (jwt.io)

# 2. RLS politikalarini tekshiring
# Supabase → SQL Editor:
SELECT * FROM pg_policies WHERE tablename = 'debts';

# 3. business_id to'g'ri ekanligini tekshiring
# Supabase → Table Editor → users
# business_id ko'rinishi kerak

# 4. Supabase logs'ni tekshiring
# Supabase → Logs → Postgres
```

---

### 5. Offline sync ishlamaydi

**Sababi:** IndexedDB yoki online event xatosi

**Yechim:**
```bash
# 1. IndexedDB'ni tekshiring
# Browser DevTools → Application → IndexedDB
# nasiya_offline → pending_debts

# 2. Online event'ni tekshiring
# Browser DevTools → Console:
window.addEventListener("online", () => console.log("Online!"));

# 3. useOfflineSync hook'ni tekshiring
# mini-app/useOfflineSync.ts

# 4. Network tab'da offline mode'ni tekshiring
# DevTools → Network → Offline checkbox
```

---

## 🔍 Debugging Qadamlari

### Bot Debugging

```bash
# 1. Bot logs'ni ko'ring
npm run bot:dev

# 2. Supabase logs'ni ko'ring
# Supabase → Logs → Postgres

# 3. Telegram Bot API status'ni tekshiring
# https://api.telegram.org/bot<TOKEN>/getMe

# 4. Specific user'ni tekshiring
# Supabase → SQL Editor:
SELECT * FROM users WHERE telegram_id = 123456789;
```

### Server Debugging

```bash
# 1. Server logs'ni ko'ring
npm run server:dev

# 2. HMAC validation'ni test qiling
curl -X POST http://localhost:3001/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"initData":"..."}'

# 3. JWT'ni decode qiling
# jwt.io → paste token

# 4. CORS headers'ni tekshiring
# Browser DevTools → Network → Response Headers
```

### Mini App Debugging

```bash
# 1. Browser DevTools → Console
# Xatolar ko'rinishi kerak

# 2. Network tab
# /auth/telegram request'ni tekshiring
# Status 200 bo'lsa, JWT ko'rinishi kerak

# 3. Application tab
# Local Storage → supabase.auth.token
# IndexedDB → nasiya_offline

# 4. Vite dev server logs
# Terminal'da npm run dev
```

---

## 📊 Supabase Debugging

### Users Jadvalini Tekshirish

```sql
-- Barcha foydalanuvchilar
SELECT * FROM users;

-- Specific user
SELECT * FROM users WHERE telegram_id = 123456789;

-- User's business
SELECT u.*, b.name as business_name 
FROM users u
JOIN businesses b ON u.business_id = b.id
WHERE u.telegram_id = 123456789;
```

### Debts Jadvalini Tekshirish

```sql
-- Barcha nasiyalar
SELECT * FROM debts;

-- Ochiq nasiyalar
SELECT * FROM debts WHERE status = 'pending';

-- Specific business'ning nasiyalari
SELECT d.*, c.name as customer_name, b.name as business_name
FROM debts d
JOIN customers c ON d.customer_id = c.id
JOIN businesses b ON d.business_id = b.id
WHERE b.id = 'business-uuid';

-- Muddati o'tgan nasiyalar
SELECT * FROM debts 
WHERE status = 'pending' AND due_date < CURRENT_DATE;
```

### RLS Politikalarini Tekshirish

```sql
-- Barcha RLS politikalari
SELECT * FROM pg_policies;

-- Specific table'ning politikalari
SELECT * FROM pg_policies WHERE tablename = 'debts';

-- RLS enabled tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'debts', 'customers', 'businesses');
```

---

## 🌐 Deployment Debugging

### Render Bot Logs

```bash
# Render Dashboard → nasiya-bot → Logs
# Real-time logs ko'ring

# Agar bot ishlamayotgan bo'lsa:
# 1. Environment variables tekshiring
# 2. Build logs'ni tekshiring
# 3. Restart bosing
```

### Render Auth Server Logs

```bash
# Render Dashboard → nasiya-auth → Logs
# Real-time logs ko'ring

# Agar server ishlamayotgan bo'lsa:
# 1. PORT=3001 tekshiring
# 2. ALLOWED_ORIGINS tekshiring
# 3. Restart bosing
```

### Vercel Mini App Logs

```bash
# Vercel Dashboard → nasiya-daftar → Deployments
# Build logs'ni tekshiring

# Agar build fail bo'lsa:
# 1. Build command tekshiring
# 2. Environment variables tekshiring
# 3. Logs'ni o'qing
```

---

## 🧪 Test Qadamlari

### 1. Bot Test

```bash
# Terminal 1
npm run bot:dev

# Terminal 2 — Telegram'da
/start
# Bot javob berishi kerak

/stats
# Statistika ko'rinishi kerak
```

### 2. Auth Server Test

```bash
# Terminal 1
npm run server:dev

# Terminal 2 — curl
curl -X POST http://localhost:3001/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"initData":"user%3D%7B%22id%22%3A123%7D&auth_date=1234567890&hash=abc"}'

# Response: {"token":"eyJ..."}
```

### 3. Mini App Test

```bash
# Terminal 1
npm run server:dev

# Terminal 2
cd mini-app && npm run dev

# Terminal 3 — Telegram'da
/start
# "📒 Nasiya Daftarini ochish" bosing
# Mini App ochilishi kerak
```

### 4. Offline Test

```bash
# Mini App'da
# 1. DevTools → Network → Offline
# 2. Nasiya qo'shish
# 3. "Saqlanmoqda..." ko'rinishi kerak
# 4. DevTools → Network → Online
# 5. Auto-sync bo'lishi kerak
```

---

## 📋 Checklist

### O'rnatish Oldin
- [ ] Node.js o'rnatilgan
- [ ] Supabase akkaunt yaratilgan
- [ ] Telegram Bot yaratilgan
- [ ] GitHub akkaunt yaratilgan

### Mahalliy Testlash
- [ ] .env fayllar to'ldirilgan
- [ ] Schema Supabase'da ishga tushirilgan
- [ ] Bot ishga tushgan
- [ ] Auth server ishga tushgan
- [ ] Mini App ochilgan
- [ ] /start buyrug'i ishga tushgan
- [ ] Nasiya qo'shish testi o'tgan
- [ ] Offline test o'tgan

### Deployment
- [ ] Render bot deploy qilgan
- [ ] Render auth server deploy qilgan
- [ ] Vercel mini app deploy qilgan
- [ ] Telegram Bot sozlamalari yangilangan
- [ ] WEBAPP_URL yangilangan
- [ ] ALLOWED_ORIGINS yangilangan
- [ ] Production test o'tgan

---

## 📞 Qo'shimcha Yordam

### Logs Fayllarini Tekshirish

```bash
# Bot logs
npm run bot:dev 2>&1 | tee bot.log

# Server logs
npm run server:dev 2>&1 | tee server.log

# Mini App logs
cd mini-app && npm run dev 2>&1 | tee app.log
```

### Environment Variables Tekshirish

```bash
# Root
echo $TELEGRAM_BOT_TOKEN
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
echo $SUPABASE_JWT_SECRET

# Mini App
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
echo $VITE_API_URL
```

### Database Backup

```bash
# Supabase → Settings → Backups
# Automatic backups har kuni
# Manual backup qo'shish mumkin
```

---

**Agar muammo hal bo'lmasa, logs'ni o'qib, xatolarni yozing! 🔍**
