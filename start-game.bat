@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo Starting the server and client in separate windows...

start "Rule Guess Game - Server" cmd /k "%~dp0run-server.bat"
timeout /t 3 /nobreak > nul
start "Rule Guess Game - Client" cmd /k "%~dp0run-client-network.bat"

echo.
echo Both windows have been launched.
echo Once the Client window shows a URL like http://localhost:5173, open it in your browser.
echo This window can be closed. To stop the game, close the two black windows that opened.
echo.
pause
