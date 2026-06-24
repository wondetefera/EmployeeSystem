@echo off
echo ========================================
echo  Reliable Employee Management Auto-Start
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
echo [2/6] Creating system directories...
if not exist "C:\EmployeeSystem" mkdir "C:\EmployeeSystem"
if not exist "C:\EmployeeSystem\logs" mkdir "C:\EmployeeSystem\logs"
if not exist "C:\EmployeeSystem\backups" mkdir "C:\EmployeeSystem\backups"
echo ✓ Directories created

echo.
echo [3/6] Copying system files...
xcopy /E /I /Y "%~dp0*" "C:\EmployeeSystem\" >nul
echo ✓ Files copied

echo.
echo [4/6] Creating startup and monitoring scripts...

:: Create the main startup script
echo @echo off > "C:\EmployeeSystem\start-system.bat"
echo title Employee Management System >> "C:\EmployeeSystem\start-system.bat"
echo cd /d "C:\EmployeeSystem" >> "C:\EmployeeSystem\start-system.bat"
echo echo Starting Employee Management System... >> "C:\EmployeeSystem\start-system.bat"
echo node simple-server.js >> "C:\EmployeeSystem\start-system.bat"

:: Create the monitoring script
echo @echo off > "C:\EmployeeSystem\monitor-system.bat"
echo title Employee Management System Monitor >> "C:\EmployeeSystem\monitor-system.bat"
echo :loop >> "C:\EmployeeSystem\monitor-system.bat"
echo timeout /t 30 /nobreak ^>nul >> "C:\EmployeeSystem\monitor-system.bat"
echo netstat -an ^| findstr :8080 ^>nul >> "C:\EmployeeSystem\monitor-system.bat"
echo if %%errorLevel%% neq 0 ( >> "C:\EmployeeSystem\monitor-system.bat"
echo     echo System not responding, restarting... >> "C:\EmployeeSystem\monitor-system.bat"
echo     taskkill /f /im node.exe ^>nul 2^>^&1 >> "C:\EmployeeSystem\monitor-system.bat"
echo     timeout /t 5 /nobreak ^>nul >> "C:\EmployeeSystem\monitor-system.bat"
echo     start /min "" "C:\EmployeeSystem\start-system.bat" >> "C:\EmployeeSystem\monitor-system.bat"
echo ) >> "C:\EmployeeSystem\monitor-system.bat"
echo goto loop >> "C:\EmployeeSystem\monitor-system.bat"

echo ✓ Scripts created

echo.
echo [5/6] Creating Windows Tasks for auto-start and monitoring...

:: Remove existing tasks
schtasks /delete /tn "EmployeeManagementSystem" /f >nul 2>&1
schtasks /delete /tn "EmployeeManagementSystemMonitor" /f >nul 2>&1

:: Create main startup task
schtasks /create /tn "EmployeeManagementSystem" /tr "C:\EmployeeSystem\start-system.bat" /sc onstart /ru "SYSTEM" /rl highest /f

:: Create monitoring task (starts 2 minutes after boot)
schtasks /create /tn "EmployeeManagementSystemMonitor" /tr "C:\EmployeeSystem\monitor-system.bat" /sc onstart /delay 0002:00 /ru "SYSTEM" /rl highest /f

if %errorLevel% equ 0 (
    echo ✓ Auto-start and monitoring tasks created
) else (
    echo ✗ Failed to create tasks
    pause
    exit /b 1
)

echo.
echo [6/6] Testing the system...
echo Starting system for testing...
schtasks /run /tn "EmployeeManagementSystem"
timeout /t 8 >nul

netstat -an | findstr :8080 >nul
if %errorLevel% equ 0 (
    echo ✓ System is running on port 8080
    
    echo Starting monitoring...
    schtasks /run /tn "EmployeeManagementSystemMonitor"
    echo ✓ Monitoring started
) else (
    echo ! System may be starting... please wait
)

echo.
echo ========================================
echo  RELIABLE AUTO-START INSTALLED!
echo ========================================
echo.
echo Features installed:
echo ✓ Automatic startup when computer boots
echo ✓ Automatic restart if system crashes
echo ✓ Continuous monitoring every 30 seconds
echo ✓ Self-healing system recovery
echo.
echo The system will now:
echo 1. Start automatically when computer boots
echo 2. Monitor itself every 30 seconds
echo 3. Restart automatically if it stops working
echo 4. Run 24/7 without intervention
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
echo.
pause