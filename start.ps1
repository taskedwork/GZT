﻿﻿﻿﻿﻿# SDD Workspace - One Click Start
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  SDD Workspace - Starting...' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Kill existing node processes on these ports
Write-Host 'Checking ports...' -ForegroundColor Yellow
$ports = @(3001, 5173)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $pid_ = $conn.OwningProcess | Select-Object -First 1
        if ($pid_) {
            Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
            Write-Host "  Killed process on port $port" -ForegroundColor DarkYellow
        }
    }
}

# 构建前端（如果 dist 不存在或代码已变更）
$distPath = Join-Path $root 'dist'
$needBuild = $true

if (Test-Path $distPath) {
    $distTime = (Get-Item $distPath).LastWriteTime
    $srcPath = Join-Path $root 'src'
    if (Test-Path $srcPath) {
        $srcTime = (Get-Item $srcPath).LastWriteTime
        if ($distTime -gt $srcTime) {
            $needBuild = $false
            Write-Host '  dist 已是最新，跳过构建' -ForegroundColor DarkGray
        }
    }
}

if ($needBuild) {
    Write-Host '[1/3] Building frontend...' -ForegroundColor Yellow
    Push-Location $root
    npm run build 2>&1 | Out-Host
    $buildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $buildOk) {
        Write-Host '构建失败，请检查代码后重试' -ForegroundColor Red
        exit 1
    }
}

# 启动后端
Write-Host '[2/3] Starting backend (port 3001)...' -ForegroundColor Yellow
$serverDir = Join-Path $root 'server'
$backendLog = Join-Path $root 'backend.log'
if (Test-Path $serverDir) {
    Start-Process cmd -ArgumentList "/c npm start > `"$backendLog`" 2>&1" -WorkingDirectory $serverDir -WindowStyle Hidden
} else {
    Write-Host '  server 目录不存在，跳过后端启动' -ForegroundColor Red
}

# 等待后端就绪
Write-Host '  Waiting for backend...' -ForegroundColor DarkGray
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {}
}
if ($backendReady) {
    Write-Host '  Backend ready.' -ForegroundColor Green
} else {
    Write-Host '  Backend startup timeout, check backend.log' -ForegroundColor Red
}

# 启动前端（preview 服务器）
Write-Host '[3/3] Starting frontend (port 5173)...' -ForegroundColor Yellow
$frontendLog = Join-Path $root 'frontend.log'
Start-Process cmd -ArgumentList "/c npm run preview > `"$frontendLog`" 2>&1" -WorkingDirectory $root -WindowStyle Hidden

Start-Sleep -Seconds 2

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  Started!' -ForegroundColor Green
$frontendUrl = 'http://localhost:5173'
Write-Host "  Frontend: $frontendUrl" -ForegroundColor White
Write-Host '  Backend:  http://localhost:3001' -ForegroundColor White
Write-Host '  Mode:     连接模式（WebSocket + Gist）' -ForegroundColor White
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Logs: backend.log, frontend.log' -ForegroundColor Gray
Write-Host '  Stop: run stop.ps1 or stop.bat' -ForegroundColor Gray
Write-Host ''

# Open browser
Start-Process $frontendUrl
