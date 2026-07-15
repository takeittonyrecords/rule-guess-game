@echo off
chcp 65001 > nul
cd /d "%~dp0client"

if not exist node_modules (
  echo Installing client dependencies, please wait...
  call npm install
)

set VITE_SERVER_URL=http://192.168.0.2:3001
echo Starting client for network access (VITE_SERVER_URL=%VITE_SERVER_URL%)...
call npm run dev -- --host
