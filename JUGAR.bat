@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 24 LTS: https://nodejs.org
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0]) !== 24) process.exit(1)"
if errorlevel 1 (
  echo Actualiza a Node.js 24 LTS para usar SQLite y las cuentas de piloto.
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" goto install
if not exist "node_modules\mongodb\package.json" goto install
goto play
:install
echo Preparando el servidor...
call npm ci --omit=dev --ignore-scripts
if errorlevel 1 (
  echo No se pudieron instalar las dependencias. Revisa tu conexion y vuelve a abrir JUGAR.bat.
  pause
  exit /b 1
)
:play
start "" "http://127.0.0.1:4173"
node server.mjs
pause
