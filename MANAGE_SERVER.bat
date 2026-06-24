@echo off
title Ethiopian Payroll System - Server Manager
color 0B

:menu
cls
echo ========================================
echo 🇪🇹 ETHIOPIAN PAYROLL SYSTEM
echo Server Management Console
echo ========================================
echo.

REM Check current server status
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% equ 0 (
    echo 📊 Current Status: 🟢 SERVER RUNNING
    echo 📍 Port 8080: ACTIVE
    echo 🌐 Access: http://localhost:8080
) else (
    echo 📊 Current Status: 🔴 SERVER STOPPED
    echo 📍 Port 8080: AVAILABLE
    echo 🌐 Access: NOT AVAILABLE
)

echo.
echo ========================================
echo 📋 MANAGEMENT OPTIONS
echo ========================================
echo.
echo [1] Start Server (Background)
echo [2] Start Server (Foreground)
echo [3] Stop Server
echo [4] Restart Server
echo [5] Check Server Status
echo [6] Open System in Browser
echo [7] View Server Logs
echo [8] Add Firewall Rule
echo [9] Exit
echo.

set /p choice="Select an option (1-9): "

if "%choice%"=="1" goto start_background
if "%choice%"=="2" goto start_foreground
if "%choice%"=="3" goto stop_server
if "%choice%"=="4" goto restart_server
if "%choice%"=="5" goto check_status
if "%choice%"=="6" goto open_browser
if "%choice%"=="7" goto view_logs
if "%choice%"=="8" goto add_firewall
if "%choice%"=="9" goto exit
goto menu

:start_background
echo.
echo 🚀 Starting server in background...
start "Ethiopian Payroll Server" /min node simple-server.js
timeout /t 3 /nobreak >nul
echo ✅ Server started in background
pause
goto menu

:start_foreground
echo.
echo 🚀 Starting server in foreground...
echo Press Ctrl+C to stop the server
echo.
node simple-server.js
pause
goto menu

:stop_server
echo.
echo 🛑 Stopping server...
taskkill /FI "WINDOWTITLE eq Ethiopian Payroll Server" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo ✅ Server stopped
pause
goto menu

:restart_server
echo.
echo 🔄 Restarting server...
echo 🛑 Stopping current server...
taskkill /FI "WINDOWTITLE eq Ethiopian Payroll Server" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 3 /nobreak >nul
echo 🚀 Starting new server...
start "Ethiopian Payroll Server" /min node simple-server.js
timeout /t 3 /nobreak >nul
echo ✅ Server restarted
pause
goto menu

:check_status
echo.
echo 🔍 Checking server status...
echo.
netstat -an | findstr ":8080"
if %errorlevel% equ 0 (
    echo ✅ Server is running on port 8080
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080' -TimeoutSec 5 -UseBasicParsing; Write-Host '✅ Server is responding' -ForegroundColor Green } catch { Write-Host '❌ Server not responding' -ForegroundColor Red }"
) else (
    echo ❌ No server found on port 8080
)
echo.
pause
goto menu

:open_browser
echo.
echo 🌍 Opening system in browser...
start http://localhost:8080
pause
goto menu

:view_logs
echo.
echo 📋 Server logs are displayed in the server window
echo Look for the "Ethiopian Payroll Server" window
echo.
pause
goto menu

:add_firewall
echo.
echo 🔥 Adding Windows Firewall rule...
echo This requires Administrator privileges
echo.
netsh advfirewall firewall add rule name="Ethiopian Payroll System Port 8080" dir=in action=allow protocol=TCP localport=8080
if %errorlevel% equ 0 (
    echo ✅ Firewall rule added successfully
) else (
    echo ❌ Failed to add firewall rule
    echo Please run as Administrator
)
pause
goto menu

:exit
echo.
echo 👋 Goodbye!
echo.
echo ⚠️  Remember to stop the server if it's running
echo Use option 3 or run STOP_SERVER.bat
echo.
pause
exit

:error
echo.
echo ❌ Invalid option. Please try again.
pause
goto menu