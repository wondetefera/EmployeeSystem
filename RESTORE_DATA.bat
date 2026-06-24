@echo off
echo ========================================
echo  Employee Management System Restore
echo ========================================
echo.

set backup_dir=C:\EmployeeSystem\backups

echo Available backups:
dir "%backup_dir%\backup_*.zip" /b 2>nul
if %errorLevel% neq 0 (
    echo No backups found in %backup_dir%
    pause
    exit /b 1
)

echo.
set /p backup_file="Enter backup filename (or press Enter for latest): "

if "%backup_file%"=="" (
    for /f "delims=" %%F in ('dir "%backup_dir%\backup_*.zip" /b /o-d 2^>nul') do (
        set backup_file=%%F
        goto :found_latest
    )
    echo No backups found
    pause
    exit /b 1
    :found_latest
    echo Using latest backup: %backup_file%
)

set full_backup_path=%backup_dir%\%backup_file%

if not exist "%full_backup_path%" (
    echo Backup file not found: %full_backup_path%
    pause
    exit /b 1
)

echo.
echo WARNING: This will overwrite current data with backup from:
echo %backup_file%
echo.
set /p confirm="Are you sure you want to restore? (y/N): "
if /i not "%confirm%"=="y" (
    echo Restore cancelled.
    pause
    exit /b 0
)

echo.
echo [1/4] Stopping service...
sc query "EmployeeManagementSystem" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    set service_was_running=1
    sc stop "EmployeeManagementSystem" >nul
    timeout /t 3 >nul
) else (
    set service_was_running=0
)

echo [2/4] Creating current backup...
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
powershell -command "Compress-Archive -Path 'C:\EmployeeSystem\data.json', 'C:\EmployeeSystem\config.json' -DestinationPath '%backup_dir%\pre_restore_%timestamp%.zip' -Force" >nul

echo [3/4] Restoring from backup...
powershell -command "Expand-Archive -Path '%full_backup_path%' -DestinationPath 'C:\EmployeeSystem\' -Force"

if %errorLevel% equ 0 (
    echo ✓ Data restored successfully
) else (
    echo ✗ Restore failed
    pause
    exit /b 1
)

echo [4/4] Starting service...
if %service_was_running%==1 (
    sc start "EmployeeManagementSystem" >nul
    timeout /t 3 >nul
    echo ✓ Service restarted
) else (
    echo ! Service was not running - left stopped
)

echo.
echo ========================================
echo  RESTORE COMPLETE
echo ========================================
echo.
echo Data restored from: %backup_file%
echo Pre-restore backup saved as: pre_restore_%timestamp%.zip
echo.
echo Access the system at: http://localhost:8080
echo.
pause