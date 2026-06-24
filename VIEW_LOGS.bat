@echo off
echo ========================================
echo  Employee Management System Logs
echo ========================================
echo.

set log_dir=C:\EmployeeSystem\logs

if not exist "%log_dir%" (
    echo No log directory found: %log_dir%
    echo Service may not be installed or running
    pause
    exit /b 1
)

echo Available log files:
dir "%log_dir%\*.log" /b 2>nul
if %errorLevel% neq 0 (
    echo No log files found
    echo.
    echo If service is running, logs should appear soon.
    echo Check service status with: CHECK_SERVICE.bat
    pause
    exit /b 1
)

echo.
echo [1] View latest error log
echo [2] View latest output log  
echo [3] View all logs in folder
echo [4] Clear all logs
echo.
set /p choice="Select option (1-4): "

if "%choice%"=="1" (
    for /f "delims=" %%F in ('dir "%log_dir%\*error*.log" /b /o-d 2^>nul') do (
        echo.
        echo === Latest Error Log: %%F ===
        type "%log_dir%\%%F"
        goto :end
    )
    echo No error logs found
)

if "%choice%"=="2" (
    for /f "delims=" %%F in ('dir "%log_dir%\*out*.log" /b /o-d 2^>nul') do (
        echo.
        echo === Latest Output Log: %%F ===
        type "%log_dir%\%%F"
        goto :end
    )
    echo No output logs found
)

if "%choice%"=="3" (
    echo.
    echo Opening log folder...
    explorer "%log_dir%"
    goto :end
)

if "%choice%"=="4" (
    echo.
    set /p confirm="Delete all log files? (y/N): "
    if /i "%confirm%"=="y" (
        del "%log_dir%\*.log" /q >nul 2>&1
        echo ✓ All log files deleted
    ) else (
        echo Cancelled
    )
)

:end
echo.
pause