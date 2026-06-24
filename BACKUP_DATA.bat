@echo off
echo ========================================
echo  Employee Management System Backup
echo ========================================
echo.

set backup_dir=C:\EmployeeSystem\backups
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
set backup_file=%backup_dir%\backup_%timestamp%.zip

echo Creating backup: %backup_file%
echo.

if not exist "%backup_dir%" mkdir "%backup_dir%"

echo [1/4] Stopping service temporarily...
sc query "EmployeeManagementSystem" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    set service_was_running=1
    sc stop "EmployeeManagementSystem" >nul
    timeout /t 2 >nul
) else (
    set service_was_running=0
)

echo [2/4] Creating backup archive...
powershell -command "Compress-Archive -Path 'C:\EmployeeSystem\data.json', 'C:\EmployeeSystem\config.json', 'C:\EmployeeSystem\*.html', 'C:\EmployeeSystem\assets' -DestinationPath '%backup_file%' -Force"

if exist "%backup_file%" (
    echo ✓ Backup created successfully
    echo   File: %backup_file%
    
    for %%A in ("%backup_file%") do (
        echo   Size: %%~zA bytes
    )
) else (
    echo ✗ Backup failed
)

echo [3/4] Cleaning old backups (keeping last 10)...
for /f "skip=10 delims=" %%F in ('dir "%backup_dir%\backup_*.zip" /b /o-d 2^>nul') do (
    del "%backup_dir%\%%F" >nul 2>&1
    echo   Removed old backup: %%F
)

echo [4/4] Restarting service...
if %service_was_running%==1 (
    sc start "EmployeeManagementSystem" >nul
    echo ✓ Service restarted
) else (
    echo ! Service was not running - left stopped
)

echo.
echo ========================================
echo  BACKUP COMPLETE
echo ========================================
echo.
echo Backup saved to: %backup_file%
echo.
echo Available backups:
dir "%backup_dir%\backup_*.zip" /b 2>nul
echo.
pause