@echo off
echo ========================================
echo  Employee Management System Status
echo ========================================
echo.

echo Auto-Start Task Status:
schtasks /query /tn "EmployeeManagementSystem" /fo list 2>nul
if %errorLevel% neq 0 (
    echo ✗ Auto-start task is NOT INSTALLED
    echo Run INSTALL_AUTO_START.bat as Administrator to install
    echo.
    goto :network_check
)

echo.
echo Task Details:
schtasks /query /tn "EmployeeManagementSystem" /v /fo list | findstr /i "Status State"

echo.
echo Process Status:
tasklist /fi "imagename eq node.exe" 2>nul | find "node.exe" >nul
if %errorLevel% equ 0 (
    echo ✓ Node.js process is running
    tasklist /fi "imagename eq node.exe"
) else (
    echo ✗ Node.js process is not running
)

:network_check
echo.
echo Network Status:
netstat -an | findstr :8080 2>nul
if %errorLevel% equ 0 (
    echo ✓ Server is listening on port 8080
) else (
    echo ✗ Server is not listening on port 8080
)

echo.
echo System Access:
echo   Local:   http://localhost:8080
echo   Network: http://%COMPUTERNAME%:8080

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set ip=%%a
    set ip=!ip: =!
    if defined ip echo   IP:      http://!ip!:8080
)

echo.
echo System Files:
if exist "C:\EmployeeSystem\simple-server.js" (
    echo ✓ System files found in C:\EmployeeSystem\
) else (
    echo ✗ System files not found - run INSTALL_AUTO_START.bat
)

echo.
echo Log Files:
if exist "C:\EmployeeSystem\logs\*.log" (
    echo ✓ Log files available
    dir "C:\EmployeeSystem\logs\*.log" /b 2>nul
) else (
    echo ! No log files found
)

echo.
pause