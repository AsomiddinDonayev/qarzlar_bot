# 🚀 Deployment Checklist — Production'ga Chiqish

## ✅ Pre-Deployment Checklist

### 1. Mahalliy Testlash Tugagan
- [ ] Bot `/start` ishga tushgan
- [ ] Bot `/stats` ishga tushgan
- [ ] Mini App ochilgan
- [ ] Nasiya qo'shish testi o'tgan
- [ ] Offline sync testi o'tgan
- [ ] Supabase RLS politikalari tekshirilgan

### 2. Environment Variables Tayyor
- [ ] `TELEGRAM_BOT_TOKEN` — @BotFather'dan
- [ ] `SUPABASE_URL` — Supabase Settings
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase Settings
- [ ] `SUPABASE_JWT_SECRET` — Supabase Settings → API
- [ ] `WEBAPP_URL` — Vercel URL (keyinroq)
- [ ] `ALLOWED_ORIGINS` — Vercel URL (keyinroq)

### 3. GitHub Tayyor
- [ ] Loyiha GitHub'ga push qilgan
- [ ] `.env` fayllar `.gitignore`'da
- [ ] `package-lock.json` commit qilgan

---

## 🔧 Step 1: Render'da Bot Deploy Qilish

### 1.1 Render Akkauntini Yaratish

1. https://render.com ga kiring
2. **Sign up** → GitHub bilan
3. Email verify qiling

### 1.2 Bot Servisini Yaratish

1. Dashboard → **New +** → **Web Service**
2. **Connect a repository** → GitHub repo tanlang
3. **Create Web Service**

### 1.3 Bot Sozlamalarini O'rnatish

```
Name:                nasiya-bot
Environment:         Node
Build Command:       npm install
Start Command:       npm run bot
Plan:                Free
```

### 1.4 Environment Variables Qo'shish

1. **Environment** tab'ni bosing
2. **Add Environment Variable** bosing
3. Quyidagilarni qo'shish:

```
TELEGRAM_BOT_TOKEN=your_token_here
SUPABASE_URL=your_url_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
SUPABASE_JWT_SECRET=your_secret_here
WEBAPP_URL=https://nasiya-daftar.vercel.app (keyinroq)
CRON_TZ=Asia/Tashkent
DEFER_DAYS=3
```

### 1.5 Deploy Qilish

1. **Create Web Service** bosing
2. Deploy qilish 2-3 daqiqa kutish
3. URL nusxalang (masalan: `https://nasiya-bot.onrender.com`)

### 1.6 Logs Tekshirish

```
Render Dashboard → nasiya-bot → Logs
"@your_bot_username is running" ko'rinishi kerak
```

---

## 🔧 Step 2: Render'da Auth Server Deploy Qilish

### 2.1 Auth Server Servisini Yaratish

1. Dashboard → **New +** → **Web Service**
2. **Connect a repository** → GitHub repo tanlang
3. **Create Web Service**

### 2.2 Auth Server Sozlamalarini O'rnatish

```
Name:                nasiya-auth
Environment:         Node
Build Command:       npm install
Start Command:       npm run server
Plan:                Free
```

### 2.3 Environment Variables Qo'shish

```
TELEGRAM_BOT_TOKEN=your_token_here
SUPABASE_URL=your_url_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
SUPABASE_JWT_SECRET=your_secret_here
ALLOWED_ORIGINS=https://nasiya-daftar.vercel.app (keyinroq)
PORT=3001
```

### 2.4 Deploy Qilish

1. **Create Web Service** bosing
2. Deploy qilish 2-3 daqiqa kutish
3. URL nusxalang (masalan: `https://nasiya-auth.onrender.com`)

### 2.5 Logs Tekshirish

```
Render Dashboard → nasiya-auth → Logs
"Auth server on :3001" ko'rinishi kerak
```

---

## 🎨 Step 3: Vercel'da Mini App Deploy Qilish

### 3.1 Vercel Akkauntini Yaratish

1. https://vercel.com ga kiring
2. **Sign up** → GitHub bilan
3. Email verify qiling

### 3.2 Mini App Loyihasi Yaratish

1. Dashboard → **Add New** → **Project**
2. GitHub repo tanlang
3. **Import Project**

### 3.3 Mini App Sozlamalarini O'rnatish

```
Framework Preset:     Vite
Root Directory:       mini-app
Build Command:        npm run build
Output Directory:     dist
```

### 3.4 Environment Variables Qo'shish

1. **Environment Variables** tab'ni bosing
2. Quyidagilarni qo'shish:

```
VITE_SUPABASE_URL=your_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=https://nasiya-auth.onrender.com
```

### 3.5 Deploy Qilish

1. **Deploy** bosing
2. Deploy qilish 1-2 daqiqa kutish
3. URL nusxalang (masalan: `https://nasiya-daftar.vercel.app`)

### 3.6 Deployment Tekshirish

```
Vercel Dashboard → nasiya-daftar → Deployments
Status: "Ready" bo'lishi kerak
```

---

## 🔗 Step 4: Barcha Bog'lanishlarni Yangilash

### 4.1 Render Bot Servisini Yangilash

1. Render Dashboard → **nasiya-bot** → **Environment**
2. `WEBAPP_URL` ni yangilang:
   ```
   https://nasiya-daftar.vercel.app
   ```
3. **Save** bosing (auto-redeploy)

### 4.2 Render Auth Servisini Yangilash

1. Render Dashboard → **nasiya-auth** → **Environment**
2. `ALLOWED_ORIGINS` ni yangilang:
   ```
   https://nasiya-daftar.vercel.app
   ```
3. **Save** bosing (auto-redeploy)

### 4.3 Telegram Bot Sozlamalarini Yangilash

1. Telegram'da **@BotFather** ga yozing
2. `/mybots` → bot tanlang
3. **Bot Settings** → **Menu Button** → **Web App**
4. URL ni yangilang:
   ```
   https://nasiya-daftar.vercel.app
   ```
5. **Save** bosing

---

## ✅ Step 5: Production Test

### 5.1 Bot Test

```bash
# Telegram'da
/start
# Bot javob berishi kerak

/stats
# Statistika ko'rinishi kerak
```

### 5.2 Mini App Test

```bash
# Telegram'da
/start
# "📒 Nasiya Daftarini ochish" bosing
# Mini App ochilishi kerak
```

### 5.3 Nasiya Qo'shish Test

```bash
# Mini App'da
1. Summa: 100000
2. Mijoz: Test Mijoz
3. Telefon: +998901234567
4. Saqlash bosing
5. "Nasiya muvaffaqiyatli saqlandi!" ko'rinishi kerak
```

### 5.4 Supabase Tekshirish

```bash
# Supabase → Table Editor → debts
# Yangi qator ko'rinishi kerak
```

---

## 🔒 Security Checklist

- [ ] `TELEGRAM_BOT_TOKEN` Render'da xavfsiz
- [ ] `SUPABASE_SERVICE_ROLE_KEY` Render'da xavfsiz
- [ ] `SUPABASE_JWT_SECRET` Render'da xavfsiz
- [ ] `.env` fayllar `.gitignore`'da
- [ ] RLS politikalari Supabase'da faol
- [ ] CORS `ALLOWED_ORIGINS` to'g'ri
- [ ] HMAC validation ishga tushgan
- [ ] JWT `telegram_id` claim'i mavjud

---

## 📊 Monitoring

### Render Monitoring

```bash
# Bot logs
Render Dashboard → nasiya-bot → Logs

# Auth server logs
Render Dashboard → nasiya-auth → Logs

# Alerts qo'shish
Settings → Notifications
```

### Vercel Monitoring

```bash
# Mini App logs
Vercel Dashboard → nasiya-daftar → Deployments

# Analytics
Analytics tab
```

### Supabase Monitoring

```bash
# Database logs
Supabase → Logs → Postgres

# API usage
Supabase → Settings → Usage
```

---

## 🔄 Continuous Deployment

### GitHub Push → Auto Deploy

```bash
# 1. Local o'zgarishlar
git add .
git commit -m "Feature: nasiya qo'shish"
git push origin main

# 2. Render auto-redeploy
# Render Dashboard → nasiya-bot → Deployments
# "Building..." ko'rinishi kerak

# 3. Vercel auto-redeploy
# Vercel Dashboard → nasiya-daftar → Deployments
# "Building..." ko'rinishi kerak
```

---

## 🆘 Deployment Muammolari

### Bot Deploy Fail

```bash
# 1. Build logs'ni tekshiring
# Render Dashboard → nasiya-bot → Logs

# 2. Environment variables tekshiring
# Render Dashboard → nasiya-bot → Environment

# 3. package.json tekshiring
# "npm run bot" buyrug'i mavjud bo'lishi kerak

# 4. Restart bosing
# Render Dashboard → nasiya-bot → Manual Deploy
```

### Auth Server Deploy Fail

```bash
# 1. Build logs'ni tekshiring
# Render Dashboard → nasiya-auth → Logs

# 2. PORT=3001 tekshiring
# Render Dashboard → nasiya-auth → Environment

# 3. package.json tekshiring
# "npm run server" buyrug'i mavjud bo'lishi kerak

# 4. Restart bosing
# Render Dashboard → nasiya-auth → Manual Deploy
```

### Mini App Deploy Fail

```bash
# 1. Build logs'ni tekshiring
# Vercel Dashboard → nasiya-daftar → Deployments

# 2. Environment variables tekshiring
# Vercel Dashboard → nasiya-daftar → Settings → Environment Variables

# 3. Root Directory: mini-app tekshiring
# Vercel Dashboard → nasiya-daftar → Settings → General

# 4. Redeploy bosing
# Vercel Dashboard → nasiya-daftar → Deployments → Redeploy
```

---

## 📋 Post-Deployment Checklist

- [ ] Bot Telegram'da ishga tushgan
- [ ] Mini App Telegram'da ochilgan
- [ ] Nasiya qo'shish testi o'tgan
- [ ] Supabase'da data ko'ringan
- [ ] Render logs'da xatolar yo'q
- [ ] Vercel logs'da xatolar yo'q
- [ ] HTTPS barcha URL'larda
- [ ] CORS xatolar yo'q
- [ ] RLS politikalari faol
- [ ] Backup sozlamalari tekshirilgan

---

## 🎉 Tayyor!

Endi loyihangiz production'da ishga tushgan! 🚀

**Keyingi qadamlar:**
1. Foydalanuvchilarni taklif qiling
2. Feedback olish
3. Xatolarni tuzatish
4. Yangi xususiyatlar qo'shish

---

**Omad! 🎊**
