@echo off
REM Simple batch script to restart mock server with different scenarios
REM Usage: restart_demo.bat [green|dirty|normal]

setlocal
cd /d "%~dp0"

REM Default to normal if no argument
set SCENARIO=%1
if "%SCENARIO%"=="" set SCENARIO=normal

echo.
echo Killing mock server...
taskkill /F /FI "COMMANDLINE eq*mock_server.py*" 2>nul || echo (none running)

echo.
echo Waiting 1 second...
timeout /t 1 /nobreak >nul

echo.
echo Starting mock server with scenario: %SCENARIO%
start "" cmd /k "python scripts\mock_server.py --scenario=%SCENARIO%"

echo.
echo Mock server restarted! Dashboard will update in ~30 seconds.
echo.
echo Current scenario: %SCENARIO%
echo   - "normal" = realistic 24h CAISO cycle (midday green, evening dirty)
echo   - "green"  = constant 150 gCO2/kWh (GREEN grid, jobs running)
echo   - "dirty"  = constant 420 gCO2/kWh (DIRTY grid, jobs paused)
echo.
