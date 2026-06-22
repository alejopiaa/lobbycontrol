@echo off
title Servidor de Audiencias - Lobby
cd /d "%~dp0"
echo ===================================================
echo   Iniciando el servidor de la aplicación Lobby...
echo ===================================================
echo.
:: Espera 2 segundos en segundo plano antes de abrir el navegador
start /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"
:: Ejecuta el servidor Node
node server.js
pause
