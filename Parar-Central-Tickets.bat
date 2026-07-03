@echo off
chcp 65001 >nul
title Central de Tickets - Parar
echo A parar a Central de Tickets...
echo.

set "PARADO=0"

REM Termina o processo que estiver a ouvir na porta do backend (4000)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1 && set "PARADO=1"
)

REM Termina o processo que estiver a ouvir na porta do frontend (5173)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1 && set "PARADO=1"
)

if "%PARADO%"=="1" (
    echo Aplicacao parada com sucesso.
) else (
    echo Nao foi encontrado nada a correr nas portas 4000/5173.
)
