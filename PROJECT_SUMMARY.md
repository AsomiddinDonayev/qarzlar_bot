# 📋 Nasiya Daftari — To'liq Loyiha Xulasasi

## ✅ Nima Qilindi?

### 1. **Multi-Tenant Database Schema** ✓
- 7 ta jadval: `businesses`, `users`, `households`, `customers`, `debts`, `payments`, `notebook_photos`
- Row Level Security (RLS) — har bir foydalanuvchi faqat o'z business'iga kiradi
- RBAC — `owner` va `manager` rollari
- Avtomatik trigger — to'lov qabul qilinganda nasiya avtomatik "paid" bo'ladi

### 2. **Telegram Bot** ✓
- `/start` — foydalanuvchini ro'yxatdan o'tkazish
- `/stats` — statistika ko'rsatish
- Callback buttons — ✅ Pulni oldim / ⏳ Surish
- Kunlik cron reminders — muddati o'tgan nasiyalar haqida eslatma
- Multi-tenant — har bir foydalanuvchi o'z business'ining nasiyalarini ko'radi

### 3. **HMAC-SHA256 Auth Server** ✓
- Telegram `initData` validation
- JWT signing — `telegram_id` claim bilan
- CORS protected
- Supabase RLS bilan integratsiya

### 4. **React Mini App** ✓
- Vite + TypeScript + Tailwind CSS
- Tezkor nasiya kiritish — 3 bosish
- Offline-first — IndexedDB queue
- Auto-sync — internet qaytganda avtomatik sync
- Responsive design — mobil-optimized

### 5. **Deployment Setup** ✓
- Render — Bot + Auth Server
- Vercel — Mini App
- Supabase — Database
- Zero-cost stack

---

## 📁 Loyiha Tuzilmasi

```
Nasiya daftar 2/
├── 📄 README.md                    # Umumiy ma'lumot
├── 📄 SETUP.md                     # To'liq o'rnatish qo'llanmasi
├── 📄 DEPLOYMENT.md                # Production deploy
├── 📄 TROUBLESHOOTING.md           # Muammolarni hal qilish
├── 📄 QUICK_REFERENCE.md           # Tezkor havolalar
│
├── 🤖 bot.ts                       # Telegram Bot (grammY)
├── 📦 server/
│   └── index.ts                    # Auth Server (Express + HMAC)
│
├── 📱 mini-app/
│   ├── index.html                  # Vite entry
│   ├── main.tsx                    # React root
│   ├── App.tsx                     # Auth flow
│   ├── FastDebtEntryScreen.tsx     # UI component
│   ├── api.ts                      # HMAC validation
│   ├── db.ts                       # Supabase client
│   ├── useOfflineSync.ts           # Offline queue
│   ├── index.css                   # Tailwind
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── 🗄️ supabase/
│   └── schema.sql                  # Multi-tenant schema
│
├── 📦 package.json                 # Root dependencies
├── 🔧 setup.sh                     # Linux/Mac setup
├── 🔧 setup.bat                    # Windows setup
└── .env.example                    # Environment template
```

---

## 🚀 Ishga Tushirish (5 Daqiqa)

### 1️⃣ Supabase Yaratish
```bash
https://supabase.com → New Project
Kalitlarni nusxalang
```

### 2️⃣ Telegram Bot Yaratish
```bash
Telegram: @BotFather → /newbot
Token nusxalang
```

### 3️⃣ Loyihani O'rnatish
```bash
# Windows
setup.bat

# Linux/Mac
bash setup.sh
```

### 4️⃣ .env Fayllarini To'ldirish
```bash
# Root .env
TELEGRAM_BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...

# mini-app/.env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:3001
```

### 5️⃣ Schema Ishga Tushirish
```bash
Supabase → SQL Editor
supabase/schema.sql kodi nusxalang
Run bosing
```

### 6️⃣ Mahalliy Testlash
```bash
# Terminal 1
npm run bot:dev

# Terminal 2
npm run server:dev

# Terminal 3
cd mini-app && npm run dev
```

### 7️⃣ Telegram'da Test
```bash
/start
"📒 Nasiya Daftarini ochish" bosing
Mini App ochilishi kerak
```

---

## 🌐 Production Deploy

### Render'da Bot
```bash
1. Render.com → New Web Service
2. GitHub repo tanlang
3. Build: npm install
4. Start: npm run bot
5. Environment variables qo'shish
6. Deploy
```

### Render'da Auth Server
```bash
1. Render.com → New Web Service
2. GitHub repo tanlang
3. Build: npm install
4. Start: npm run server
5. Environment variables qo'shish
6. Deploy
```

### Vercel'da Mini App
```bash
1. Vercel.com → New Project
2. GitHub repo tanlang
3. Root Directory: mini-app
4. Build: npm run build
5. Environment variables qo'shish
6. Deploy
```

---

## 🔐 Xavfsizlik

### HMAC-SHA256 Validation
```
Telegram Mini App
    ↓ initData
Auth Server
    ↓ HMAC-SHA256 verify
    ↓ JWT sign
Supabase RLS
    ↓ Filter by business_id
Database
```

### Row Level Security
```sql
-- Har bir foydalanuvchi faqat o'z business'iga kiradi
CREATE POLICY customers_select ON customers FOR SELECT TO authenticated
  USING (business_id = auth_business_id());
```

### Multi-Tenancy
```
businesses (id, name)
    ↓
users (telegram_id, business_id, role)
    ↓
customers (business_id, name)
    ↓
debts (business_id, customer_id, amount)
```

---

## 📱 Offline Ishlash

### IndexedDB Queue
```typescript
// Internet yo'q bo'lsa
await queueDebt({ business_id, customer_id, amount, due_date });

// Online bo'lsa
window.addEventListener("online", () => flushQueue());
```

### Auto-Sync
```
Offline → Queue in IndexedDB
    ↓
User goes online
    ↓
Auto-flush to Supabase
    ↓
Success → Remove from queue
```

---

## 🧪 Testing

### Bot Test
```bash
Telegram'da:
/start
/stats
Callback buttons
```

### Mini App Test
```bash
1. /start bosing
2. "📒 Nasiya Daftarini ochish" bosing
3. Nasiya qo'shish
4. Supabase'da tekshirish
```

### Offline Test
```bash
1. DevTools → Network → Offline
2. Nasiya qo'shish
3. DevTools → Network → Online
4. Auto-sync bo'lishi kerak
```

---

## 📊 Supabase Jadvallar

| Jadval | Ustunlar | Tavsif |
|--------|----------|--------|
| `businesses` | id, name, phone, trial_ends_at | Biznes |
| `users` | telegram_id, business_id, role, full_name | Foydalanuvchi |
| `customers` | id, business_id, name, phone, max_debt_limit | Mijoz |
| `debts` | id, business_id, customer_id, amount, due_date, status | Nasiya |
| `payments` | id, business_id, debt_id, amount_paid, payment_type | To'lov |
| `households` | id, business_id, name | Oila/Guruh |
| `notebook_photos` | id, business_id, image_url | Rasm backup |

---

## 🛠 Texnologiyalar

| Qism | Texnologiya |
|------|-------------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express + grammY |
| Database | Supabase PostgreSQL + RLS |
| Auth | HMAC-SHA256 + JWT |
| Offline | IndexedDB + Service Worker |
| Deploy | Vercel + Render + Supabase |

---

## 📚 Dokumentatsiya

| Fayl | Tavsif |
|------|--------|
| `README.md` | Umumiy ma'lumot va arxitektura |
| `SETUP.md` | To'liq o'rnatish qo'llanmasi |
| `DEPLOYMENT.md` | Production deploy checklist |
| `TROUBLESHOOTING.md` | Muammolarni hal qilish |
| `QUICK_REFERENCE.md` | Tezkor havolalar |

---

## 🎯 Keyingi Qadamlar

### Mahalliy Testlash
1. `SETUP.md` o'qing
2. `setup.bat` yoki `setup.sh` ishga tushiring
3. `.env` fayllarini to'ldiring
4. Schema Supabase'da ishga tushiring
5. `npm run dev` bosing
6. Telegram'da test qiling

### Production Deploy
1. `DEPLOYMENT.md` o'qing
2. Render'da bot deploy qiling
3. Render'da auth server deploy qiling
4. Vercel'da mini app deploy qiling
5. Telegram Bot sozlamalarini yangilang
6. Production test qiling

### Muammolar
1. `TROUBLESHOOTING.md` o'qing
2. Logs'ni tekshiring
3. Environment variables tekshiring
4. Supabase RLS tekshiring

---

## 🎓 Qo'shimcha Resurslar

- **Supabase Docs:** https://supabase.com/docs
- **Telegram Bot API:** https://core.telegram.org/bots
- **grammY Docs:** https://grammy.dev
- **React Docs:** https://react.dev
- **Vite Docs:** https://vitejs.dev
- **Tailwind CSS:** https://tailwindcss.com

---

## 🆘 Yordam

Agar muammo bo'lsa:
1. `TROUBLESHOOTING.md` o'qing
2. Logs'ni tekshiring
3. Environment variables tekshiring
4. Supabase SQL Editor'da schema'ni tekshiring

---

## 📞 Kontakt

Agar savollar bo'lsa, logs'ni o'qib xatolarni yozing! 🔍

---

## 🎉 Tayyor!

Endi loyihangiz ishga tushgan! 🚀

**Omad! 🎊**

---

**Yaratilgan:** 2024  
**Versiya:** 1.0  
**Status:** Production Ready ✅
