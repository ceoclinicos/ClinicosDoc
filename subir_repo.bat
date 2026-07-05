@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
python subir_repo.py %*
if errorlevel 1 (
  echo.
  echo Si python no funciona, prueba: py subir_repo.py
)
echo.
pause
