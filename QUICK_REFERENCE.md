# ⚡ Tezkor Havolalar (Quick Reference)

## 🚀 Mahalliy Ishga Tushirish (3 Terminal)

```bash
# Terminal 1 — Bot
npm run bot:dev

# Terminal 2 — Auth Server
npm run server:dev

# Terminal 3 — Mini App
cd mini-app && npm run dev
```

**URLs:**
- Mini App: http://localhost:5173
- Auth Server: http://localhost:3001
- Bot: Telegram @your_bot_username

---

## 📝 Environment Variables

### Root `.env`
```bash
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
SUPABASE_JWT_SECRET=your_secret
WEBAPP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
CRON_TZ=Asia/Tashkent
DEFER_DAYS=3
PORT=3001
```

### Mini App `mini-app/.env`
```bash
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001
```

---

## 🔗 Deployment URLs

| Servis | URL | Deploy |
|--------|-----|--------|
| Bot | https://nasiya-bot.onrender.com | Render |
| Auth | https://nasiya-auth.onrender.com | Render |
| Mini App | https://nasiya-daftar.vercel.app | Vercel |

---

## 📊 Supabase SQL Queries

### Foydalanuvchilar
```sql
SELECT * FROM users;
SELECT * FROM users WHERE telegram_id = 123456789;
```

### Nasiyalar
```sql
SELECT * FROM debts;
SELECT * FROM debts WHERE status = 'pending';
SELECT * FROM debts WHERE due_date < CURRENT_DATE AND status = 'pending';
```

### Mijozlar
```sql
SELECT * FROM customers;
SELECT * FROM customers WHERE business_id = 'uuid';
```

### Statistika
```sql
SELECT 
  COUNT(DISTINCT c.id) as customers,
  COUNT(DISTINCT d.id) as debts,
  SUM(d.amount) as total_debt
FROM customers c
LEFT JOIN debts d ON c.id = d.customer_id AND d.status = 'pending';
```

---

## 🤖 Telegram Bot Buyruqlari

| Buyruq | Tavsif |
|--------|--------|
| `/start` | Foydalanuvchini ro'yxatdan o'tkazish |
| `/stats` | Statistika ko'rsatish |
| Callback | ✅ Pulni oldim / ⏳ Surish |

---

## 🧪 Test Qadamlari

### 1. Bot Test
```bash
# Telegram'da
/start
# Bot javob berishi kerak

/stats
# Statistika ko'rinishi kerak
```

### 2. Mini App Test
```bash
# Telegram'da
/start
# "📒 Nasiya Daftarini ochish" bosing
# Mini App ochilishi kerak
```

### 3. Nasiya Qo'shish Test
```bash
# Mini App'da
Summa: 50000
Mijoz: Test
Telefon: +998901234567
Saqlash bosing
# "Nasiya muvaffaqiyatli saqlandi!" ko'rinishi kerak
```

### 4. Offline Test
```bash
# DevTools → Network → Offline
# Nasiya qo'shish
# DevTools → Network → Online
# Auto-sync bo'lishi kerak
```

---

## 🔧 Debugging Commands

```bash
# Bot logs
npm run bot:dev 2>&1 | tee bot.log

# Server logs
npm run server:dev 2>&1 | tee server.log

# Mini App logs
cd mini-app && npm run dev 2>&1 | tee app.log

# Environment variables
echo $TELEGRAM_BOT_TOKEN
echo $SUPABASE_URL
echo $SUPABASE_JWT_SECRET
```

---

## 📱 Browser DevTools

### Console
```javascript
// Telegram user
window.Telegram?.WebApp?.initDataUnsafe?.user

// JWT token
localStorage.getItem('supabase.auth.token')

// Online status
navigator.onLine

// IndexedDB
indexedDB.databases()
```

### Network
- `/auth/telegram` — HMAC validation
- `/rest/v1/debts` — Supabase API

### Application
- **Local Storage** → supabase.auth.token
- **IndexedDB** → nasiya_offline → pending_debts

---

## 🚀 Deploy Commands

### Render
```bash
# Bot
git push origin main
# Render auto-redeploy

# Auth Server
git push origin main
# Render auto-redeploy
```

### Vercel
```bash
# Mini App
git push origin main
# Vercel auto-redeploy
```

---

## 🔐 Security Checklist

- [ ] BOT_TOKEN xavfsiz
- [ ] SERVICE_ROLE_KEY xavfsiz
- [ ] JWT_SECRET xavfsiz
- [ ] .env .gitignore'da
- [ ] RLS faol
- [ ] CORS to'g'ri
- [ ] HMAC validation ishga tushgan

---

## 📞 Yordam Havolalari

| Muammo | Havolasi |
|--------|----------|
| Supabase | https://supabase.com |
| Telegram Bot | https://core.telegram.org/bots |
| Render | https://render.com |
| Vercel | https://vercel.com |
| grammY | https://grammy.dev |
| React | https://react.dev |

---

## 📚 Dokumentatsiya Fayllar

| Fayl | Tavsif |
|------|--------|
| `README.md` | Umumiy ma'lumot |
| `SETUP.md` | To'liq o'rnatish |
| `DEPLOYMENT.md` | Production deploy |
| `TROUBLESHOOTING.md` | Muammolarni hal qilish |
| `QUICK_REFERENCE.md` | Bu fayl |

---

## 🎯 Keyingi Qadamlar

1. **Mahalliy Testlash** → SETUP.md
2. **Production Deploy** → DEPLOYMENT.md
3. **Muammolar** → TROUBLESHOOTING.md
4. **Kod Tahlili** → README.md

---

**Omad! 🚀**
