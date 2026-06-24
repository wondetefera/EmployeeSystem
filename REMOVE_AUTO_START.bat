@echo off
echo ========================================
echo  Remove Employee Management Auto-Start
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo WARNING: This will remove the auto-start functionality.
echo The system files will remain in C:\EmployeeSystem\
echo.
set /p confirm="Are you sure you want to remove auto-start? (y/N): "
if /i not "%confirm%"=="y" (
    echo Removal cancelled.
    pause
    exit /b 0
)

echo.
echo [1/3] Stopping current processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find "node.exe"') do (
    set pid=%%i
    set pid=!pid:"=!
    taskkill /pid !pid! /f >nul 2>&1
)

echo [2/3] Stopping and removing scheduled task...
schtasks /end /tn "EmployeeManagementSystem" >nul 2>&1
schtasks /delete /tn "EmployeeManagementSystem" /f >nul 2>&1

if %errorLevel% equ 0 (
    echo ✓ Auto-start task removed successfully
) else (
    echo ! Task may not have existed
)

echo [3/3] Cleaning up...
if exist "C:\EmployeeSystem\start-system.bat" (
    del "C:\EmployeeSystem\start-system.bat" >nul 2>&1
)

echo.
echo ✓ Auto-start removed successfully
echo.
echo System files remain in: C:\EmployeeSystem\
echo To reinstall auto-start, run: INSTALL_AUTO_START.bat
echo To start manually, run: START_TASK.bat
echo.
pause