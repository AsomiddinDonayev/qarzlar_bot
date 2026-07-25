# 📒 Nasiya Daftari — Multi-Tenant SaaS Platform

**Telegram Bot + Mini App** — Uzbek micro-merchants uchun qarz boshqaruv tizimi.

> **Zero-cost stack:** Supabase Free + Vercel + Render  
> **Offline-first:** IndexedDB queue + auto-sync  
> **HMAC-secured:** Telegram initData validation  
> **Multi-tenant:** Strict business_id isolation + RLS

---

## 🎯 Xususiyatlar

✅ **Tezkor Nasiya Kiritish** — 3 bosish bilan nasiya qo'shish  
✅ **Offline Ishlash** — Internet yo'q bo'lsa ham saqlash  
✅ **Avtomatik Eslatmalar** — Kunlik cron reminders  
✅ **Multi-User** — Owner + Manager roles  
✅ **Xavfsiz** — HMAC-SHA256 + RLS  
✅ **Mobil-First** — Telegram Mini App  

---

## 🏗 Arxitektura

```
┌─────────────────────────────────────────────────────────┐
│                   Telegram Bot (@BotFather)             │
│  • /start — foydalanuvchi ro'yxatdan o'tish             │
│  • /stats — statistika                                  │
│  • Callback buttons — to'lov/surish                     │
│  • Cron reminders — kunlik eslatmalar                   │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│ Render Bot   │   │ Render Auth      │
│ (grammY)     │   │ (Express)        │
│              │   │ • HMAC validate  │
│              │   │ • JWT sign       │
└──────────────┘   └────────┬─────────┘
        │                   │
        └───────────┬───────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Supabase PostgreSQL  │
        │  • businesses         │
        │  • users (RBAC)       │
        │  • customers          │
        │  • debts              │
        │  • payments           │
        │  • RLS policies       │
        └───────────────────────┘
                    ▲
                    │
        ┌───────────┴──────────┐
        │                      │
        ▼                      ▼
┌──────────────────┐  ┌──────────────────┐
│ Vercel Mini App  │  │ Browser IndexedDB│
│ (React + Vite)   │  │ (Offline queue)  │
│ • Debt entry     │  │ • Auto-sync      │
│ • Offline sync   │  │ • Background     │
└──────────────────┘  └──────────────────┘
```

---

## 📁 Loyiha Tuzilmasi

```
Nasiya daftar 2/
├── bot.ts                    # Telegram Bot (grammY)
├── server/
│   └── index.ts              # Auth Server (Express + HMAC)
├── mini-app/
│   ├── index.html            # Vite entry
│   ├── main.tsx              # React root
│   ├── App.tsx               # Auth flow + debt submit
│   ├── FastDebtEntryScreen.tsx # UI component
│   ├── api.ts                # HMAC validation client
│   ├── db.ts                 # Supabase client
│   ├── useOfflineSync.ts     # IndexedDB hook
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── supabase/
│   └── schema.sql            # Multi-tenant DB schema
├── package.json              # Root dependencies
├── SETUP.md                  # To'liq o'rnatish qo'llanmasi
├── README.md                 # Bu fayl
├── setup.sh                  # Linux/Mac setup
└── setup.bat                 # Windows setup
```

---

## 🚀 Tezkor Boshlash (5 daqiqa)

### 1️⃣ Supabase Yaratish

```bash
# https://supabase.com
# New Project → nasiya-daftar
# Settings → API → Kalitlarni nusxalang
```

### 2️⃣ Telegram Bot Yaratish

```bash
# Telegram: @BotFather
# /newbot → nasiya_daftar_bot
# Token nusxalang
```

### 3️⃣ Loyihani O'rnatish

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
bash setup.sh
```

### 4️⃣ .env Fayllarini To'ldirish

```bash
# Root .env
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
SUPABASE_JWT_SECRET=your_secret
WEBAPP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

```bash
# mini-app/.env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001
```

### 5️⃣ Supabase Schema Ishga Tushirish

```bash
# Supabase → SQL Editor → New Query
# supabase/schema.sql kodi nusxalang
# Run bosing
```

### 6️⃣ Mahalliy Testlash

**Terminal 1:**
```bash
npm run bot:dev
```

**Terminal 2:**
```bash
npm run server:dev
```

**Terminal 3:**
```bash
cd mini-app && npm run dev
```

### 7️⃣ Telegram'da Test

```
1. Telegram'da o'z botingizni toping
2. /start bosing
3. "📒 Nasiya Daftarini ochish" tugmasini bosing
4. Mini App ochilishi kerak
5. Nasiya qo'shish testi
```

---

## 🌐 Production Deploy

### Render'da Bot + Auth Server

```bash
# 1. GitHub'ga push qiling
# 2. Render.com → New Web Service
# 3. GitHub repo tanlang
# 4. Environment variables qo'shish
# 5. Deploy
```

### Vercel'da Mini App

```bash
# 1. GitHub'ga push qiling
# 2. Vercel.com → New Project
# 3. GitHub repo tanlang
# 4. Root Directory: mini-app
# 5. Environment variables qo'shish
# 6. Deploy
```

### Telegram Bot Sozlamalari

```bash
# @BotFather
# /mybots → bot tanlang
# Bot Settings → Menu Button → Web App
# URL: https://your-mini-app.vercel.app
```

---

## 🔐 Xavfsizlik

### HMAC-SHA256 Validation

```
Telegram Mini App
    ↓ initData
Auth Server (Render)
    ↓ HMAC-SHA256 verify
    ↓ JWT sign (telegram_id claim)
Supabase RLS
    ↓ Filter by business_id
Database
```

### Row Level Security (RLS)

```sql
-- Har bir foydalanuvchi faqat o'z business'iga kiradi
CREATE POLICY customers_select ON customers FOR SELECT TO authenticated
  USING (business_id = auth_business_id());
```

### Multi-Tenancy

```
businesses (id, name, phone)
    ↓
users (telegram_id, business_id, role)
    ↓
customers (business_id, name, phone)
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

## 🛠 Mahalliy Ishlab Chiqish

### Hot Reload

```bash
npm run bot:dev      # tsx watch
npm run server:dev   # tsx watch
cd mini-app && npm run dev  # Vite
```

### Debugging

```bash
# Bot logs
npm run bot:dev

# Server logs
npm run server:dev

# Mini App DevTools
F12 → Console
```

### Database

```bash
# Supabase SQL Editor
SELECT * FROM debts;
SELECT * FROM users;
SELECT * FROM customers;
```

---

## 📊 Supabase Jadvallar

### businesses
```sql
id (UUID)
name (VARCHAR)
phone (VARCHAR)
card_number (VARCHAR)
trial_ends_at (TIMESTAMPTZ)
created_at (TIMESTAMPTZ)
```

### users
```sql
telegram_id (BIGINT) — PRIMARY KEY
business_id (UUID) — FOREIGN KEY
role (VARCHAR) — 'owner' | 'manager'
full_name (VARCHAR)
created_at (TIMESTAMPTZ)
```

### customers
```sql
id (UUID)
business_id (UUID)
household_id (UUID)
name (VARCHAR)
phone (VARCHAR)
max_debt_limit (NUMERIC)
created_at (TIMESTAMPTZ)
```

### debts
```sql
id (UUID)
business_id (UUID)
customer_id (UUID)
amount (NUMERIC)
note (TEXT)
due_date (DATE)
status (VARCHAR) — 'pending' | 'paid'
created_at (TIMESTAMPTZ)
```

### payments
```sql
id (UUID)
business_id (UUID)
debt_id (UUID)
amount_paid (NUMERIC)
payment_type (VARCHAR) — 'cash' | 'card'
created_at (TIMESTAMPTZ)
```

---

## 🐛 Muammolar va Yechimlar

| Muammo | Yechim |
|--------|--------|
| "Telegram autentifikatsiya muvaffaqiyatsiz" | TELEGRAM_BOT_TOKEN va SUPABASE_JWT_SECRET tekshiring |
| "Do'kon topilmadi" | Telegram'da /start bosing |
| Mini App ochilmaydi | VITE_API_URL va CORS tekshiring |
| Nasiya saqlanmaydi | RLS politikalarini tekshiring |
| Offline sync ishlamaydi | IndexedDB va online event tekshiring |

---

## 📚 Batafsil Qo'llanma

👉 **[SETUP.md](./SETUP.md)** — To'liq o'rnatish qo'llanmasi

---

## 🎓 Texnologiyalar

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + grammY
- **Database:** Supabase PostgreSQL + RLS
- **Auth:** HMAC-SHA256 + JWT
- **Offline:** IndexedDB + Service Worker
- **Deploy:** Vercel + Render + Supabase

---

## 📝 Litsenziya

MIT

---

## 👨‍💻 Muallif

Nasiya Daftari Team

---

## 🤝 Hissa Qo'shish

Pull requests qabul qilinadi! 🚀

---

**Omad! 🎉**
