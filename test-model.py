#!/usr/bin/env python3
"""
Script para testar o modelo YOLO treinado rapidamente
"""
from ultralytics import YOLO
import os
from pathlib import Path

print("=" * 50)
print("TESTE RÁPIDO DO MODELO YOLO TREINADO")
print("=" * 50)

# Caminho do modelo
model_path = "backend/model/best.pt"

if not os.path.exists(model_path):
    print(f"\n❌ Modelo não encontrado: {model_path}")
    print("Rode o treino primeiro: python train-model.py")
    exit(1)

print(f"\n✓ Modelo encontrado: {model_path}")

# Carregar modelo
print("\n📦 Carregando modelo...")
model = YOLO(model_path)

# Testar com imagens de teste
test_images = [
    "img/sprite.png",
    "img/doritos.png",
    "img/Coca-cola lata 350ml.png"
]

print("\n🧪 Executando inferência em imagens de teste...\n")

for img_path in test_images:
    if os.path.exists(img_path):
        print(f"Testando: {img_path}")
        results = model.predict(source=img_path, conf=0.60)
        
        for result in results:
            if len(result.boxes) > 0:
                print(f"  ✓ {len(result.boxes)} objeto(s) detectado(s)")
                for box in result.boxes:
                    class_id = int(box.cls)
                    conf = float(box.conf)
                    class_name = model.names.get(class_id, f"Class {class_id}")
                    print(f"    → {class_name}: {conf:.2%} confiança")
            else:
                print(f"  ⚠ Nenhum objeto detectado")
        print()
    else:
        print(f"⚠ Imagem não encontrada: {img_path}\n")

print("=" * 50)
print("✅ TESTE CONCLUÍDO!")
print("=" * 50)
print("\n📌 Para usar o modelo no backend:")
print("   1. Inicie: start-backend-real.bat")
print("   2. Em outro terminal: start-frontend.bat")
print("   3. Envie uma imagem para detectar marcas")
