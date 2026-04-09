@echo off
chcp 65001 >nul
title 火龙果编辑器
echo 正在启动火龙果编辑器...
echo 启动后请勿关闭此窗口
echo.

where npx >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:4173
    npx serve -s . -l 4173
) else (
    echo 需要安装 Node.js 才能运行
    echo 请访问 https://nodejs.org 下载安装
    pause
)
