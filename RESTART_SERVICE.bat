@echo off
echo Restarting Employee Management System Service...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/2] Stopping service...
sc stop "EmployeeManagementSystem" >nul 2>&1
timeout /t 3 >nul

echo [2/2] Starting service...
sc start "EmployeeManagementSystem"
if %errorLevel% equ 0 (
    echo ✓ Service restart command sent
    echo Waiting for service to start...
    timeout /t 5 >nul
    
    sc query "EmployeeManagementSystem" | find "RUNNING" >nul
    if %errorLevel% equ 0 (
        echo ✓ Service is now RUNNING
        echo.
        echo Access the system at:
        echo   http://localhost:8080
        echo   http://%COMPUTERNAME%:8080
    ) else (
        echo ! Service is starting... please wait a moment
    )
) else (
    echo ✗ Failed to restart service
)

echo.
pause