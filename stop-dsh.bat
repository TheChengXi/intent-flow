@echo off
rem DeepSeek Harness Web UI stopper
echo [dsh] Stopping Web UI...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3080" ^| findstr LISTENING') do (
    echo [dsh] Killing PID %%p
    taskkill /PID %%p /F >nul 2>&1
)
echo [dsh] Stopped
