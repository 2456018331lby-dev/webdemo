@echo off
chcp 65001 >nul
title 智能家居控制系统

echo 🏠 启动智能家居控制系统...
echo.

cd /d "%~dp0"

echo 🚀 启动开发服务器...
echo    访问地址: http://localhost:3000
echo.
echo    按 Ctrl+C 停止服务器
echo.

call npm run dev
pause
