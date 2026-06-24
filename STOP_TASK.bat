@echo off
echo Stopping Employee Management System...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/2] Finding Node.js processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find "node.exe"') do (
    set pid=%%i
    set pid=!pid:"=!
    echo Found Node.js process: !pid!
    taskkill /pid !pid! /f >nul 2>&1
)

echo [2/2] Stopping scheduled task...
schtasks /end /tn "EmployeeManagementSystem" >nul 2>&1

timeout /t 2 >nul

netstat -an | findstr :8080 >nul
if %errorLevel% neq 0 (
    echo ✓ System is now STOPPED
) else (
    echo ! System may still be stopping...
)

echo.
pause