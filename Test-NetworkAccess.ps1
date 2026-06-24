# Network Access Test for Ethiopian Payroll System

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ethiopian Payroll System - Network Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$serverIP = "10.192.230.251"
$serverPort = 8080

Write-Host "Testing network connectivity..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Check if server is listening locally
Write-Host "1. Testing local server (localhost:$serverPort)..." -ForegroundColor White
try {
    $localTest = Test-NetConnection -ComputerName "localhost" -Port $serverPort -WarningAction SilentlyContinue
    if ($localTest.TcpTestSucceeded) {
        Write-Host "   ✓ Local server is running and accessible" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Local server is not accessible" -ForegroundColor Red
        Write-Host "   → Make sure the server is running (node simple-server.js)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Error testing local connection: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check if server is listening on network interface
Write-Host "2. Testing network server ($serverIP`:$serverPort)..." -ForegroundColor White
try {
    $networkTest = Test-NetConnection -ComputerName $serverIP -Port $serverPort -WarningAction SilentlyContinue
    if ($networkTest.TcpTestSucceeded) {
        Write-Host "   ✓ Network server is accessible" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Network server is not accessible" -ForegroundColor Red
        Write-Host "   → This indicates a firewall or network configuration issue" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Error testing network connection: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Check firewall rules
Write-Host "3. Checking Windows Firewall rules..." -ForegroundColor White
$firewallRules = Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*8080*" -or $_.DisplayName -like "*Payroll*" -or $_.DisplayName -like "*Ethiopian*"}
if ($firewallRules) {
    Write-Host "   ✓ Found firewall rules:" -ForegroundColor Green
    $firewallRules | ForEach-Object {
        Write-Host "     - $($_.DisplayName) ($($_.Direction), $($_.Action), Enabled: $($_.Enabled))" -ForegroundColor White
    }
} else {
    Write-Host "   ✗ No firewall rules found for port 8080" -ForegroundColor Red
    Write-Host "   → Run Add-FirewallRule.ps1 as Administrator to add the rule" -ForegroundColor Yellow
}

Write-Host ""

# Test 4: Check network interface
Write-Host "4. Checking network configuration..." -ForegroundColor White
$networkAdapter = Get-NetIPAddress | Where-Object {$_.IPAddress -eq $serverIP}
if ($networkAdapter) {
    Write-Host "   ✓ Server IP $serverIP is configured on this machine" -ForegroundColor Green
    Write-Host "     Interface: $($networkAdapter.InterfaceAlias)" -ForegroundColor White
} else {
    Write-Host "   ✗ Server IP $serverIP not found on this machine" -ForegroundColor Red
    Write-Host "   → Check network configuration" -ForegroundColor Yellow
}

Write-Host ""

# Test 5: Check if port is in use
Write-Host "5. Checking if port $serverPort is in use..." -ForegroundColor White
$portInUse = Get-NetTCPConnection | Where-Object {$_.LocalPort -eq $serverPort}
if ($portInUse) {
    Write-Host "   ✓ Port $serverPort is in use:" -ForegroundColor Green
    $portInUse | ForEach-Object {
        Write-Host "     - $($_.LocalAddress):$($_.LocalPort) -> $($_.RemoteAddress):$($_.RemotePort) ($($_.State))" -ForegroundColor White
    }
} else {
    Write-Host "   ✗ Port $serverPort is not in use" -ForegroundColor Red
    Write-Host "   → Make sure the server is running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Recommendations:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not $localTest.TcpTestSucceeded) {
    Write-Host "• Start the server: node simple-server.js" -ForegroundColor Yellow
}

if ($localTest.TcpTestSucceeded -and -not $networkTest.TcpTestSucceeded) {
    Write-Host "• Add firewall rule: Run Add-FirewallRule.ps1 as Administrator" -ForegroundColor Yellow
    Write-Host "• Or temporarily disable Windows Firewall for testing" -ForegroundColor Yellow
}

if ($networkTest.TcpTestSucceeded) {
    Write-Host "• Network access should work! Try: http://$serverIP`:$serverPort" -ForegroundColor Green
}

Write-Host ""
Read-Host "Press Enter to exit"