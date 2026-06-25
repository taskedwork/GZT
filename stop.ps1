# SDD Workspace - Stop All Services
Write-Host "========================================" -ForegroundColor Red
Write-Host "  Stopping SDD services..." -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$stopped = $false

# Stop backend (port 3001)
$conn = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($conn) {
    $pid_ = $conn.OwningProcess | Select-Object -First 1
    if ($pid_) {
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
        Write-Host "  Backend stopped (port 3001)" -ForegroundColor Green
        $stopped = $true
    }
}

# Stop frontend (port 5173)
$conn = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($conn) {
    $pid_ = $conn.OwningProcess | Select-Object -First 1
    if ($pid_) {
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
        Write-Host "  Frontend stopped (port 5173)" -ForegroundColor Green
        $stopped = $true
    }
}

if (-not $stopped) {
    Write-Host "  No services running." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
Start-Sleep -Seconds 2
