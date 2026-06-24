# Ethiopian Payroll System - Firewall Setup
# This script adds a Windows Firewall rule to allow network access

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ethiopian Payroll System - Firewall Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Right-click on PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as administrator'" -ForegroundColor Yellow
    Write-Host "3. Navigate to this directory and run the script again" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Adding Windows Firewall rule for port 8080..." -ForegroundColor Yellow

try {
    # Add the firewall rule
    New-NetFirewallRule -DisplayName "Ethiopian Payroll System Port 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -ErrorAction Stop
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Firewall rule added." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The system should now be accessible from other computers at:" -ForegroundColor Green
    Write-Host "http://10.192.230.251:8080" -ForegroundColor Cyan
    Write-Host ""
    
    # Test the rule
    Write-Host "Testing firewall rule..." -ForegroundColor Yellow
    $rule = Get-NetFirewallRule -DisplayName "Ethiopian Payroll System Port 8080" -ErrorAction SilentlyContinue
    if ($rule) {
        Write-Host "✓ Firewall rule is active and enabled" -ForegroundColor Green
    }
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR! Failed to add firewall rule." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Write-Host ""
Write-Host "Additional troubleshooting steps:" -ForegroundColor Yellow
Write-Host "1. Make sure the server is running (check for 'Employee Management System running' message)" -ForegroundColor White
Write-Host "2. Test local access first: http://localhost:8080" -ForegroundColor White
Write-Host "3. Check if other computers are on the same network (10.192.230.x)" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"