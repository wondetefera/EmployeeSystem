@echo off
echo ========================================
echo  Create Deployment Package
echo ========================================
echo.

set package_name=EmployeeManagementSystem_Deployment
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%
set timestamp=%timestamp: =0%
set package_file=%package_name%_%timestamp%.zip

echo Creating deployment package: %package_file%
echo.

echo [1/3] Preparing files...
if exist temp_package rmdir /s /q temp_package
mkdir temp_package

echo [2/3] Copying deployment files...
copy "*.bat" temp_package\ >nul
copy "*.js" temp_package\ >nul
copy "*.json" temp_package\ >nul
copy "*.html" temp_package\ >nul
copy "*.md" temp_package\ >nul
copy "*.ps1" temp_package\ >nul
xcopy /E /I assets temp_package\assets >nul

echo [3/3] Creating ZIP package...
powershell -command "Compress-Archive -Path 'temp_package\*' -DestinationPath '%package_file%' -Force"

if exist "%package_file%" (
    echo ✓ Package created successfully: %package_file%
    
    for %%A in ("%package_file%") do (
        echo   Size: %%~zA bytes
    )
    
    echo.
    echo DEPLOYMENT INSTRUCTIONS:
    echo 1. Copy %package_file% to target computer
    echo 2. Extract all files to a folder
    echo 3. Right-click INSTALL_SERVICE.bat
    echo 4. Select "Run as Administrator"
    echo 5. Follow the installation prompts
    echo.
    echo The system will automatically start on computer boot!
) else (
    echo ✗ Package creation failed
)

rmdir /s /q temp_package >nul 2>&1

echo.
pause