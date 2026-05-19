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
timeout /t 2 /nobreak >nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3004 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

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

:: 이전 로그 삭제
del /f /q "%~dp0server.log" >nul 2>&1
del /f /q "%~dp0server-error.log" >nul 2>&1

:: 서버 백그라운드 시작
echo.
echo [4/4] Starting server in background...
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c','node --import tsx server.ts >server.log 2>server-error.log' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: 서버가 뜰 때까지 최대 15초 대기 (1초 간격 체크)
set RETRY=0
:WAIT_LOOP
timeout /t 1 /nobreak >nul
set /a RETRY+=1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3004 " ^| findstr "LISTENING"') do (
    echo.
    echo ========================================
    echo   Server running on port 3004 [PID: %%a]
    echo   Background mode - safe to close
    echo   Log: server.log / Stop: stop.bat
    echo ========================================
    timeout /t 3
    exit /b 0
)
if %RETRY% lss 15 goto WAIT_LOOP

echo.
echo [ERROR] Server failed to start (15s timeout).
echo.
echo --- server-error.log ---
type "%~dp0server-error.log" 2>nul
echo.
pause
