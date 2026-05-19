@echo off
echo Stopping Memo Board Server (Port 3004)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3004 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo Killed process %%a
)

echo Server stopped.
timeout /t 3
