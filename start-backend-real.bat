@echo off
title ShelfVision - Teste de Detecção com Modelo Treinado
echo.
echo ====================================
echo TESTE DO MODELO YOLO TREINADO
echo ====================================
echo.

REM Verificar se best.pt existe
if not exist "backend\model\best.pt" (
    echo [ERRO] Modelo best.pt não encontrado em backend/model/
    echo Rode o treino primeiro: python train-model.py
    pause
    exit /b 1
)

echo ✓ Modelo encontrado: backend\model\best.pt
echo.
echo Iniciando backend em modo YOLO (real)...
echo.
echo PASSO 1: Backend rodando na porta 8001
echo PASSO 2: Abra outro terminal e rode: start-frontend.bat
echo PASSO 3: Envie uma imagem para testar
echo.
echo Pressione CTRL+C para parar o backend
echo.
pause

if not exist ".venv\Scripts\python.exe" (
    echo [INFO] Criando ambiente virtual...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install -r backend\requirements.txt

set SHELFVISION_MOCK_MODE=0
set SHELFVISION_DEVICE=cpu

echo Iniciando backend YOLO real em http://127.0.0.1:8001
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8001
