@echo off
chcp 65001 > nul
cd /d "%~dp0client"

if not exist node_modules (
  echo Installing client dependencies, please wait...
  call npm install
)

echo Starting client...
call npm run dev
