@echo off
title Memo Board - Port 3004
cd /d "%~dp0"

echo ========================================
echo   Memo Board Server (Port 3004)
echo ========================================
echo.

:: 기존 서버 프로세스 종료
echo [0/4] Stopping existing server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3004 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: GitHub에서 최신 코드 가져오기
echo [1/4] Pulling latest from GitHub...
git pull origin master
if %errorlevel% neq 0 (
    echo Git pull failed!
    pause
    exit /b 1
)

:: 패키지 설치
echo.
echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Install failed!
    pause
    exit /b 1
)

:: 빌드
echo.
echo [3/4] Building...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

:: 서버 백그라운드 시작
echo.
echo [4/4] Starting server in background...
echo.

:: VBS로 백그라운드 실행 (창 닫아도 서버 유지)
echo Set WshShell = CreateObject("WScript.Shell") > "%~dp0_start_bg.vbs"
echo WshShell.CurrentDirectory = "%~dp0" >> "%~dp0_start_bg.vbs"
echo WshShell.Run "cmd /c npm run start > server.log 2>&1", 0, False >> "%~dp0_start_bg.vbs"

cscript //nologo "%~dp0_start_bg.vbs"
del "%~dp0_start_bg.vbs"

echo.
echo ========================================
echo   Server started on port 3004
echo   Running in background (safe to close)
echo   Log: %~dp0server.log
echo   Stop: stop.bat
echo ========================================
echo.
timeout /t 5
