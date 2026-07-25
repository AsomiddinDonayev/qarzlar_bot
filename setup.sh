#!/bin/bash
# Quick Setup Script for Nasiya Daftari

echo "🚀 Nasiya Daftari — Tezkor O'rnatish"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js o'rnatilmagan. https://nodejs.org dan o'rnating"
    exit 1
fi

echo "✅ Node.js topildi: $(node --version)"
echo ""

# Create root .env if not exists
if [ ! -f .env ]; then
    echo "📝 Root .env fayli yaratilmoqda..."
    cat > .env << 'EOF'
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

# URLs
WEBAPP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173

# Optional
CRON_SCHEDULE=0 9 * * *
CRON_TZ=Asia/Tashkent
DEFER_DAYS=3
PORT=3001
EOF
    echo "✅ .env yaratildi. Kalitlarni to'ldiring!"
else
    echo "✅ .env allaqachon mavjud"
fi

echo ""

# Create mini-app .env if not exists
if [ ! -f mini-app/.env ]; then
    echo "📝 mini-app/.env fayli yaratilmoqda..."
    cat > mini-app/.env << 'EOF'
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=http://localhost:3001
EOF
    echo "✅ mini-app/.env yaratildi. Kalitlarni to'ldiring!"
else
    echo "✅ mini-app/.env allaqachon mavjud"
fi

echo ""

# Install root dependencies
echo "📦 Root dependencies o'rnatilmoqda..."
npm install --silent

echo ""

# Install mini-app dependencies
echo "📦 Mini-app dependencies o'rnatilmoqda..."
cd mini-app
npm install --silent
cd ..

echo ""
echo "✅ O'rnatish tugadi!"
echo ""
echo "📖 Keyingi qadamlar:"
echo "1. .env va mini-app/.env fayllarini to'ldiring"
echo "2. Supabase schema'ni SQL Editor'da ishga tushiring"
echo "3. npm run dev buyrug'ini yuboring"
echo ""
echo "Batafsil: SETUP.md faylini o'qing"
