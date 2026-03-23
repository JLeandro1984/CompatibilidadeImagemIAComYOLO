@echo off
setlocal

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Criando ambiente virtual...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install -r backend\requirements.txt

set SHELFVISION_MOCK_MODE=1
set SHELFVISION_MOCK_BRAND=coca-cola
set SHELFVISION_MOCK_CONFIDENCE=0.88

echo Iniciando backend mock em http://127.0.0.1:8001
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8001

endlocal