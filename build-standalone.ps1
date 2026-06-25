# Build standalone SDD server (Node.js runtime + backend code)
# Output: dist/sdd-server/ folder and dist/sdd-server.zip

$ErrorActionPreference = 'Stop'

Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  Build SDD Standalone Server' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

$distDir = Join-Path $PSScriptRoot 'dist'
$standaloneDir = Join-Path $distDir 'sdd-server'

# 1. Clean old build
if (Test-Path $standaloneDir) {
  Write-Host '[1/6] Cleaning old build...' -ForegroundColor Yellow
  Remove-Item -Recurse -Force $standaloneDir
}

# 2. Create directory structure
Write-Host '[2/6] Creating directories...' -ForegroundColor Yellow
New-Item -ItemType Directory -Path $standaloneDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $standaloneDir 'server') -Force | Out-Null

# 3. Copy Node.js runtime
Write-Host '[3/6] Copying Node.js runtime...' -ForegroundColor Yellow
$nodeExe = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $nodeExe)) {
  $nodeExe = (Get-Command node -ErrorAction Stop).Source
}
Copy-Item $nodeExe (Join-Path $standaloneDir 'node.exe')
Write-Host "  Node version: $(node --version)" -ForegroundColor Green

# 4. Copy backend code and dependencies
Write-Host '[4/6] Copying backend code...' -ForegroundColor Yellow
$serverSrc = Join-Path $PSScriptRoot 'server'
$serverDst = Join-Path $standaloneDir 'server'

# Copy all .js files
Get-ChildItem $serverSrc -Filter '*.js' -Recurse | ForEach-Object {
  $relPath = $_.FullName.Substring($serverSrc.Length + 1)
  $dstPath = Join-Path $serverDst $relPath
  $dstDir = Split-Path $dstPath -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item $_.FullName $dstPath
}

# Copy package.json
Copy-Item (Join-Path $serverSrc 'package.json') (Join-Path $serverDst 'package.json')

# Copy public directory (admin pages)
$publicSrc = Join-Path $serverSrc 'public'
if (Test-Path $publicSrc) {
  Copy-Item $publicSrc (Join-Path $serverDst 'public') -Recurse
}

# Install dependencies (more reliable than copying node_modules)
Write-Host '  Installing dependencies via npm...' -ForegroundColor Gray
Push-Location $serverDst
$npmResult = & cmd /c "npm install --omit=dev 2>&1"
Write-Host "  npm done" -ForegroundColor Gray
Pop-Location

# 5. Create start.bat
Write-Host '[5/6] Creating start.bat...' -ForegroundColor Yellow
$startBat = Join-Path $standaloneDir 'start.bat'
$startBatContent = @'
@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================
echo   SDD Backend Server
echo ============================================
echo.
echo   Backend:  http://localhost:3001
echo   PWA:      https://taskedwork.github.io/GZT/
echo.
echo   Press Ctrl+C to stop
echo ============================================
echo.

node.exe server\index.js

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ============================================
  echo   Server stopped (error code: %ERRORLEVEL%)
  echo   Press any key to close...
  echo ============================================
  pause >nul
)
'@
$startBatContent | Out-File -FilePath $startBat -Encoding ascii -Force

# 6. Create zip
Write-Host '[6/6] Creating zip archive...' -ForegroundColor Yellow
$zipPath = Join-Path $distDir 'sdd-server.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $standaloneDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ''
Write-Host '============================================' -ForegroundColor Green
Write-Host '  Build complete!' -ForegroundColor Green
Write-Host '============================================' -ForegroundColor Green
Write-Host ''
Write-Host "  Folder: $standaloneDir"
Write-Host "  ZIP:    $zipPath"
Write-Host ''
Write-Host '  Usage:'
Write-Host '    1. Extract sdd-server.zip'
Write-Host '    2. Double-click start.bat'
Write-Host '    3. Open https://taskedwork.github.io/GZT/'
Write-Host ''
