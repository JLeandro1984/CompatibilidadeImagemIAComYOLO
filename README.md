# ShelfVision MVP (Local/Híbrido)

MVP de análise de prateleira com IA rodando no navegador e opção de detecção de marcas por backend YOLOv8 customizado.

## Recursos implementados

- Upload por clique e drag-and-drop
- Preview da imagem
- Modo híbrido opcional com backend Python para detecção de marcas via YOLOv8
- Detecção de objetos com COCO-SSD (TensorFlow.js)
- OCR global e regional (Tesseract.js) para reconhecer marcas escritas na embalagem
- Heurísticas de segmentação e assinatura de cor para reforçar marcas difíceis de ler
- Bounding boxes com confiança
- Contagem de produtos
- Share de prateleira por item
- Análise de layout (esquerda/centro/direita)
- Compatibilidade semântica texto ↔ produtos detectados com Universal Sentence Encoder
- Relatório automático em texto

## Modelos de IA utilizados

O sistema combina camadas locais e híbridas. O fluxo principal continua no navegador, e a camada YOLO é opcional.

| Modelo | Tecnologia | Função |
|---|---|---|
| YOLOv8 customizado | Ultralytics + FastAPI | Detectar marcas diretamente por bounding box e confiança |
| COCO-SSD | TensorFlow.js (MobileNet v2) | Localizar objetos e embalagens na imagem |
| Tesseract.js | OCR | Ler texto e nomes de marcas nas embalagens |
| Universal Sentence Encoder | TensorFlow.js | Medir compatibilidade semântica entre marcas esperadas e detectadas |
| Heurísticas de cor | Código próprio (HSB) | Identificar marcas por assinatura de cor dominante |

### Detalhes

- **YOLOv8 customizado** — camada principal opcional. Quando o backend está ativo, o frontend envia a imagem para a API `/detect`, recebe marcas com confiança e integra o resultado ao motor de regras existente.
- **COCO-SSD** — detecta bounding boxes de objetos genéricos (garrafas, caixas, latas). Não distingue marcas, por isso as etapas seguintes complementam.
- **Tesseract.js** — principal fonte de evidência para confirmar marcas; roda globalmente e por região segmentada da gôndola.
- **Universal Sentence Encoder** — converte frases em vetores numéricos (embeddings) e calcula similaridade de cosseno para gerar o score de compatibilidade do relatório.
- **Heurísticas de cor** — analisam matiz/saturação/brilho (HSB) de cada região; atuam como reforço quando o OCR falha ou o texto não é legível (ex.: vermelho saturado → Coca-Cola, azul → Ruffles, laranja → Fanta).

## Arquitetura híbrida

Pipeline atualizado:

1. Upload da imagem no frontend.
2. Se o backend YOLO estiver ativado, a imagem é enviada para `POST /detect`.
3. O backend retorna `label`, `confidence` e `bbox` por detecção.
4. O frontend cruza YOLO com OCR, catálogo `brands.json` e heurísticas visuais.
5. O relatório final mantém a mesma estrutura do MVP original.

Prioridade de decisão:

1. YOLO acima do threshold configurado.
2. OCR + regras do catálogo JSON.
3. Cor + heurísticas estruturais.

Fallback automático:

- Se o backend estiver desativado, indisponível ou falhar, o fluxo segue apenas com o pipeline local.
- A execução offline do frontend continua suportada.

## Formato obrigatório do relatório

O relatório é orientado a marca e segue este formato:

- `RELATÓRIO DE GÔNDOLA`
- `Marcas identificadas`
- `Contagem de produtos por marca`
- `Total de itens detectados`
- `Distribuição aproximada na prateleira (esquerda/centro/direita)`
- `Confiança média da identificação por marca`
- `Observações` com indicação de evidências (OCR, padrão visual, modelo de visão e repetição de embalagem)

Regras aplicadas:

- Prioridade para identificação por texto/logotipo via OCR
- Agrupamento de produtos visualmente repetidos na mesma marca
- Nunca usar termos genéricos no resultado
- Quando não houver evidência suficiente para marca específica, usar `Marca não identificada`

## Como executar

### Opção 1: Python

```bash
python -m http.server 8000
```

Depois abra:

- http://localhost:8000

Atalho no Windows:

```bash
start-frontend.bat
```

### Backend YOLO opcional

Pré-requisitos:

- Python 3.10+
- Modelo treinado YOLOv8 disponível localmente, por exemplo `backend/model/best.pt`

Instalação:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

Configuração via variáveis de ambiente:

```bash
set SHELFVISION_MODEL_PATH=backend/model/best.pt
set SHELFVISION_HOST=127.0.0.1
set SHELFVISION_PORT=8001
```

Modo de teste sem modelo:

```bash
set SHELFVISION_MOCK_MODE=1
set SHELFVISION_MOCK_BRAND=coca-cola
set SHELFVISION_MOCK_CONFIDENCE=0.88
```

Com `SHELFVISION_MOCK_MODE=1`, a API sobe mesmo sem arquivo `.pt` e retorna detecções simuladas. Isso serve para validar o fluxo híbrido do frontend, o endpoint `/detect` e o relatório, mas não mede precisão real do YOLO.

Execução:

```bash
uvicorn backend.app:app --reload --host 127.0.0.1 --port 8001
```

Atalho no Windows para subir o backend mock:

```bash
start-backend-mock.bat
```

Endpoint principal:

```http
POST /detect
Content-Type: multipart/form-data
```

Resposta:

```json
{
	"detections": [
		{
			"label": "coca-cola",
			"confidence": 0.92,
			"bbox": [120, 48, 96, 212]
		}
	]
}
```

Healthcheck:

```json
{
	"status": "ok",
	"mode": "mock",
	"mock_enabled": true,
	"model_path": "backend/model/best.pt",
	"model_exists": false
}
```

No frontend, ative a opção "Usar backend YOLO", informe a URL da API e ajuste o threshold conforme o treino do modelo.
Use também o botão "Testar conexão do backend" para validar rapidamente o healthcheck antes de analisar uma imagem.

### Opção 2: VS Code Live Server

Abra `index.html` com Live Server.

## Estrutura do backend

- `backend/app.py`: API FastAPI, CORS e endpoints.
- `backend/detector.py`: serviço de inferência e normalização de saídas do Ultralytics.
- `backend/settings.py`: configurações do serviço e caminho do modelo.
- `backend/requirements.txt`: dependências Python.
- `backend/model/.gitkeep`: pasta reservada para futuros pesos, como `best.pt`.
- `start-frontend.bat`: sobe o frontend local com `http.server`.
- `start-backend-mock.bat`: cria o ambiente virtual, instala dependências e sobe o backend em modo mock.

## Observações importantes

- Este MVP combina YOLOv8, COCO-SSD, OCR e heurísticas visuais. Isso melhora casos em que a marca está visível, mas o detector genérico não reconhece a embalagem corretamente.
- Marcas específicas ainda dependem da qualidade da imagem, contraste, oclusão e legibilidade do texto na embalagem.
- O backend não é obrigatório. A interface continua utilizável sem internet e sem servidor rodando.
- O motor atual valida rótulos YOLO com aliases, padrões OCR e evidência visual para reduzir falsos positivos.
- Para produção, é recomendável versionar pesos, métricas do treino e threshold por marca.

## Próximas evoluções sugeridas

- Exportar o modelo para ONNX ou TensorFlow.js para inferência 100% client-side.
- Adicionar cache local das respostas do backend por hash da imagem.
- Armazenar exemplos de falso positivo para retreino incremental.
- Incluir comparação de planograma ideal vs. prateleira real.
