@echo off
title Memo Board - Port 3004
cd /d "%~dp0"

echo ========================================
echo   Memo Board Server (Port 3004)
echo ========================================
echo.

:: GitHub에서 최신 코드 가져오기
echo [1/3] Pulling latest from GitHub...
git pull origin master
if %errorlevel% neq 0 (
    echo Git pull failed!
    pause
    exit /b 1
)

:: 빌드
echo.
echo [2/3] Building...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

:: 서버 시작
echo.
echo [3/3] Starting server...
echo.
npm run start
pause
