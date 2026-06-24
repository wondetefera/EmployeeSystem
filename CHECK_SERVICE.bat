@echo off
echo ========================================
echo  Employee Management System Status
echo ========================================
echo.

echo Service Status:
sc query "EmployeeManagementSystem" 2>nul
if %errorLevel% neq 0 (
    echo ✗ Service is NOT INSTALLED
    echo Run INSTALL_SERVICE.bat as Administrator to install
    echo.
    goto :end
)

echo.
echo Service Configuration:
sc qc "EmployeeManagementSystem" 2>nul

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
echo Log Files:
if exist "C:\EmployeeSystem\logs\*.log" (
    echo ✓ Log files available in C:\EmployeeSystem\logs\
    dir "C:\EmployeeSystem\logs\*.log" /b 2>nul
) else (
    echo ! No log files found
)

:end
echo.
pause