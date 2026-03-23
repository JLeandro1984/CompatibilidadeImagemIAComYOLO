@echo off
echo.
echo ====================================
echo YOLO Brand Detection - Treino do Modelo
echo ====================================
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python não encontrado. Instale Python 3.8+
    pause
    exit /b 1
)

echo [1/3] Verificando dependências...
python -c "from ultralytics import YOLO; print('  ✓ YOLO OK')"
if errorlevel 1 (
    echo [ERRO] YOLO não está instalado
    echo Instale com: pip install ultralytics
    pause
    exit /b 1
)

echo.
echo [2/3] Preparando dataset...
if not exist "data.yaml" (
    echo [ERRO] data.yaml não encontrado. Você rodou setup do dataset?
    pause
    exit /b 1
)
echo   ✓ data.yaml encontrado

if not exist "dataset\images\train" (
    echo [ERRO] Pasta dataset\images\train não encontrada
    pause
    exit /b 1
)
echo   ✓ Dataset estruturado OK

echo.
echo [3/3] Iniciando treino YOLO...
echo   - Modelo: YOLOv8 Nano
echo   - Épocas: 50
echo   - Tamanho de imagem: 640x640
echo   - GPU/CPU: automático
echo.
echo AVISO: O treino pode levar 10-30 minutos dependendo do hardware
echo Você pode ver o progresso em tempo real abaixo.
echo.
pause

python train-model.py

if errorlevel 1 (
    echo.
    echo [ERRO] Treino falhou. Verifique os erros acima.
    pause
    exit /b 1
)

echo.
echo ====================================
echo ✓ TREINO CONCLUÍDO COM SUCESSO!
echo ====================================
echo.
echo Próximos passos:
echo   1. O modelo foi salvo em: backend/model/best.pt
echo   2. Inicie o backend: start-backend-mock.bat (depois mude para modo YOLO na UI)
echo   3. Abra o frontend: start-frontend.bat
echo.
pause
