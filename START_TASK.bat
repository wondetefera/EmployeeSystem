@echo off
echo Starting Employee Management System...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/2] Starting system task...
schtasks /run /tn "EmployeeManagementSystem"

if %errorLevel% equ 0 (
    echo ✓ Start command sent
    echo [2/2] Waiting for system to start...
    timeout /t 5 >nul
    
    netstat -an | findstr :8080 >nul
    if %errorLevel% equ 0 (
        echo ✓ System is now RUNNING on port 8080
        echo.
        echo Access the system at:
        echo   http://localhost:8080
        echo   http://%COMPUTERNAME%:8080
    ) else (
        echo ! System is starting... please wait a moment and try accessing:
        echo   http://localhost:8080
    )
) else (
    echo ✗ Failed to start system
    echo Check if auto-start is installed: CHECK_TASK.bat
)

echo.
pause