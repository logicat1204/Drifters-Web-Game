@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 18 o superior: https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  echo Preparando el modo online...
  call npm ci --omit=dev --ignore-scripts
  if errorlevel 1 (
    echo No se pudo instalar ws. Revisa tu conexion y vuelve a abrir JUGAR.bat.
    pause
    exit /b 1
  )
)
start "" "http://127.0.0.1:4173"
node server.mjs
pause
