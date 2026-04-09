@echo off
chcp 65001 >nul
title 火龙果编辑器
echo 正在启动火龙果编辑器...
echo 启动后请勿关闭此窗口
echo.
start http://localhost:5173
npm run dev
