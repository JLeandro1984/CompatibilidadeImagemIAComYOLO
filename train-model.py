#!/usr/bin/env python3
"""
Script para treinar modelo YOLO com o dataset de marcas
"""
from ultralytics import YOLO
import os

# Configurar caminho da data.yaml
data_yaml = "data.yaml"

if not os.path.exists(data_yaml):
    print(f"❌ Arquivo {data_yaml} não encontrado!")
    print("Certifique-se de estar no diretório correto do projeto")
    exit(1)

# Criar novo modelo YOLO
print("📦 Carregando modelo YOLOv8 Nano...")
model = YOLO("yolov8n.pt")

# Treinar modelo
print("🚀 Iniciando treino...")
print(f"📁 Dataset: {data_yaml}")
print("⏱️  Isto pode levar vários minutos...\n")

results = model.train(
    data=data_yaml,
    epochs=50,
    imgsz=640,
    device='cpu',  # CPU (mais lento, mas funciona sem GPU)
    patience=20,
    save=True,
    project="runs/detect",
    name="brand_detection",
    exist_ok=True
)

print("\n✅ Treino concluído!")
print(f"📊 Resultados em: runs/detect/brand_detection/")
print(f"🎯 Melhor modelo: runs/detect/brand_detection/weights/best.pt")

# Copiar modelo para backend
import shutil
backend_model_path = "backend/model/best.pt"
source_model = "runs/detect/brand_detection/weights/best.pt"

if os.path.exists(source_model):
    os.makedirs(os.path.dirname(backend_model_path), exist_ok=True)
    shutil.copy(source_model, backend_model_path)
    print(f"✔️  Modelo copiado para: {backend_model_path}")
else:
    print(f"⚠️  Modelo não encontrado em: {source_model}")
