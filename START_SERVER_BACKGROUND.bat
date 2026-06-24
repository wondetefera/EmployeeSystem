@echo off
title Ethiopian Payroll System - Background Service
color 0A

echo ========================================
echo 🇪🇹 ETHIOPIAN PAYROLL SYSTEM
echo Background Service Launcher
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

REM Check if server is already running
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Server appears to be already running on port 8080
    echo.
    choice /C YN /M "Do you want to continue anyway"
    if errorlevel 2 exit /b 0
)

echo ✅ Starting Ethiopian Payroll System in background...
echo.

REM Start server in background (minimized window)
start "Ethiopian Payroll Server" /min node simple-server.js

REM Wait a moment for server to start
timeout /t 3 /nobreak >nul

REM Test if server started successfully
echo 🔍 Testing server connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080' -TimeoutSec 5 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host '✅ Server started successfully' -ForegroundColor Green } else { Write-Host '⚠️  Server may still be starting...' -ForegroundColor Yellow } } catch { Write-Host '❌ Server failed to start' -ForegroundColor Red }"

echo.
echo ========================================
echo ✅ ETHIOPIAN PAYROLL SYSTEM READY
echo ========================================
echo.
echo 📋 Server Information:
echo - Status: Running in background
echo - Host: 10.192.230.251
echo - Port: 8080
echo.
echo 🌐 Access URLs:
echo - Local Access:   http://localhost:8080
echo - Network Access: http://10.192.230.251:8080
echo - Login Page:     http://localhost:8080/login
echo.
echo 🔐 Login Credentials:
echo - Admin Email:    abebe.kebede@company.com
echo - Admin Password: admin123
echo.
echo 📝 Instructions:
echo 1. Server is now running in a background window
echo 2. Access the system using the URLs above
echo 3. To stop the server, run STOP_SERVER.bat
echo 4. Or close the "Ethiopian Payroll Server" window
echo.
echo ⚠️  Keep the server window open while using the system
echo.

REM Ask if user wants to open browser
choice /C YN /M "Do you want to open the system in your browser now"
if errorlevel 2 goto :end

echo.
echo 🌍 Opening system in browser...
start http://localhost:8080

:end
echo.
echo ========================================
echo 👋 Setup Complete!
echo ========================================
echo.
echo The Ethiopian Payroll System is now running.
echo You can close this window safely.
echo.
pause