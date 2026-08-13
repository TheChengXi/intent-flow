@echo off
rem DeepSeek Harness Web UI launcher (intent-flow workspace edition)
rem Starts dsh with this project directory as its default workspace.

netstat -ano | findstr ":3080" | findstr LISTENING >nul 2>&1
if %errorlevel%==0 (
    echo [dsh] Web UI already running: http://127.0.0.1:3080
    start http://127.0.0.1:3080
    exit /b 0
)

echo [dsh] Starting Web UI (workspace: D:\w_dev\intent-flow)...
start "DeepSeek Harness" cmd /k "cd /d D:\w_dev\intent-flow && D:\w_dev\dsh-playground\node_modules\.bin\dsh web --patch .dsh\dsh.mcp.patch.yml"
timeout /t 8 /nobreak >nul
echo [dsh] Started: http://127.0.0.1:3080
start http://127.0.0.1:3080
