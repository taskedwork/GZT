@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================
echo   SDD 后端服务 启动中...
echo ============================================
echo.
echo   后端地址: http://localhost:3001
echo   PWA 地址: https://taskedwork.github.io/GZT/
echo.
echo   按 Ctrl+C 停止服务
echo ============================================
echo.

node.exe server\index.js

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ============================================
  echo   服务已停止（错误代码: %ERRORLEVEL%）
  echo   按任意键关闭窗口...
  echo ============================================
  pause >nul
)
