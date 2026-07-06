@echo off
chcp 65001 > nul
:loop
echo [Launcher] Starting...
call npm run watch:frontend
echo --------------------------------------------------
echo [Launcher] Reloading...
echo --------------------------------------------------
timeout /t 1 /nobreak > nul
goto loop