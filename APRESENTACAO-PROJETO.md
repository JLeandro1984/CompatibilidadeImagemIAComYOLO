# Apresentação — ShelfVision MVP (Detecção de Marcas em Gôndola)

## Slide 1 — Visão Geral
- **Projeto:** ShelfVision MVP
- **Objetivo:** Identificar marcas em imagens de gôndola com pipeline híbrido (frontend local + backend YOLO opcional)
- **Resultado final:** Relatório automático com marcas, contagem, layout e confiança

**Mensagem-chave:** funciona offline no modo local e ganha precisão quando o backend YOLO está ativo.

---

## Slide 2 — Problema de Negócio
- Auditoria de gôndola manual é lenta e subjetiva
- Difícil padronizar identificação de marca por inspeção humana
- Necessidade de resposta rápida para execução no PDV

**Valor entregue:** análise semi-automatizada e rastreável por evidências de IA.

---

## Slide 3 — Arquitetura da Solução
1. Usuário envia imagem no frontend
2. Frontend opcionalmente consulta `POST /detect` no backend YOLO
3. Frontend roda modelos locais (COCO-SSD, OCR, heurísticas, semântica)
4. Motor de fusão valida evidências e gera relatório

**Fallback:** se backend cair, o pipeline local continua.

---

## Slide 4 — IAs Utilizadas e Função de Cada Uma
- **YOLOv8 custom (Ultralytics/FastAPI):** detecção direta de marcas via bbox + confiança
- **COCO-SSD (TensorFlow.js):** detecta objetos genéricos/embalagens para segmentação inicial
- **Tesseract.js (OCR):** lê texto/logo para confirmar marca
- **Universal Sentence Encoder (TensorFlow.js):** mede compatibilidade entre descrição esperada e marcas detectadas
- **Heurísticas visuais (HSB + regras):** reforço por assinatura de cor e padrão de repetição

**Mensagem-chave:** é um sistema multimodal de evidências, não um único modelo isolado.

---

## Slide 5 — Fluxo de Decisão (Prioridade)
1. YOLO acima do threshold configurado
2. OCR + catálogo de marcas (`brands.json`)
3. Heurísticas visuais (cor/geometria/repetição)
4. Se não houver evidência suficiente: **Marca não identificada**

**Benefício:** redução de falso positivo por depender de múltiplos sinais.

---

## Slide 6 — YOLO: Como Funciona (didático)
- YOLO divide a imagem em regiões e prediz objetos em uma única passada
- Saída por detecção: classe, confiança e coordenadas da bbox
- Pós-processamento filtra por:
  - `confidence` (ex.: 0.60)
  - `iou` para suprimir caixas redundantes (NMS)
- No backend, resposta padronizada retorna:
  - `label`
  - `confidence`
  - `bbox` no formato `[x, y, width, height]`

---

## Slide 7 — Dataset e Treinamento
- Configuração central em `data.yaml`
- Dataset no padrão YOLO:
  - `dataset/images/train`, `dataset/images/val`
  - `dataset/labels/train`, `dataset/labels/val`
- Treino principal:
  - Script: `python train-model.py`
  - Base: `yolov8n.pt`
  - Hiperparâmetros atuais: `epochs=50`, `imgsz=640`, `patience=20`, `device=cpu`

---

## Slide 8 — Arquivos Gerados Após Treinar
Pasta principal: `runs/detect/brand_detection/`

Artefatos:
- `weights/best.pt` → melhor checkpoint
- `weights/last.pt` → último checkpoint
- `results.csv` → métricas por época
- `results.png`, `PR_curve.png`, `F1_curve.png`, `confusion_matrix.png` → gráficos de qualidade

Pós-treino automatizado:
- `best.pt` é copiado para `backend/model/best.pt` para inferência na API.

---

## Slide 9 — Backend de Inferência
- API FastAPI com endpoints:
  - `GET /health`
  - `POST /detect` (multipart/form-data)
- Configuração via variáveis de ambiente:
  - `SHELFVISION_MODEL_PATH`
  - `SHELFVISION_DEFAULT_CONFIDENCE`
  - `SHELFVISION_DEFAULT_IOU`
  - `SHELFVISION_MOCK_MODE`
- Modos de execução:
  - **Mock** (teste de integração)
  - **YOLO real** (modelo treinado)

---

## Slide 10 — Frontend e Relatório Final
- Upload + preview + detecção híbrida opcional
- Consolidação por fonte (`YOLO`, `OCR`, `Visual`, `COCO`)
- Relatório final inclui:
  - marcas detectadas
  - contagem por marca
  - total de itens
  - distribuição esquerda/centro/direita
  - confiança por marca
  - observações com evidências

---

## Slide 11 — Demo (Roteiro de 3 Minutos)
1. Subir frontend: `start-frontend.bat`
2. Subir backend real: `start-backend-real.bat`
3. Em UI: ativar “Usar backend YOLO” e testar conexão
4. Enviar imagem e mostrar:
   - caixas na imagem
   - resumo
   - relatório de evidências
5. Repetir com backend desligado para mostrar fallback local

---

## Slide 12 — Pontos de Atenção (visão sênior)
- Dataset ainda pequeno para alta robustez em produção
- Qualidade do OCR cai com baixa resolução/oclusão
- Balanceamento de classes e diversidade de cenários impactam mais que só aumentar épocas
- Threshold por marca pode melhorar precisão (em vez de threshold único)

---

## Slide 13 — Próximos Passos
- Aumentar dataset por marca e diversidade de ambiente
- Testar modelos maiores (`yolov8m`/`yolov8l`) para comparação de precisão x latência
- Versionar experimentos e métricas (MLOps básico)
- Exportar para ONNX/TensorFlow.js para reduzir dependência de backend

---

## Slide 14 — Conclusão
- Projeto já entrega valor como MVP funcional
- Arquitetura híbrida reduz risco operacional (fallback local)
- Estratégia multimodelo aumenta qualidade de decisão
- Próximo ganho relevante: escala de dataset + governança de treino

---

## Apêndice — Comandos Úteis
```bash
# Treinar modelo
python train-model.py

# Testar modelo treinado localmente
python test-model.py

# Subir backend mock
start-backend-mock.bat

# Subir backend real
start-backend-real.bat

# Subir frontend
start-frontend.bat
```
