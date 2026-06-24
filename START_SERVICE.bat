@echo off
echo Starting Employee Management System Service...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

sc start "EmployeeManagementSystem"
if %errorLevel% equ 0 (
    echo ✓ Service start command sent
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
    echo ✗ Failed to start service
    echo Check if the service is installed: CHECK_SERVICE.bat
)

echo.
pause