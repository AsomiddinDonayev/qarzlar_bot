@echo off
REM Quick Setup Script for Nasiya Daftari (Windows)

echo.
echo 🚀 Nasiya Daftari — Tezkor O'rnatish
echo ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js o'rnatilmagan. https://nodejs.org dan o'rnating
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js topildi: %NODE_VERSION%
echo.

REM Create root .env if not exists
if not exist .env (
    echo 📝 Root .env fayli yaratilmoqda...
    (
        echo # Telegram Bot
        echo TELEGRAM_BOT_TOKEN=your_bot_token_here
        echo.
        echo # Supabase
        echo SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
        echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
        echo SUPABASE_JWT_SECRET=your_jwt_secret_here
        echo.
        echo # URLs
        echo WEBAPP_URL=http://localhost:5173
        echo ALLOWED_ORIGINS=http://localhost:5173
        echo.
        echo # Optional
        echo CRON_SCHEDULE=0 9 * * *
        echo CRON_TZ=Asia/Tashkent
        echo DEFER_DAYS=3
        echo PORT=3001
    ) > .env
    echo ✅ .env yaratildi. Kalitlarni to'ldiring!
) else (
    echo ✅ .env allaqachon mavjud
)

echo.

REM Create mini-app .env if not exists
if not exist mini-app\.env (
    echo 📝 mini-app\.env fayli yaratilmoqda...
    (
        echo VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
        echo VITE_SUPABASE_ANON_KEY=your_anon_key_here
        echo VITE_API_URL=http://localhost:3001
    ) > mini-app\.env
    echo ✅ mini-app\.env yaratildi. Kalitlarni to'ldiring!
) else (
    echo ✅ mini-app\.env allaqachon mavjud
)

echo.

REM Install root dependencies
echo 📦 Root dependencies o'rnatilmoqda...
call npm install

echo.

REM Install mini-app dependencies
echo 📦 Mini-app dependencies o'rnatilmoqda...
cd mini-app
call npm install
cd ..

echo.
echo ✅ O'rnatish tugadi!
echo.
echo 📖 Keyingi qadamlar:
echo 1. .env va mini-app\.env fayllarini to'ldiring
echo 2. Supabase schema'ni SQL Editor'da ishga tushiring
echo 3. npm run dev buyrug'ini yuboring
echo.
echo Batafsil: SETUP.md faylini o'qing
echo.
pause
