@echo off
setlocal

cd /d "%~dp0"

echo Iniciando frontend em http://127.0.0.1:8000
python -m http.server 8000

endlocal