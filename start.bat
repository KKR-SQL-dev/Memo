@echo off
title Memo Board - Port 3004
cd /d "%~dp0"

echo ========================================
echo   Memo Board Server (Port 3004)
echo ========================================
echo.

:: 빌드
echo [1/2] Building...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Starting server...
echo.
npm run start
pause
