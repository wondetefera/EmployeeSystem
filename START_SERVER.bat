@echo off
title Ethiopian Payroll System - Server
color 0A

echo ========================================
echo 🇪🇹 ETHIOPIAN PAYROLL SYSTEM SERVER
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if server file exists
if not exist "simple-server.js" (
    echo ❌ ERROR: simple-server.js not found
    echo Please run this from the correct directory
    pause
    exit /b 1
)

echo ✅ Starting Ethiopian Payroll System...
echo.
echo 📋 Server Configuration:
echo - Host: 10.192.230.251
echo - Port: 8080
echo - Network Access: ENABLED
echo.
echo 🌐 Access URLs:
echo - Local:   http://localhost:8080
echo - Network: http://10.192.230.251:8080
echo.
echo 🔐 Admin Login:
echo - Email:    abebe.kebede@company.com
echo - Password: admin123
echo.
echo ========================================
echo 🚀 SERVER STARTING...
echo ========================================
echo.

REM Start the Node.js server
node simple-server.js

REM If we reach here, the server has stopped
echo.
echo ========================================
echo 🛑 SERVER STOPPED
echo ========================================
echo.
pause