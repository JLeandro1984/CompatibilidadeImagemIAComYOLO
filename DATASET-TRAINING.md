# 🎯 DATASET E TREINO YOLO

## ✅ Status do Dataset

Seu dataset foi estruturado com sucesso para treino YOLO:

```
dataset/
├── images/
│   ├── train/  (6 imagens)
│   └── val/    (2 imagens)
└── labels/
    ├── train/  (6 arquivos .txt)
    └── val/    (2 arquivos .txt)
```

**Divisão:** 75% treino (6 imgs) + 25% validação (2 imgs)

**Classes:** 5 marcas
- Sprite (ID: 0)
- Coca-cola (ID: 2)
- Fanta (ID: 3)  
- Ruffles (ID: 4)
- Doritos (ID: 5)

---

## 🚀 Como Treinar o Modelo

### Opção 1: Automático (Recomendado)
```bash
# Windows - duplo clique em:
start-training.bat

# Linux/Mac
python train-model.py
```

### Opção 2: Manual com Controle Total
```bash
# Instalar YOLO (se ainda não tiver)
pip install ultralytics

# Treinar
yolo detect train data=data.yaml model=yolov8n.pt epochs=100 imgsz=640

# Ou carregar um modelo já treinado para continuar
yolo detect train data=data.yaml model=runs/detect/brand_detection/weights/best.pt epochs=100
```

---

## 📊 Parâmetros de Treino

No arquivo `train-model.py`:

- **epochs**: 50 (mais épocas = melhor mas mais lento)
- **imgsz**: 640 (tamanho de imagem maior = melhor qualidade mas mais lento)
- **device**: 0 (GPU) ou -1 (CPU)
- **patience**: 20 (parar se não melhorar em 20 épocas)

**Dica:** Se GPU não detectada, tente:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

---

## 📦 Onde o Modelo é Salvo

Após treino bem-sucedido:
1. **runs/detect/brand_detection/weights/best.pt** ← Melhor modelo
2. **backend/model/best.pt** ← Copiado automaticamente para usar no backend

---

## 🧪 Testar o Modelo Treinado

### No Backend (automático)
1. Inicie o backend: `start-backend-mock.bat`
2. Na UI, mude `mock_mode` para **false**
3. Clique em "Testar conexão do backend"
4. Envie uma imagem para detectar

### Via Python
```python
from ultralytics import YOLO

model = YOLO("backend/model/best.pt")
results = model.predict(source="caminho/da/imagem.png")
```

---

## ⚠️ Próximos Passos para Melhorar

1. **Adicionar mais imagens** (mínimo 50-100 por marca)
2. **Aumentar variação** (ângulos, iluminação, distâncias diferentes)
3. **Aumentar épocas** (de 50 para 100-200)
4. **Fine-tuning**: usar modelo pré-treinado maior (yolov8m.pt, yolov8l.pt)

---

## 🐛 Solução de Problemas

### "CUDA not available"
- Seu computador vai usar CPU (mais lento)
- Ou instale CUDA 11.8+ e drivers NVIDIA

### "OOM (Out of Memory)"
- Reduzir imgsz: `imgsz=416`
- Reduzir batch_size: `batch=8`

### "Baixa accuracy"
- Adicionar mais imagens
- Aumentar épocas
- Revisar qualidade das anotações em makesense.ai

---

## 📌 Resumo Rápido

```bash
# 1. Verificar dataset OK ✓
# 2. Rodar treino
python train-model.py

# 3. Ver resultados
ls runs/detect/brand_detection/

# 4. Usar modelo no backend
# Backend detecta melhor best.pt automaticamente
```

Bom treino! 🎉
