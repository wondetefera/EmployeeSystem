@echo off
echo Stopping Employee Management System Service...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

sc stop "EmployeeManagementSystem"
if %errorLevel% equ 0 (
    echo ✓ Service stop command sent
    echo Waiting for service to stop...
    timeout /t 3 >nul
    
    sc query "EmployeeManagementSystem" | find "STOPPED" >nul
    if %errorLevel% equ 0 (
        echo ✓ Service is now STOPPED
    ) else (
        echo ! Service is stopping... please wait a moment
    )
) else (
    echo ✗ Failed to stop service or service not running
)

echo.
pause