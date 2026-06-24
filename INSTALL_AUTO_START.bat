@echo off
echo ========================================
echo  Employee Management System Auto-Start
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

echo [1/5] Checking Node.js installation...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org
    pause
    exit /b 1
)
echo ✓ Node.js is installed

echo.
echo [2/5] Creating system directories...
if not exist "C:\EmployeeSystem" mkdir "C:\EmployeeSystem"
if not exist "C:\EmployeeSystem\logs" mkdir "C:\EmployeeSystem\logs"
if not exist "C:\EmployeeSystem\backups" mkdir "C:\EmployeeSystem\backups"
echo ✓ Directories created

echo.
echo [3/5] Copying system files...
xcopy /E /I /Y "%~dp0*" "C:\EmployeeSystem\" >nul
echo ✓ Files copied

echo.
echo [4/5] Creating startup script...
echo @echo off > "C:\EmployeeSystem\start-system.bat"
echo cd /d "C:\EmployeeSystem" >> "C:\EmployeeSystem\start-system.bat"
echo node simple-server.js >> "C:\EmployeeSystem\start-system.bat"
echo ✓ Startup script created

echo.
echo [5/5] Creating Windows Task for auto-start...
schtasks /delete /tn "EmployeeManagementSystem" /f >nul 2>&1

schtasks /create /tn "EmployeeManagementSystem" /tr "C:\EmployeeSystem\start-system.bat" /sc onstart /ru "SYSTEM" /rl highest /f

if %errorLevel% equ 0 (
    echo ✓ Auto-start task created successfully
    
    echo.
    echo Testing the task...
    schtasks /run /tn "EmployeeManagementSystem"
    timeout /t 5 >nul
    
    netstat -an | findstr :8080 >nul
    if %errorLevel% equ 0 (
        echo ✓ System is running on port 8080
    ) else (
        echo ! System may be starting... please wait
    )
) else (
    echo ✗ Failed to create auto-start task
    pause
    exit /b 1
)

echo.
echo ========================================
echo  INSTALLATION COMPLETE!
echo ========================================
echo.
echo The Employee Management System will now start automatically when the computer boots.
echo.
echo Access the system at:
echo   Local:   http://localhost:8080
echo   Network: http://%COMPUTERNAME%:8080
echo.
echo Default login: admin@company.com / admin123
echo.
echo Management commands:
echo   START_TASK.bat     - Start the system
echo   STOP_TASK.bat      - Stop the system
echo   RESTART_TASK.bat   - Restart the system
echo   CHECK_TASK.bat     - Check system status
echo   REMOVE_AUTO_START.bat - Remove auto-start
echo.
pause