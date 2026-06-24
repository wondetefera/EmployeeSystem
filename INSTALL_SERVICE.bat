@echo off
echo ========================================
echo  Employee Management System Installer
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org
    pause
    exit /b 1
)
echo ✓ Node.js is installed

echo.
echo [2/6] Creating service directories...
if not exist "C:\EmployeeSystem" mkdir "C:\EmployeeSystem"
if not exist "C:\EmployeeSystem\logs" mkdir "C:\EmployeeSystem\logs"
if not exist "C:\EmployeeSystem\backups" mkdir "C:\EmployeeSystem\backups"
if not exist "C:\EmployeeSystem\service" mkdir "C:\EmployeeSystem\service"
echo ✓ Directories created

echo.
echo [3/6] Copying system files...
xcopy /E /I /Y "%~dp0*" "C:\EmployeeSystem\" >nul
echo ✓ Files copied

echo.
echo [4/6] Installing Node.js service manager...
cd /d "C:\EmployeeSystem"
npm install node-windows --save >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing globally as fallback...
    npm install -g node-windows >nul 2>&1
)
echo ✓ Service manager installed

echo.
echo [5/6] Creating Windows Service...
node "%~dp0create-service.js"
if %errorLevel% neq 0 (
    echo ERROR: Failed to create service
    pause
    exit /b 1
)
echo ✓ Service created

echo.
echo [6/6] Starting service...
sc start "EmployeeManagementSystem" >nul 2>&1
timeout /t 3 >nul
sc query "EmployeeManagementSystem" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    echo ✓ Service is running
) else (
    echo ! Service created but not running - will start on next boot
)

echo.
echo ========================================
echo  INSTALLATION COMPLETE!
echo ========================================
echo.
echo The Employee Management System is now installed as a Windows Service.
echo It will automatically start when the computer boots up.
echo.
echo Access the system at:
echo   Local:   http://localhost:8080
echo   Network: http://%COMPUTERNAME%:8080
echo.
echo Default login: admin@company.com / admin123
echo.
echo Management commands:
echo   START_SERVICE.bat    - Start the service
echo   STOP_SERVICE.bat     - Stop the service
echo   RESTART_SERVICE.bat  - Restart the service
echo   CHECK_SERVICE.bat    - Check service status
echo   UNINSTALL_SERVICE.bat - Remove the service
echo.
pause