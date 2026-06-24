@echo off
title Ethiopian Payroll System - Stop Server
color 0C

echo ========================================
echo 🇪🇹 ETHIOPIAN PAYROLL SYSTEM
echo Server Stop Utility
echo ========================================
echo.

echo 🔍 Checking for running server...

REM Check if server is running on port 8080
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ No server found running on port 8080
    echo.
    pause
    exit /b 0
)

echo ✅ Server found running on port 8080
echo.

REM Find and kill Node.js processes running simple-server.js
echo 🛑 Stopping Ethiopian Payroll Server...

REM Method 1: Kill by window title
taskkill /FI "WINDOWTITLE eq Ethiopian Payroll Server" /F >nul 2>&1

REM Method 2: Kill Node.js processes using port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Verify server is stopped
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% neq 0 (
    echo ✅ Server stopped successfully
    echo.
    echo 📋 Ethiopian Payroll System is now offline
    echo - Port 8080 is now available
    echo - All user sessions have been terminated
    echo.
) else (
    echo ⚠️  Server may still be running
    echo.
    echo If the server is still running:
    echo 1. Close the "Ethiopian Payroll Server" window manually
    echo 2. Or restart your computer
    echo.
)

echo ========================================
echo 🛑 STOP OPERATION COMPLETE
echo ========================================
echo.
pause