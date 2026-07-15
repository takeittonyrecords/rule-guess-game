@echo off
chcp 65001 > nul
cd /d "%~dp0server"

if not exist node_modules (
  echo Installing server dependencies, please wait...
  call npm install
)

echo Starting server...
call npm start
