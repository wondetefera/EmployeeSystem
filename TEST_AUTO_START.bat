@echo off
echo ========================================
echo  Test Auto-Start Functionality
echo ========================================
echo.

echo This will test if the auto-start is working properly.
echo.
set /p confirm="Do you want to test auto-start? (y/N): "
if /i not "%confirm%"=="y" (
    echo Test cancelled.
    pause
    exit /b 0
)

echo.
echo [1/4] Checking current status...
schtasks /query /tn "EmployeeManagementSystem" >nul 2>&1
if %errorLevel% neq 0 (
    echo ✗ Auto-start task not found
    echo Please run INSTALL_RELIABLE_AUTO_START.bat first
    pause
    exit /b 1
)
echo ✓ Auto-start task exists

echo.
echo [2/4] Stopping current system...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find "node.exe"') do (
    set pid=%%i
    set pid=!pid:"=!
    taskkill /pid !pid! /f >nul 2>&1
)
timeout /t 3 >nul

echo [3/4] Testing auto-start...
schtasks /run /tn "EmployeeManagementSystem"
echo Waiting for system to start...
timeout /t 10 >nul

echo [4/4] Verifying system is running...
netstat -an | findstr :8080 >nul
if %errorLevel% equ 0 (
    echo ✓ SUCCESS: Auto-start is working!
    echo ✓ System is running on port 8080
    echo.
    echo Test accessing: http://localhost:8080
    echo.
    echo The system will now start automatically when computer restarts.
) else (
    echo ✗ FAILED: Auto-start is not working properly
    echo.
    echo Troubleshooting steps:
    echo 1. Check if Node.js is in system PATH
    echo 2. Verify system files exist in C:\EmployeeSystem\
    echo 3. Run CHECK_TASK.bat for detailed status
    echo 4. Try INSTALL_RELIABLE_AUTO_START.bat again
)

echo.
pause