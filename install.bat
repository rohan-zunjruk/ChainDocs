@echo off
title ChainDocs - Install Dependencies
echo.
echo ============================================
echo   ChainDocs - Dependency Installer
echo ============================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Use the LTS version. Then run this script again.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node -v
echo.

REM Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed or not in PATH.
    echo.
    pause
    exit /b 1
)

echo [OK] npm found:
npm -v
echo.

echo Installing all dependencies...
echo.

REM Install dependencies (use --legacy-peer-deps if you hit peer dependency conflicts)
call npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Standard install had issues. Trying with --legacy-peer-deps...
    call npm install --legacy-peer-deps
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Trying with --ignore-scripts to skip post-install scripts...
    call npm install --ignore-scripts
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Installation failed. Check the messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Installation complete!
echo ============================================
echo.
echo To run the project:
echo   npm run dev
echo.
echo Or:
echo   npm start
echo.
echo Then open http://localhost:3000 in your browser.
echo.
pause
