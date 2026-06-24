@echo off
echo Restarting Employee Management System...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/3] Stopping current processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find "node.exe"') do (
    set pid=%%i
    set pid=!pid:"=!
    taskkill /pid !pid! /f >nul 2>&1
)

schtasks /end /tn "EmployeeManagementSystem" >nul 2>&1
timeout /t 2 >nul

echo [2/3] Starting system...
schtasks /run /tn "EmployeeManagementSystem"

echo [3/3] Waiting for system to start...
timeout /t 5 >nul

netstat -an | findstr :8080 >nul
if %errorLevel% equ 0 (
    echo ✓ System is now RUNNING on port 8080
    echo.
    echo Access the system at:
    echo   http://localhost:8080
    echo   http://%COMPUTERNAME%:8080
) else (
    echo ! System is starting... please wait a moment
)

echo.
pause