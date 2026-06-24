@echo off
echo ========================================
echo  Uninstall Employee Management System
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo WARNING: This will completely remove the Employee Management System service.
echo The system files and data will remain in C:\EmployeeSystem\
echo.
set /p confirm="Are you sure you want to uninstall? (y/N): "
if /i not "%confirm%"=="y" (
    echo Uninstall cancelled.
    pause
    exit /b 0
)

echo.
echo [1/3] Stopping service...
sc stop "EmployeeManagementSystem" >nul 2>&1
timeout /t 3 >nul

echo [2/3] Removing service...
node "%~dp0remove-service.js"

echo [3/3] Cleaning up...
sc delete "EmployeeManagementSystem" >nul 2>&1

echo.
echo ✓ Service uninstalled successfully
echo.
echo System files remain in: C:\EmployeeSystem\
echo To reinstall, run: INSTALL_SERVICE.bat
echo.
pause