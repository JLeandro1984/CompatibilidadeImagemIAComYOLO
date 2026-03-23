const imageInput = document.getElementById('imageInput');
const descriptionInput = document.getElementById('description');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const analysisProgressEl = document.getElementById('analysisProgress');
const analysisProgressFillEl = document.getElementById('analysisProgressFill');
const reportEl = document.getElementById('report');
const summaryEl = document.getElementById('summary');
const canvas = document.getElementById('canvas');
const dropzone = document.getElementById('dropzone');
const descriptionError = document.getElementById('descriptionError');
const backendToggle = document.getElementById('backendToggle');
const backendUrlInput = document.getElementById('backendUrl');
const backendThresholdInput = document.getElementById('backendThreshold');
const backendModeLabel = document.getElementById('backendModeLabel');
const checkBackendBtn = document.getElementById('checkBackendBtn');
const backendHealthLabel = document.getElementById('backendHealthLabel');
const backendStatusBadge = document.getElementById('backendStatusBadge');
const backendStatusText = document.getElementById('backendStatusText');

function setBackendStatusBadge(state, label) {
  if (backendStatusBadge) backendStatusBadge.dataset.state = state;
  if (backendStatusText) backendStatusText.textContent = label;
}
const context = canvas.getContext('2d');

/** Retorna true quando a descrição contém ao menos uma marca válida. */
function isDescriptionFilled() {
  return descriptionInput.value.trim().length > 0;
}

/** Habilita/desabilita o botão de análise conforme imagem + descrição. */
function updateAnalyzeBtnState() {
  analyzeBtn.disabled = !(selectedImage && isDescriptionFilled());
}

/** Exibe/oculta feedback de validação do campo de descrição. */
function validateDescriptionField() {
  const empty = !isDescriptionFilled();
  descriptionInput.classList.toggle('invalid', empty && descriptionInput.dataset.touched === 'true');
  descriptionError.hidden = !(empty && descriptionInput.dataset.touched === 'true');
  updateAnalyzeBtnState();
}

let selectedImage = null;
let selectedImageFile = null;
let selectedFileMetadata = null;
let objectModel = null;
let textModel = null;
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8001';
const DEFAULT_BACKEND_THRESHOLD = 0.6;
const DETECTION_SOURCES = ['COCO', 'OCR', 'Visual', 'YOLO'];
const OCR_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'com', 'sem', 'por', 'para', 'em', 'na', 'no', 'oferta',
  'preco', 'barato', 'tipo', 'kg', 'g', 'ml', 'l', 'x', 'und', 'un', 'pct', 'cx', 'sabor', 'classicos',
  'zero', 'light', 'classic', 'original', 'tradicional', 'pack', 'combo', 'promocao', 'refrigerante',
]);

const COCO_NOISE_CLASSES = new Set([
  'toothbrush', 'hair drier', 'toilet', 'mouse', 'keyboard', 'remote', 'cell phone', 'tv', 'book',
  'person', 'tie', 'backpack', 'handbag', 'umbrella', 'clock', 'scissors', 'teddy bear',
]);

function createEmptySourceCounts() {
  return DETECTION_SOURCES.reduce((acc, source) => {
    acc[source] = 0;
    return acc;
  }, {});
}

function getBackendBaseUrl() {
  return (backendUrlInput?.value || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
}

function getBackendThreshold() {
  const parsed = Number.parseFloat(backendThresholdInput?.value || `${DEFAULT_BACKEND_THRESHOLD}`);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_BACKEND_THRESHOLD;
  }

  return Math.max(0, Math.min(1, parsed));
}

function isBackendEnabled() {
  return Boolean(backendToggle?.checked && getBackendBaseUrl());
}

function persistHybridSettings() {
  try {
    localStorage.setItem('shelfvision.backend.enabled', backendToggle?.checked ? '1' : '0');
    localStorage.setItem('shelfvision.backend.url', getBackendBaseUrl() || DEFAULT_BACKEND_URL);
    localStorage.setItem('shelfvision.backend.threshold', `${getBackendThreshold()}`);
  } catch (error) {
    console.warn('[ShelfVision] Não foi possível persistir configurações híbridas.', error.message);
  }
}

function updateBackendModeLabel(extraMessage = '') {
  if (!backendModeLabel) {
    return;
  }

  const modeText = isBackendEnabled()
    ? `Modo atual: híbrido com YOLO em ${getBackendBaseUrl()} (threshold ${getBackendThreshold().toFixed(2)}).`
    : 'Modo atual: pipeline local apenas.';

  backendModeLabel.textContent = extraMessage ? `${modeText} ${extraMessage}` : modeText;
}

function setBackendHealthLabel(message, tone = 'neutral') {
  if (!backendHealthLabel) {
    return;
  }

  backendHealthLabel.textContent = message;
  backendHealthLabel.dataset.tone = tone;
}

function initializeHybridSettings() {
  try {
    const savedEnabled = localStorage.getItem('shelfvision.backend.enabled');
    const savedUrl = localStorage.getItem('shelfvision.backend.url');
    const savedThreshold = localStorage.getItem('shelfvision.backend.threshold');

    if (backendToggle && savedEnabled !== null) {
      backendToggle.checked = savedEnabled === '1';
    }
    if (backendUrlInput && savedUrl) {
      backendUrlInput.value = savedUrl;
    }
    if (backendThresholdInput && savedThreshold) {
      backendThresholdInput.value = savedThreshold;
    }
  } catch (error) {
    console.warn('[ShelfVision] Não foi possível restaurar configurações híbridas.', error.message);
  }

  updateBackendModeLabel();
  setBackendHealthLabel('Conexão não testada.');
}

// ---------------------------------------------------------------------------
// CATÁLOGO DE MARCAS — índices em memória carregados de brands.json no startup.
// Mantém defaults embutidos para o sistema funcionar mesmo sem brands.json.
// Para incluir/alterar marca, edite apenas brands.json (sem mudar código).
// ---------------------------------------------------------------------------

/** token -> nome canônico da marca */
const CATALOG_ALIAS_MAP = {
  doritos: 'Doritos', dorito: 'Doritos',
  deitos: 'Doritos', desitos: 'Doritos', deritos: 'Doritos',
  doriitos: 'Doritos', dorltos: 'Doritos', doritoss: 'Doritos', dorlitos: 'Doritos', oritos: 'Doritos',
  nacho: 'Doritos', nachos: 'Doritos', tortilla: 'Doritos', tortilha: 'Doritos', triangulo: 'Doritos',
  fandangos: 'Fandangos', fandango: 'Fandangos', fandang: 'Fandangos', fanda: 'Fandangos', dango: 'Fandangos',
  ruffles: 'Ruffles', rufles: 'Ruffles', ruflles: 'Ruffles', ruflese: 'Ruffles',
  rufly: 'Ruffles', rufiy: 'Ruffles',
  rvffles: 'Ruffles', rvfles: 'Ruffles', raffles: 'Ruffles', ruffes: 'Ruffles', ruffls: 'Ruffles', rufffy: 'Ruffles',
  // Coca-Cola — variações comuns de OCR com ruído em logo cursivo.
  // Evita aliases curtos que sejam substring de palavras frequentes.
  cocacola: 'Coca-Cola', coca: 'Coca-Cola', cola: 'Coca-Cola',
  cocacol: 'Coca-Cola', cocacols: 'Coca-Cola', cocacole: 'Coca-Cola',
  cocaola: 'Coca-Cola', coaola: 'Coca-Cola',
  cokacola: 'Coca-Cola', koka: 'Coca-Cola', kola: 'Coca-Cola',
  cokas: 'Coca-Cola', coka: 'Coca-Cola', ccola: 'Coca-Cola',
  cooca: 'Coca-Cola', cocaa: 'Coca-Cola',
  gocacola: 'Coca-Cola',
  fanta: 'Fanta', sprite: 'Sprite', pepsi: 'Pepsi', guarana: 'Guaraná',
};

/** Regras estruturais de OCR — type: 'contains' | 'startsWith' | 'endsWith'. */
const CATALOG_OCR_PATTERNS = [
  { type: 'contains',   value: 'ritos',   startsWithAny: ['d', 'o'], canonical: 'Doritos' },
  { type: 'endsWith',   value: 'itos',    startsWithAny: ['d', 'o'], canonical: 'Doritos' },
  { type: 'startsWith', value: 'nac',     minLength: 4, canonical: 'Doritos' },
  { type: 'startsWith', value: 'tort',    minLength: 5, canonical: 'Doritos' },
  { type: 'contains',   value: 'fandang', canonical: 'Fandangos' },
  { type: 'contains',   value: 'ndangos', canonical: 'Fandangos' },
  { type: 'contains',   value: 'andango', canonical: 'Fandangos' },
  { type: 'contains',   value: 'fanda',   canonical: 'Fandangos' },
  { type: 'contains',   value: 'dango',   canonical: 'Fandangos' },
  { type: 'startsWith', value: 'ruf',     minLength: 3, canonical: 'Ruffles' },
  { type: 'startsWith', value: 'rvf',     minLength: 3, canonical: 'Ruffles' },
  // 'contains coca' exige substring completa e tamanho mínimo.
  // Isso evita casar com ruídos como "coco" e variações comuns em embalagens.
  { type: 'contains', value: 'coca', minLength: 5, canonical: 'Coca-Cola' },
  { type: 'contains', value: 'coke', minLength: 4, canonical: 'Coca-Cola' },
  // Sprite: combinação por prefixo
  { type: 'startsWith', value: 'spri',    minLength: 5, canonical: 'Sprite' },
  { type: 'startsWith', value: 'sprt',    minLength: 4, canonical: 'Sprite' },
];

/** Assinaturas por matiz dominante — cada regra é avaliada de forma independente. */
const CATALOG_COLOR_HINTS = [
  // Coca-Cola e Doritos compartilham faixa de vermelho.
  // Sozinha, a cor pode empatar; OCR faz o desempate.
  { name: 'Coca-Cola',  hueMin: 340, hueMax: 360, satMin: 90, briMin: 30 },
  { name: 'Coca-Cola',  hueMin:   0, hueMax:  12, satMin: 90, briMin: 30 },
  // Doritos — amarelo/preto (mais específico)
  { name: 'Doritos',    hueMin:  35, hueMax:  65, satMin: 80, briMin: 80 },
  // Fanta — laranja estrito (13–28°), sem sobrepor o amarelo de Doritos.
  { name: 'Fanta',      hueMin:  13, hueMax:  28, satMin: 90, briMin: 80 },
  { name: 'Sprite',     hueMin:  80, hueMax: 160, satMin: 60, briMin: 50 },
  { name: 'Fandangos',  hueMin:  75, hueMax: 145, satMin: 60, briMin: 50 },
  { name: 'Ruffles',    hueMin: 200, hueMax: 260, satMin: 60, briMin: 50 },
  { name: 'Pepsi',      hueMin: 200, hueMax: 255, satMin: 80, briMin: 40 },
];

/**
 * Perfis de detecção — marca canônica -> regras carregadas de brands.json.
 * Cada perfil define combinações mínimas de sinais para confirmar uma marca.
 *
 * Estrutura esperada:
 *   colorSufficient: boolean
 *   rules: Array<{ requiresOCR, requiresColor, minCount }>
 */
const CATALOG_DETECTION_PROFILES = new Map();

// Perfis padrão para marcas pré-carregadas (sobrescritos por brands.json)
const DEFAULT_DETECTION_PROFILES = {
  'Doritos':   { colorSufficient: false, rules: [
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
    { requiresOCR: true,  requiresColor: true,  minCount: 2 },
  ]},
  'Fandangos': { colorSufficient: false, rules: [
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
    { requiresOCR: false, requiresColor: true,  minCount: 3 },
  ]},
  'Ruffles':   { colorSufficient: false, rules: [
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
    { requiresOCR: true,  requiresColor: true,  minCount: 2 },
  ]},
  'Coca-Cola': { colorSufficient: false, rules: [
    { requiresOCR: false, requiresColor: true,  minCount: 2 },
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
    { requiresOCR: true,  requiresColor: true,  minCount: 1 },
  ]},
  'Fanta':     { colorSufficient: true,  rules: [
    { requiresOCR: false, requiresColor: true,  minCount: 2 },
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
  ]},
  'Sprite':    { colorSufficient: true,  rules: [
    { requiresOCR: false, requiresColor: true,  minCount: 2 },
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
  ]},
  'Pepsi':     { colorSufficient: false, rules: [
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
  ]},
  'Guaraná':   { colorSufficient: false, rules: [
    { requiresOCR: true,  requiresColor: false, minCount: 1 },
  ]},
};

Object.entries(DEFAULT_DETECTION_PROFILES).forEach(([canonical, profile]) => {
  CATALOG_DETECTION_PROFILES.set(canonical, profile);
});

/**
 * Valida se as evidências de uma marca atendem ao perfil de detecção.
 *
 * @param {string} brand - nome canônico da marca
 * @param {object} evidence - { count, sourceCounts: { OCR, Visual, COCO } }
 * @param {boolean} hasColorHit - true quando houve match de assinatura de cor
 * @returns {boolean}
 */
function evaluateDetectionProfile(brand, evidence, hasColorHit) {
  const profile = CATALOG_DETECTION_PROFILES.get(brand);
  if (!profile) {
    // Sem perfil: usa regra simples de OCR ou repetição de ocorrência.
    const hasOCR = (evidence.sourceCounts.OCR || 0) >= 1;
    return hasOCR || evidence.count >= 2;
  }

  const hasOCR   = (evidence.sourceCounts.OCR || 0) >= 1;
  const count    = evidence.count || 0;

  // Basta uma regra aprovada (OR entre regras).
  return profile.rules.some((rule) => {
    const ocrOk   = !rule.requiresOCR   || hasOCR;
    const colorOk = !rule.requiresColor || hasColorHit;
    const countOk = count >= (rule.minCount || 1);
    return ocrOk && colorOk && countOk;
  });
}

/**
 * Verifica se um token OCR normalizado corresponde a uma regra do catálogo.
 * Tipos suportados: 'contains', 'startsWith', 'endsWith'.
 */
function matchesOCRPattern(token, rule) {
  let base = false;
  switch (rule.type) {
    case 'contains':   base = token.includes(rule.value); break;
    case 'startsWith': base = token.startsWith(rule.value) && token.length >= (rule.minLength || 0); break;
    case 'endsWith':   base = token.endsWith(rule.value) && token.length >= (rule.minLength || 0); break;
    default: return false;
  }
  if (!base) return false;
  if (rule.startsWithAny) return rule.startsWithAny.some((c) => token.startsWith(c));
  return true;
}

/**
 * Recria todos os índices do catálogo a partir do array de marcas.
 * Chamado por initBrandCatalog() e seguro para múltiplas execuções.
 */
function buildCatalogIndexes(brands) {
  Object.keys(CATALOG_ALIAS_MAP).forEach((k) => delete CATALOG_ALIAS_MAP[k]);
  CATALOG_OCR_PATTERNS.length = 0;
  CATALOG_COLOR_HINTS.length = 0;
  CATALOG_DETECTION_PROFILES.clear();
  brands.forEach((brand) => {
    const { canonical } = brand;
    (brand.aliases || []).forEach((alias) => { CATALOG_ALIAS_MAP[alias] = canonical; });
    (brand.ocrPatterns || []).forEach((p) => CATALOG_OCR_PATTERNS.push({ ...p, canonical }));
    (brand.colorSignatures || []).forEach((s) => CATALOG_COLOR_HINTS.push({ ...s, name: canonical }));
    if (brand.detectionProfile) {
      CATALOG_DETECTION_PROFILES.set(canonical, brand.detectionProfile);
    }
  });
}

/**
 * Carrega brands.json e reconstrói os índices em memória.
 * Se o arquivo falhar, mantém os defaults embutidos.
 */
async function initBrandCatalog() {
  try {
    const res = await fetch('./brands.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const catalog = await res.json();
    buildCatalogIndexes(catalog.brands || []);
    console.info(`[ShelfVision] Catálogo: ${catalog.brands?.length ?? 0} marcas carregadas de brands.json.`);
  } catch (err) {
    console.warn('[ShelfVision] brands.json indisponível — usando defaults embutidos.', err.message);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setAnalysisProgress(percent, message) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  if (analysisProgressFillEl) {
    analysisProgressFillEl.style.width = `${safePercent}%`;
  }
  if (analysisProgressEl) {
    analysisProgressEl.setAttribute('aria-label', `Progresso da análise: ${safePercent}%`);
  }
  setStatus(`${safePercent}% - ${message}`);
}

function setAnalysisStep(step, totalSteps, percent, message) {
  setAnalysisProgress(percent, `Etapa ${step}/${totalSteps} - ${message}`);
}

function resetOutput() {
  summaryEl.innerHTML = '';
  reportEl.textContent = 'Nenhuma análise executada.';
  setAnalysisProgress(0, 'Aguardando análise...');
}

function drawImagePreview(img) {
  const maxSize = 1200;
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo inválido de imagem.'));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

function normalizeProductName(className) {
  return 'Marca não identificada';
}

function summarizeDetections(detections) {
  const grouped = new Map();

  detections.forEach((detection) => {
    if (detection.score < 0.35 || COCO_NOISE_CLASSES.has(detection.class)) {
      return;
    }
    const productName = normalizeProductName(detection.class);

    if (!grouped.has(productName)) {
      grouped.set(productName, []);
    }

    grouped.get(productName).push({
      productName,
      score: detection.score,
      bbox: detection.bbox,
      source: 'COCO',
    });
  });

  const counts = {};
  const boxes = [];
  grouped.forEach((items, name) => {
    const meanScore = items.reduce((acc, item) => acc + item.score, 0) / items.length;
    const keep = items.length >= 2 || meanScore >= 0.8;
    if (!keep) {
      return;
    }

    counts[name] = items.length;
    boxes.push(...items);
  });

  const total = Object.values(counts).reduce((acc, value) => acc + value, 0);
  const share = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { counts, total, share, boxes };
}

function recalculateMetrics(counts, boxes) {
  const total = Object.values(counts).reduce((acc, value) => acc + value, 0);
  const share = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { counts, total, share, boxes };
}

function normalizeWordToken(text) {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/5/g, 's')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeBrandKey(text) {
  return normalizeWordToken(text || '');
}

function normalizeDetectedBrandLabel(label) {
  const normalized = normalizeBrandKey(label);
  if (!normalized) {
    return 'Marca não identificada';
  }

  return CATALOG_ALIAS_MAP[normalized] || resolveBrandByAlias(normalized) || toDisplayLabel(normalized) || 'Marca não identificada';
}

function levenshteinDistance(a, b) {
  if (a === b) {
    return 0;
  }

  if (!a.length) {
    return b.length;
  }

  if (!b.length) {
    return a.length;
  }

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function isSimilarBrandName(expectedName, detectedName) {
  const expectedKey = normalizeBrandKey(expectedName);
  const detectedKey = normalizeBrandKey(detectedName);
  if (!expectedKey || !detectedKey) {
    return false;
  }

  if (expectedKey === detectedKey || expectedKey.includes(detectedKey) || detectedKey.includes(expectedKey)) {
    return true;
  }

  const distance = levenshteinDistance(expectedKey, detectedKey);
  const ratio = distance / Math.max(expectedKey.length, detectedKey.length);
  return distance <= 2 || ratio <= 0.3;
}

function toDisplayLabel(token) {
  if (!token) {
    return null;
  }

  return token.charAt(0).toUpperCase() + token.slice(1);
}

function isLikelyProductToken(token) {
  if (!token) {
    return false;
  }

  if (token.length < 4 || token.length > 24) {
    return false;
  }

  if (/^\d+$/.test(token)) {
    return false;
  }

  if (OCR_STOPWORDS.has(token)) {
    return false;
  }

  return true;
}

function resolveBrandByAlias(token) {
  if (!token) {
    return null;
  }

  // 1) Regras estruturais do catálogo (cobre OCR parcial/ruidoso)
  for (const rule of CATALOG_OCR_PATTERNS) {
    if (matchesOCRPattern(token, rule)) {
      return rule.canonical;
    }
  }

  // 2) Busca exata/substring por alias.
  // Exige tamanho mínimo no caminho alias.includes(token) para evitar falso positivo
  // com tokens curtos e frequentes.
  const aliasEntries = Object.entries(CATALOG_ALIAS_MAP);
  for (const [alias, canonical] of aliasEntries) {
    if (token === alias || token.includes(alias) || (alias.includes(token) && token.length >= 5)) {
      return canonical;
    }
  }

  // 3) Fallback por Levenshtein para ruído de OCR não reconhecido.
  const fuzzyCandidate = aliasEntries
    .map(([alias, canonical]) => {
      const distance = levenshteinDistance(token, alias);
      const ratio = distance / Math.max(token.length, alias.length);
      return { alias, canonical, distance, ratio };
    })
    .sort((a, b) => (a.distance - b.distance) || (a.ratio - b.ratio))[0];

  if (!fuzzyCandidate) {
    return null;
  }

  const aliasLength = fuzzyCandidate.alias.length;
  const isCloseEnough = aliasLength >= 6
    ? (fuzzyCandidate.distance <= 2 || fuzzyCandidate.ratio <= 0.28)
    : (fuzzyCandidate.distance <= 1 && fuzzyCandidate.ratio <= 0.22);
  return isCloseEnough ? fuzzyCandidate.canonical : null;
}

function mapWordToBrand(text) {
  const token = normalizeWordToken(text);
  if (!isLikelyProductToken(token)) {
    return null;
  }

  // Resolução de marca orientada por catálogo (sem regras hardcoded por marca).
  const resolved = resolveBrandByAlias(token);
  if (resolved) {
    return resolved;
  }

  return toDisplayLabel(token);
}

function extractExpectedBrands(expectedText) {
  if (!expectedText || !expectedText.trim()) {
    return [];
  }

  const normalizedText = expectedText
    .replace(/\s+[eE]\s+/g, ',')
    .replace(/\s+(and|AND|And)\s+/g, ',')
    .replace(/[\/&]/g, ',');

  const chunks = normalizedText
    .split(/[\n,;|]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const brands = chunks.flatMap((chunk) => {
    const words = chunk
      .split(/\s+/)
      .map((word) => normalizeBrandKey(word))
      .filter(Boolean);

    const aliasMatches = words
      .map((word) => CATALOG_ALIAS_MAP[word])
      .filter(Boolean);

    if (aliasMatches.length > 0) {
      return aliasMatches;
    }

    const normalized = normalizeBrandKey(chunk);
    if (!normalized) {
      return [];
    }

    if (CATALOG_ALIAS_MAP[normalized]) {
      return [CATALOG_ALIAS_MAP[normalized]];
    }

    const token = chunk.split(/\s+/)[0] || chunk;
    const normalizedToken = normalizeBrandKey(token);
    if (CATALOG_ALIAS_MAP[normalizedToken]) {
      return [CATALOG_ALIAS_MAP[normalizedToken]];
    }

    return [toDisplayLabel(normalized)];
  }).filter(Boolean);

  return [...new Set(brands)];
}

function validateExpectedBrands(expectedText, detectedCounts) {
  const expectedBrands = extractExpectedBrands(expectedText);
  if (expectedBrands.length === 0) {
    return null;
  }

  const detectedBrands = Object.keys(detectedCounts);
  const perBrand = expectedBrands.map((expected) => {
    const matchedBrand = detectedBrands.find((detected) => {
      return isSimilarBrandName(expected, detected);
    });

    return {
      expected,
      matchedBrand,
      count: matchedBrand ? (detectedCounts[matchedBrand] || 0) : 0,
      present: Boolean(matchedBrand),
    };
  });

  const presentCount = perBrand.filter((item) => item.present).length;
  return {
    expectedBrands,
    perBrand,
    coverage: expectedBrands.length > 0 ? presentCount / expectedBrands.length : 0,
  };
}

function pickRepresentativeToken(words) {
  const tokenStats = new Map();

  words.forEach((word) => {
    const token = mapWordToBrand(word.text || '');
    if (!token) {
      return;
    }

    const confidence = Math.max(0, (word.confidence || 0) / 100);
    if (!tokenStats.has(token)) {
      tokenStats.set(token, { weighted: 0, hits: 0 });
    }

    const entry = tokenStats.get(token);
    entry.weighted += Math.max(0.18, confidence);
    entry.hits += 1;
  });

  const ranked = [...tokenStats.entries()]
    .map(([token, stat]) => ({
      token,
      hits: stat.hits,
      weighted: stat.weighted,
      score: stat.weighted / stat.hits,
    }))
    .sort((a, b) => (b.weighted - a.weighted) || (b.hits - a.hits));

  return ranked.find((item) => item.hits >= 2 || item.score >= 0.48) || null;
}

function createWorkingCanvas(width, height) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  return offscreen;
}

function extractRegionImageData(sourceCanvas, bbox) {
  const [x, y, width, height] = bbox;
  const safeX = Math.max(0, Math.floor(x));
  const safeY = Math.max(0, Math.floor(y));
  const safeWidth = Math.max(1, Math.min(sourceCanvas.width - safeX, Math.floor(width)));
  const safeHeight = Math.max(1, Math.min(sourceCanvas.height - safeY, Math.floor(height)));
  const offscreen = createWorkingCanvas(safeWidth, safeHeight);
  const offscreenContext = offscreen.getContext('2d');
  offscreenContext.drawImage(sourceCanvas, safeX, safeY, safeWidth, safeHeight, 0, 0, safeWidth, safeHeight);
  return offscreenContext.getImageData(0, 0, safeWidth, safeHeight);
}

function createPreprocessedCanvas(sourceCanvas, bbox) {
  const [x, y, width, height] = bbox;
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const upscaleFactor = Math.max(2, Math.min(4, Math.ceil(220 / Math.max(safeWidth, safeHeight))));
  const outputWidth = safeWidth * upscaleFactor;
  const outputHeight = safeHeight * upscaleFactor;
  const offscreen = createWorkingCanvas(outputWidth, outputHeight);
  const offscreenContext = offscreen.getContext('2d');
  offscreenContext.imageSmoothingEnabled = true;
  offscreenContext.drawImage(sourceCanvas, x, y, width, height, 0, 0, outputWidth, outputHeight);

  const imageData = offscreenContext.getImageData(0, 0, outputWidth, outputHeight);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const grayscale = (0.299 * red) + (0.587 * green) + (0.114 * blue);
    const boosted = grayscale > 150 ? 255 : grayscale < 80 ? 0 : Math.min(255, grayscale * 1.35);
    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }
  offscreenContext.putImageData(imageData, 0, 0);
  return offscreen;
}

function createGlobalPreprocessedCanvas(sourceCanvas, invert = false) {
  const offscreen = createWorkingCanvas(sourceCanvas.width, sourceCanvas.height);
  const offscreenContext = offscreen.getContext('2d');
  offscreenContext.drawImage(sourceCanvas, 0, 0);

  const imageData = offscreenContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const grayscale = (0.299 * red) + (0.587 * green) + (0.114 * blue);
    const boosted = grayscale > 145 ? 255 : grayscale < 85 ? 0 : Math.min(255, grayscale * 1.3);
    const finalPixel = invert ? 255 - boosted : boosted;
    data[index] = finalPixel;
    data[index + 1] = finalPixel;
    data[index + 2] = finalPixel;
  }

  offscreenContext.putImageData(imageData, 0, 0);
  return offscreen;
}

function buildShelfBands(sourceCanvas) {
  const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  const darkRows = [];
  for (let row = 0; row < sourceCanvas.height; row += 1) {
    let brightnessSum = 0;
    for (let col = 0; col < sourceCanvas.width; col += 4) {
      const pixelIndex = ((row * sourceCanvas.width) + col) * 4;
      const red = imageData[pixelIndex];
      const green = imageData[pixelIndex + 1];
      const blue = imageData[pixelIndex + 2];
      brightnessSum += (red + green + blue) / 3;
    }
    const avgBrightness = brightnessSum / Math.ceil(sourceCanvas.width / 4);
    if (avgBrightness < 55) {
      darkRows.push(row);
    }
  }

  const separators = [];
  let start = null;
  darkRows.forEach((row, index) => {
    if (start === null) {
      start = row;
    }
    const nextRow = darkRows[index + 1];
    if (nextRow === undefined || nextRow - row > 2) {
      if (row - start > 4) {
        separators.push([start, row]);
      }
      start = null;
    }
  });

  const bands = [];
  let previousEnd = 0;
  separators.forEach(([sepStart, sepEnd]) => {
    if (sepStart - previousEnd > 48) {
      bands.push([previousEnd, sepStart]);
    }
    previousEnd = sepEnd;
  });
  if (sourceCanvas.height - previousEnd > 48) {
    bands.push([previousEnd, sourceCanvas.height]);
  }

  return bands.filter(([top, bottom]) => bottom - top > 60);
}

function buildFacingsForBand(sourceCanvas, top, bottom) {
  const height = bottom - top;
  const bandData = context.getImageData(0, top, sourceCanvas.width, height).data;
  const activeColumns = [];

  for (let col = 0; col < sourceCanvas.width; col += 1) {
    let colorfulPixels = 0;
    for (let row = 0; row < height; row += 3) {
      const pixelIndex = ((row * sourceCanvas.width) + col) * 4;
      const red = bandData[pixelIndex];
      const green = bandData[pixelIndex + 1];
      const blue = bandData[pixelIndex + 2];
      const brightness = (red + green + blue) / 3;
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const saturation = maxChannel - minChannel;
      if (brightness > 40 && saturation > 35) {
        colorfulPixels += 1;
      }
    }
    activeColumns.push(colorfulPixels > Math.max(8, height / 10));
  }

  const facings = [];
  let start = null;
  activeColumns.forEach((isActive, col) => {
    if (isActive && start === null) {
      start = col;
    }

    const atEnd = col === activeColumns.length - 1;
    if (start !== null && (!isActive || atEnd)) {
      const end = isActive && atEnd ? col : col - 1;
      const width = end - start;
      if (width > 24) {
        facings.push([start, top, width, height]);
      }
      start = null;
    }
  });

  return facings;
}

function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue;
  if (max === r)      hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else                hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function classifyFacingByColor(sourceCanvas, bbox) {
  const imageData = extractRegionImageData(sourceCanvas, bbox).data;
  let colorfulHits = 0;
  let sampled = 0;
  const hintVotes = {};

  for (let index = 0; index < imageData.length; index += 16) {
    const r = imageData[index];
    const g = imageData[index + 1];
    const b = imageData[index + 2];
    const brightness = (r + g + b) / 3;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const saturation = maxChannel - minChannel;

    sampled += 1;

    if (brightness > 35 && saturation > 32) {
      colorfulHits += 1;
      const hue = rgbToHue(r, g, b);
      for (const hint of CATALOG_COLOR_HINTS) {
        const hueOk = hint.hueMin <= hint.hueMax
          ? hue >= hint.hueMin && hue <= hint.hueMax
          : hue >= hint.hueMin || hue <= hint.hueMax;
        if (hueOk && saturation >= hint.satMin && brightness >= hint.briMin) {
          hintVotes[hint.name] = (hintVotes[hint.name] || 0) + 1;
        }
      }
    }
  }

  if (sampled === 0) {
    return null;
  }

  const colorfulRatio = colorfulHits / sampled;
  if (colorfulRatio <= 0.26) {
    return null;
  }

  // Seleciona a marca com mais votos, exigindo >=25% dos pixels coloridos.
  // Quando duas marcas compartilham faixa de matiz, os votos se dividem.
  // Nesses casos, o OCR faz o desempate.
  let bestBrand = 'Marca não identificada';
  let bestVotes = 0;
  for (const [brand, votes] of Object.entries(hintVotes)) {
    if (votes > bestVotes && votes / colorfulHits >= 0.25) {
      bestVotes = votes;
      bestBrand = brand;
    }
  }

  return {
    productName: bestBrand,
    score: Math.min(0.75, 0.32 + colorfulRatio),
    colorHit: bestBrand !== 'Marca não identificada',
  };
}

function detectBrandsByDenseWindows(sourceCanvas) {
  const widthFractions = [0.12, 0.16, 0.2];
  const heightFractions = [0.16, 0.22, 0.28];
  const boxes = [];
  const counts = {};

  heightFractions.forEach((heightFraction) => {
    widthFractions.forEach((widthFraction) => {
      const windowWidth = Math.max(36, Math.floor(sourceCanvas.width * widthFraction));
      const windowHeight = Math.max(40, Math.floor(sourceCanvas.height * heightFraction));
      const strideX = Math.max(18, Math.floor(windowWidth * 0.45));
      const strideY = Math.max(18, Math.floor(windowHeight * 0.45));

      for (let y = 0; y <= sourceCanvas.height - windowHeight; y += strideY) {
        for (let x = 0; x <= sourceCanvas.width - windowWidth; x += strideX) {
          const bbox = [x, y, windowWidth, windowHeight];
          const classification = classifyFacingByColor(sourceCanvas, bbox);
          if (!classification || classification.score < 0.58) {
            continue;
          }

          boxes.push({
            productName: classification.productName,
            score: classification.score,
            colorHit: classification.colorHit || false,
            bbox,
            source: 'Visual',
          });
        }
      }
    });
  });

  deduplicateBoxes(boxes).forEach((box) => {
    counts[box.productName] = (counts[box.productName] || 0) + 1;
  });

  const uniqueBoxes = deduplicateBoxes(boxes);
  return {
    ...recalculateMetrics(counts, uniqueBoxes),
    confidence: confidenceScore(uniqueBoxes),
  };
}

function calculateIntersectionRatio(boxA, boxB) {
  const [ax, ay, aw, ah] = boxA;
  const [bx, by, bw, bh] = boxB;
  const overlapWidth = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const overlapHeight = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const intersection = overlapWidth * overlapHeight;
  const smallerArea = Math.max(1, Math.min(aw * ah, bw * bh));
  return intersection / smallerArea;
}

/** Consolida múltiplas leituras da mesma marca removendo caixas sobrepostas. */
function deduplicateBoxes(boxes) {
  const uniqueBoxes = [];

  boxes.forEach((candidate) => {
    const duplicateIndex = uniqueBoxes.findIndex((existing) => (
      existing.productName === candidate.productName
      && calculateIntersectionRatio(existing.bbox, candidate.bbox) > 0.55
    ));

    if (duplicateIndex === -1) {
      uniqueBoxes.push(candidate);
      return;
    }

    if (candidate.score > uniqueBoxes[duplicateIndex].score) {
      uniqueBoxes[duplicateIndex] = candidate;
    }
  });

  return uniqueBoxes;
}

/**
 * Mescla resultados de fontes distintas priorizando cobertura de marca.
 * O resultado ainda passa por deduplicação de bbox.
 */
function mergeBrandSources(...sources) {
  const counts = {};
  const boxes = [];

  sources.forEach((source) => {
    Object.entries(source?.counts || {}).forEach(([name, count]) => {
      counts[name] = Math.max(counts[name] || 0, count);
    });

    (source?.boxes || []).forEach((box) => {
      boxes.push(box);
    });
  });

  return {
    counts,
    boxes: deduplicateBoxes(boxes),
  };
}

/**
 * Une o resultado primário (COCO) com fallbacks (YOLO/OCR/Visual)
 * e recalcula métricas globais da análise.
 */
function mergeAnalysis(primary, ...fallbacks) {
  const brandEvidence = mergeBrandSources(...fallbacks);
  const brandNames = new Set(Object.keys(brandEvidence.counts));
  const mergedCounts = { ...primary.counts };

  brandNames.forEach((brand) => {
    mergedCounts[brand] = brandEvidence.counts[brand];
  });

  const preservedPrimaryBoxes = primary.boxes.filter((box) => !brandNames.has(box.productName));
  const mergedBoxes = deduplicateBoxes([...preservedPrimaryBoxes, ...brandEvidence.boxes]);
  return recalculateMetrics(mergedCounts, mergedBoxes);
}

/** Combina confianças de várias fontes por média ponderada de detecções. */
function blendMultipleConfidences(sources) {
  const weighted = sources
    .filter((source) => source && source.boxes && source.boxes.length > 0)
    .reduce((acc, source) => {
      const weight = source.boxes.length;
      acc.score += (source.confidence || confidenceScore(source.boxes)) * weight;
      acc.weight += weight;
      return acc;
    }, { score: 0, weight: 0 });

  if (weighted.weight === 0) {
    return 0;
  }

  return weighted.score / weighted.weight;
}

/**
 * Executa OCR por regiões da gôndola e retorna marcas com bbox local.
 * Usa fallback guiado por marcas esperadas quando o OCR estiver fraco.
 */
async function detectBrandsByOCRInRegions(sourceCanvas, regions, expectedBrandKeys = new Set()) {
  if (typeof Tesseract === 'undefined' || regions.length === 0) {
    return { counts: {}, boxes: [], confidence: 0 };
  }

  const counts = {};
  const boxes = [];
  let confidenceSum = 0;
  let matches = 0;

  for (const bbox of regions) {
    const regionCanvas = createPreprocessedCanvas(sourceCanvas, bbox);
    const result = await Tesseract.recognize(regionCanvas, 'eng+por', {
      logger: () => {},
    });

    const words = result?.data?.words || [];
    let bestToken = pickRepresentativeToken(words);

    // Fallback para marcas esperadas: aceita palavra única com confiança >= 0.08.
    if (!bestToken && expectedBrandKeys.size > 0) {
      for (const word of words) {
        const mapped = mapWordToBrand(word.text || '');
        if (!mapped) continue;
        if (expectedBrandKeys.has(normalizeBrandKey(mapped)) && (word.confidence || 0) >= 8) {
          bestToken = { token: mapped, score: Math.max(0.12, (word.confidence || 0) / 100) };
          break;
        }
      }
    }

    if (!bestToken) {
      continue;
    }

    const brand = bestToken.token;
    const score = Math.max(0.35, bestToken.score);
    counts[brand] = (counts[brand] || 0) + 1;
    boxes.push({ productName: brand, score, bbox, source: 'OCR' });
    confidenceSum += score;
    matches += 1;
  }

  return {
    counts,
    boxes,
    confidence: matches > 0 ? confidenceSum / matches : 0,
  };
}

/**
 * Pipeline heurístico regional: cor + OCR local em "facings" da prateleira.
 * Útil para reforçar marcas quando o detector principal não fecha resultado.
 */
async function detectBrandsByShelfHeuristics(sourceCanvas, expectedBrandKeys = new Set()) {
  const bands = buildShelfBands(sourceCanvas);
  const regions = bands.flatMap(([top, bottom]) => buildFacingsForBand(sourceCanvas, top, bottom));

  const counts = {};
  const boxes = [];
  regions.forEach((bbox) => {
    const classification = classifyFacingByColor(sourceCanvas, bbox);
    if (!classification) {
      return;
    }
    counts[classification.productName] = (counts[classification.productName] || 0) + 1;
    boxes.push({
      productName: classification.productName,
      score: classification.score,
      colorHit: classification.colorHit || false,
      bbox,
      source: 'Visual',
    });
  });

  const ocrResult = await detectBrandsByOCRInRegions(sourceCanvas, regions, expectedBrandKeys);
  const mergedCounts = { ...counts };
  Object.entries(ocrResult.counts).forEach(([name, count]) => {
    mergedCounts[name] = Math.max(mergedCounts[name] || 0, count);
  });

  const mergedBoxes = [...boxes, ...ocrResult.boxes];
  return {
    ...recalculateMetrics(mergedCounts, mergedBoxes),
    confidence: blendConfidence(confidenceScore(boxes), ocrResult.confidence, boxes, ocrResult.boxes),
  };
}

/**
 * Varre a imagem por grade fixa para capturar padrões visuais amplos.
 * Atua como fallback de baixa granularidade baseado em cor.
 */
function detectBrandsByGridSignature(sourceCanvas) {
  const rows = 8;
  const cols = 6;
  const cellWidth = sourceCanvas.width / cols;
  const cellHeight = sourceCanvas.height / rows;
  const counts = {};
  const boxes = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const bbox = [col * cellWidth, row * cellHeight, cellWidth, cellHeight];
      const imageData = extractRegionImageData(sourceCanvas, bbox).data;
      let brightPixels = 0;
      for (let index = 0; index < imageData.length; index += 16) {
        const brightness = (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
        if (brightness > 45) {
          brightPixels += 1;
        }
      }

      if (brightPixels < 40) {
        continue;
      }

      const classification = classifyFacingByColor(sourceCanvas, bbox);
      if (!classification || classification.score < 0.5) {
        continue;
      }

      counts[classification.productName] = (counts[classification.productName] || 0) + 1;
      boxes.push({
        productName: classification.productName,
        score: classification.score,
        bbox,
        source: 'Visual',
      });
    }
  }

  return {
    ...recalculateMetrics(counts, boxes),
    confidence: confidenceScore(boxes),
  };
}

/**
 * Executa OCR global em múltiplas versões da imagem (normal e pré-processada)
 * para aumentar robustez de leitura de logotipos/textos.
 */
async function detectBrandsByOCR(expectedBrandKeys = new Set()) {
  if (typeof Tesseract === 'undefined') {
    return { counts: {}, boxes: [], confidence: 0 };
  }

  const counts = {};
  const boxes = [];
  let confidenceSum = 0;
  let confidenceHits = 0;

  const tokenStats = new Map();
  const ocrInputs = [
    canvas,
    createGlobalPreprocessedCanvas(canvas, false),
    createGlobalPreprocessedCanvas(canvas, true),
  ];

  for (const input of ocrInputs) {
    const result = await Tesseract.recognize(input, 'eng+por', {
      logger: () => {},
    });

    (result?.data?.words || []).forEach((word) => {
      const token = mapWordToBrand(word.text || '');
      const confidence = Math.max(0, (word.confidence || 0) / 100);
      const isExpected = token && expectedBrandKeys.has(normalizeBrandKey(token));
      // Para marcas esperadas, aceita confiança menor (logos estilizados tendem a pontuar baixo).
      const minGate = isExpected ? 0.03 : 0.08;
      if (!token || confidence < minGate) {
        return;
      }

      if (!tokenStats.has(token)) {
        tokenStats.set(token, { weighted: 0, hits: 0, words: [] });
      }

      const entry = tokenStats.get(token);
      entry.weighted += Math.max(0.08, confidence);
      entry.hits += 1;
      entry.words.push(word);
    });
  }

  tokenStats.forEach((entry, token) => {
    const averageScore = entry.weighted / entry.hits;
    const isExpected = expectedBrandKeys.has(normalizeBrandKey(token));
    // Para marcas esperadas, baixa um pouco o limiar médio, mas mantém >=2 hits.
    // Apenas ser "esperada" não aprova single-hit (evita falso positivo por descrição).
    const accepted = entry.hits >= 2 || averageScore >= 0.42
      || (isExpected && entry.hits >= 2 && averageScore >= 0.25);
    if (!accepted) {
      return;
    }

    counts[token] = entry.hits;

    entry.words.forEach((word) => {
      const confidence = Math.max(0.18, (word.confidence || 0) / 100);
      const x = word.bbox?.x0 || 0;
      const y = word.bbox?.y0 || 0;
      const width = Math.max(1, (word.bbox?.x1 || x + 1) - x);
      const height = Math.max(1, (word.bbox?.y1 || y + 1) - y);

      boxes.push({
        productName: token,
        score: confidence,
        bbox: [x, y, width, height],
        source: 'OCR',
      });

      confidenceSum += confidence;
      confidenceHits += 1;
    });
  });

  return {
    counts,
    boxes,
    confidence: confidenceHits > 0 ? confidenceSum / confidenceHits : 0,
  };
}

/**
 * Consulta o backend YOLO opcional e normaliza o retorno para o formato interno.
 * Em caso de falha, devolve estrutura vazia para permitir fallback local.
 */
async function detectBrandsByBackend(file, expectedBrandKeys = new Set()) {
  if (!isBackendEnabled() || !file) {
    return { counts: {}, boxes: [], confidence: 0, used: false, error: null };
  }

  try {
    const threshold = getBackendThreshold();
    const formData = new FormData();
    formData.append('file', file, file.name || 'shelf-image');
    formData.append('confidence', `${threshold}`);

    const response = await fetch(`${getBackendBaseUrl()}/detect`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload.detail || message;
      } catch (parseError) {
        // Ignora corpo de erro malformado e mantém o status HTTP original.
      }
      throw new Error(message);
    }

    const payload = await response.json();
    const boxes = [];

    (payload?.detections || []).forEach((detection) => {
      const bbox = Array.isArray(detection?.bbox) ? detection.bbox.map((value) => Number(value) || 0) : null;
      const score = Number(detection?.confidence) || 0;
      if (!bbox || bbox.length !== 4 || score < threshold) {
        return;
      }

      const productName = normalizeDetectedBrandLabel(detection.label);
      const normalizedBrand = normalizeBrandKey(productName);
      const matchesExpected = expectedBrandKeys.size === 0 || expectedBrandKeys.has(normalizedBrand);
      if (!matchesExpected && productName === 'Marca não identificada') {
        return;
      }

      boxes.push({
        productName,
        score: Math.min(0.99, score),
        bbox,
        source: 'YOLO',
      });
    });

    const uniqueBoxes = deduplicateBoxes(boxes);
    const counts = {};
    uniqueBoxes.forEach((box) => {
      counts[box.productName] = (counts[box.productName] || 0) + 1;
    });

    return {
      ...recalculateMetrics(counts, uniqueBoxes),
      confidence: confidenceScore(uniqueBoxes),
      used: uniqueBoxes.length > 0,
      error: null,
    };
  } catch (error) {
    console.warn('[ShelfVision] Falha ao consultar backend YOLO. Mantendo fallback local.', error.message);
    return {
      counts: {},
      boxes: [],
      confidence: 0,
      used: false,
      error: error.message,
    };
  }
}

async function checkBackendHealth() {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    setBackendHealthLabel('Informe a URL da API antes de testar.', 'error');
    return;
  }

  if (checkBackendBtn) {
    checkBackendBtn.disabled = true;
  }
  setBackendHealthLabel('Verificando backend...', 'neutral');
  setBackendStatusBadge('checking', 'Verificando…');

  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const mode = payload.mode || 'desconhecido';
    const modelStatus = payload.model_exists ? 'modelo presente' : 'modelo ausente';
    setBackendHealthLabel(`Backend online: modo ${mode}, ${modelStatus}.`, 'success');
    setBackendStatusBadge('online', mode === 'mock' ? 'Ativo (mock)' : 'Ativo');
    updateBackendModeLabel(mode === 'mock' ? 'Backend em modo mock.' : 'Backend pronto para inferência.');
  } catch (error) {
    setBackendHealthLabel(`Falha ao acessar o backend: ${error.message}`, 'error');
    setBackendStatusBadge('offline', 'Desconectado');
  } finally {
    if (checkBackendBtn) {
      checkBackendBtn.disabled = false;
    }
  }
}

function drawBoxes(boxes) {
  context.lineWidth = 2;
  context.font = '12px Inter, sans-serif';

  boxes.forEach((box) => {
    const [x, y, width, height] = box.bbox;
    context.strokeStyle = '#22d3ee';
    context.fillStyle = 'rgba(2, 6, 23, 0.82)';
    context.strokeRect(x, y, width, height);
    const label = `${box.productName} ${(box.score * 100).toFixed(0)}%`;
    const textWidth = context.measureText(label).width + 8;
    const textY = y > 18 ? y - 18 : y + 2;
    context.fillRect(x, textY, textWidth, 16);
    context.fillStyle = '#f8fafc';
    context.fillText(label, x + 4, textY + 12);
  });
}

function analyzeLayout(boxes) {
  if (boxes.length === 0) {
    return { esquerda: 0, centro: 0, direita: 0 };
  }

  const thirds = { esquerda: 0, centro: 0, direita: 0 };
  boxes.forEach((box) => {
    const [x, , width] = box.bbox;
    const centerX = x + width / 2;
    const ratio = centerX / canvas.width;
    if (ratio < 0.33) {
      thirds.esquerda += 1;
    } else if (ratio < 0.66) {
      thirds.centro += 1;
    } else {
      thirds.direita += 1;
    }
  });

  return thirds;
}

/**
 * Mede compatibilidade semântica entre marcas esperadas e detectadas usando USE.
 * Retorna score global e score por marca.
 */
async function semanticCompatibility(expectedText, detectedProducts) {
  if (!expectedText.trim() || detectedProducts.length === 0) {
    return { overall: 0, perProduct: [] };
  }

  if (!textModel) {
    setStatus('Carregando modelo semântico (USE)...');
    textModel = await use.load();
  }

  const productTexts = detectedProducts;

  const embeddings = await textModel.embed([expectedText, ...productTexts]);
  const matrix = await embeddings.array();
  const textVector = matrix[0];

  const perProduct = detectedProducts.map((name, idx) => {
    const similarity = cosineSimilarity(textVector, matrix[idx + 1]);
    return {
      name,
      compatibility: Math.max(0, Math.min(1, (similarity + 1) / 2)),
    };
  });

  const overall = perProduct.reduce((sum, item) => sum + item.compatibility, 0) / perProduct.length;
  return { overall, perProduct };
}

function confidenceScore(boxes) {
  if (boxes.length === 0) {
    return 0;
  }
  return boxes.reduce((sum, box) => sum + box.score, 0) / boxes.length;
}

function getEvidenceAdjustedConfidence(evidence) {
  if (!evidence || !evidence.count) {
    return 0;
  }

  const average = evidence.confidenceSum / evidence.count;
  let boost = 0;
  if ((evidence.sourceCounts.YOLO || 0) > 0 && (evidence.sourceCounts.OCR || 0) > 0) {
    boost += 0.08;
  } else if ((evidence.sourceCounts.YOLO || 0) > 0 && (evidence.colorHits || 0) > 0) {
    boost += 0.04;
  }

  return Math.min(0.99, average + boost);
}

function blendConfidence(primaryConfidence, fallbackConfidence, primaryBoxes, fallbackBoxes) {
  const primaryWeight = primaryBoxes.length;
  const fallbackWeight = fallbackBoxes.length;
  const totalWeight = primaryWeight + fallbackWeight;

  if (totalWeight === 0) {
    return 0;
  }

  return ((primaryConfidence * primaryWeight) + (fallbackConfidence * fallbackWeight)) / totalWeight;
}

function renderSummary(data) {
  const lines = [
    `Marcas detectadas: ${Object.keys(data.counts).length}`,
    `Total de itens: ${data.total}`,
    `Confiança da identificação: ${(data.confidence * 100).toFixed(1)}%`,
  ];

  summaryEl.innerHTML = lines.map((line) => `<li>${line}</li>`).join('');
}

function formatFileDateTime(lastModified) {
  if (!Number.isFinite(lastModified) || lastModified <= 0) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(lastModified));
}

/** Agrega evidências por marca para apoiar validação final e relatório. */
function buildBrandEvidenceSummary(boxes) {
  const byBrand = new Map();

  boxes.forEach((box) => {
    const brand = box.productName || 'Marca não identificada';
    if (!byBrand.has(brand)) {
      byBrand.set(brand, {
        count: 0,
        confidenceSum: 0,
        colorHits: 0,
        aspectSum: 0,
        tallCount: 0,
        wideCount: 0,
        sourceCounts: createEmptySourceCounts(),
      });
    }

    const entry = byBrand.get(brand);
    entry.count += 1;
    entry.confidenceSum += box.score || 0;
    if (box.colorHit) entry.colorHits += 1;
    const width = Math.max(1, box.bbox?.[2] || 1);
    const height = Math.max(1, box.bbox?.[3] || 1);
    const aspectRatio = width / height;
    entry.aspectSum += aspectRatio;
    if (aspectRatio >= 1.1) {
      entry.wideCount += 1;
    } else {
      entry.tallCount += 1;
    }
    const source = box.source || 'Visual';
    if (!entry.sourceCounts[source]) {
      entry.sourceCounts[source] = 0;
    }
    entry.sourceCounts[source] += 1;
  });

  return byBrand;
}

function formatBrandObservation(brand, evidence) {
  const evidenceParts = [];
  if ((evidence.sourceCounts.YOLO || 0) > 0) {
    evidenceParts.push('detector de marcas (YOLO)');
  }
  if ((evidence.sourceCounts.OCR || 0) > 0) {
    evidenceParts.push('OCR');
  }
  if ((evidence.sourceCounts.Visual || 0) > 0) {
    evidenceParts.push('padrão visual');
  }
  if ((evidence.sourceCounts.COCO || 0) > 0) {
    evidenceParts.push('modelo de visão');
  }
  if (evidence.count >= 2) {
    evidenceParts.push('repetição de embalagem');
  }

  if (brand === 'Marca não identificada') {
    return '- Marca não identificada: evidências insuficientes para inferir marca com segurança.';
  }

  if (evidenceParts.length === 0) {
    return `- ${brand}: identificado com baixa evidência direta.`;
  }

  return `- ${brand}: identificação baseada em ${evidenceParts.join(', ')}.`;
}

function passesBrandSpecificGuards(brand, evidence) {
  if (brand !== 'Coca-Cola') {
    return true;
  }

  const ocrHits = evidence.sourceCounts.OCR || 0;
  if (ocrHits > 0) {
    return true;
  }

  const visualHits = evidence.sourceCounts.Visual || 0;
  if (visualHits < 2) {
    return false;
  }

  const avgAspect = evidence.count > 0 ? (evidence.aspectSum || 0) / evidence.count : 0;
  const wideDominant = (evidence.wideCount || 0) > (evidence.tallCount || 0);

  // Coca-Cola sem OCR só é aceita com padrão geométrico mais vertical/neutro.
  // Se a maioria é "larga" e com aspecto de pacote, tratamos como falso positivo por cor.
  return !wideDominant && avgAspect <= 1.05;
}

/**
 * Aplica regras finais de aprovação por marca com base em múltiplos sinais.
 * O que não for aprovado é movido para "Marca não identificada".
 */
function applyBrandEvidenceThreshold(data, brandEvidence, expectedBrands = []) {
  const resolvedCounts = {};
  const resolvedEvidence = new Map();
  let unknownCarryCount = 0;
  let unknownCarryConfidence = 0;
  const unknownCarrySources = createEmptySourceCounts();
  const expectedKeys = new Set(expectedBrands.map((brand) => normalizeBrandKey(brand)));

  Object.entries(data.counts).forEach(([brand, count]) => {
    const evidence = brandEvidence.get(brand) || {
      count,
      confidenceSum: 0,
      sourceCounts: createEmptySourceCounts(),
    };

    if (brand === 'Marca não identificada') {
      resolvedCounts[brand] = (resolvedCounts[brand] || 0) + count;
      resolvedEvidence.set(brand, {
        count: (resolvedEvidence.get(brand)?.count || 0) + evidence.count,
        confidenceSum: (resolvedEvidence.get(brand)?.confidenceSum || 0) + evidence.confidenceSum,
        sourceCounts: {
          COCO: (resolvedEvidence.get(brand)?.sourceCounts?.COCO || 0) + (evidence.sourceCounts.COCO || 0),
          OCR: (resolvedEvidence.get(brand)?.sourceCounts?.OCR || 0) + (evidence.sourceCounts.OCR || 0),
          Visual: (resolvedEvidence.get(brand)?.sourceCounts?.Visual || 0) + (evidence.sourceCounts.Visual || 0),
          YOLO: (resolvedEvidence.get(brand)?.sourceCounts?.YOLO || 0) + (evidence.sourceCounts.YOLO || 0),
        },
      });
      return;
    }

    const averageConfidence = getEvidenceAdjustedConfidence(evidence);
    const hasColorHit = (evidence.colorHits || 0) >= 1;
    const matchesExpected = expectedKeys.has(normalizeBrandKey(brand));
    const hasYOLO = (evidence.sourceCounts.YOLO || 0) > 0;
    const hasOCR = (evidence.sourceCounts.OCR || 0) > 0;

    // Validação multissinal por perfil:
    // requiresOCR + requiresColor + minCount precisam passar em ao menos uma regra.
    // approvedByExpected reforça OCR, mas não ignora requisito de cor.
    const profileApproved = evaluateDetectionProfile(brand, evidence, hasColorHit);
    const approvedByYOLO = hasYOLO && (averageConfidence >= getBackendThreshold() || hasOCR || matchesExpected || evidence.count >= 2);

    // Para marcas esperadas com OCR, relaxa o minCount para 1.
    const relaxedForExpected = matchesExpected
      && hasOCR
      && averageConfidence >= 0.25;

    const approved = (approvedByYOLO || profileApproved || relaxedForExpected) && passesBrandSpecificGuards(brand, evidence);

    if (approved) {
      resolvedCounts[brand] = count;
      resolvedEvidence.set(brand, evidence);
      return;
    }

    unknownCarryCount += count;
    unknownCarryConfidence += evidence.confidenceSum;
    DETECTION_SOURCES.forEach((source) => {
      unknownCarrySources[source] += evidence.sourceCounts[source] || 0;
    });
  });

  if (unknownCarryCount > 0) {
    resolvedCounts['Marca não identificada'] = (resolvedCounts['Marca não identificada'] || 0) + unknownCarryCount;
    const currentUnknown = resolvedEvidence.get('Marca não identificada') || {
      count: 0,
      confidenceSum: 0,
      sourceCounts: createEmptySourceCounts(),
    };

    resolvedEvidence.set('Marca não identificada', {
      count: currentUnknown.count + unknownCarryCount,
      confidenceSum: currentUnknown.confidenceSum + unknownCarryConfidence,
      sourceCounts: {
        COCO: currentUnknown.sourceCounts.COCO + unknownCarrySources.COCO,
        OCR: currentUnknown.sourceCounts.OCR + unknownCarrySources.OCR,
        Visual: currentUnknown.sourceCounts.Visual + unknownCarrySources.Visual,
        YOLO: currentUnknown.sourceCounts.YOLO + unknownCarrySources.YOLO,
      },
    });
  }

  if (Object.keys(resolvedCounts).length === 0) {
    resolvedCounts['Marca não identificada'] = data.total || 0;
    resolvedEvidence.set('Marca não identificada', {
      count: data.total || 0,
      confidenceSum: 0,
      sourceCounts: createEmptySourceCounts(),
    });
  }

  return { resolvedCounts, resolvedEvidence };
}

function buildDetectedItemsSection(data) {
  if (!data.share.length) {
    return [];
  }

  const sections = ['DETALHAMENTO DINÂMICO DOS ITENS', ''];
  const topItems = data.share.slice(0, 10);
  topItems.forEach((item) => {
    sections.push(`- ${item.name}: ${item.count} deteccao(oes) (${item.percentage.toFixed(1)}%)`);
  });

  const dominant = topItems[0];
  if (dominant) {
    sections.push('', `Item com maior presenca visual: ${dominant.name}.`);
  }

  return sections;
}

function buildSourceEvidenceSection(data) {
  if (!data.boxes.length) {
    return [];
  }

  const sourceMap = new Map();
  data.boxes.forEach((box) => {
    const source = box.source || 'Desconhecida';
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { total: 0, items: new Map() });
    }

    const sourceEntry = sourceMap.get(source);
    sourceEntry.total += 1;
    sourceEntry.items.set(box.productName, (sourceEntry.items.get(box.productName) || 0) + 1);
  });

  const orderedSources = ['YOLO', 'OCR', 'Visual', 'COCO'];
  const sections = ['EVIDÊNCIAS POR FONTE', ''];

  orderedSources.forEach((source) => {
    const entry = sourceMap.get(source);
    if (!entry) {
      return;
    }

    sections.push(`${source}: ${entry.total} deteccao(oes)`);
    const topItems = [...entry.items.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name} (${count})`)
      .join(', ');

    sections.push(`Itens: ${topItems || 'N/A'}`, '');
  });

  [...sourceMap.keys()]
    .filter((source) => !orderedSources.includes(source))
    .forEach((source) => {
      const entry = sourceMap.get(source);
      sections.push(`${source}: ${entry.total} deteccao(oes)`, '');
    });

  return sections;
}

/**
 * Gera o texto final do relatório com foco nas marcas esperadas
 * e nas evidências efetivamente aprovadas.
 */
function buildReport(data, expectedText, fileMetadata) {
  const brandEvidence = buildBrandEvidenceSummary(data.boxes);
  const expectedBrands = extractExpectedBrands(expectedText);
  const thresholded = applyBrandEvidenceThreshold(data, brandEvidence, expectedBrands);
  const expectedReference = expectedBrands.length > 0
    ? validateExpectedBrands(expectedText, thresholded.resolvedCounts)
    : null;
  const usingDescriptionFocus = Boolean(expectedReference && expectedReference.expectedBrands.length > 0);

  const focusedBrands = usingDescriptionFocus
    ? expectedReference.expectedBrands
    : (Object.keys(thresholded.resolvedCounts).length > 0
      ? Object.keys(thresholded.resolvedCounts)
      : ['Marca não identificada']);

  const detectedPositiveBrands = Object.entries(thresholded.resolvedCounts)
    .filter(([brand, count]) => brand !== 'Marca não identificada' && count > 0)
    .map(([brand]) => brand);

  const focusedCounts = {};
  focusedBrands.forEach((brand) => {
    if (!usingDescriptionFocus) {
      focusedCounts[brand] = thresholded.resolvedCounts[brand] || 0;
      return;
    }

    const matchedDetectedBrand = Object.keys(thresholded.resolvedCounts)
      .find((detectedBrand) => isSimilarBrandName(brand, detectedBrand));
    focusedCounts[brand] = matchedDetectedBrand ? (thresholded.resolvedCounts[matchedDetectedBrand] || 0) : 0;
  });

  const countLines = focusedBrands.map((brand) => `- ${brand}: ${focusedCounts[brand] || 0}`);

  const expectedStatusLines = usingDescriptionFocus
    ? focusedBrands.map((brand) => {
      const count = focusedCounts[brand] || 0;
      return `- ${brand}: ${count > 0 ? 'detectada' : 'não detectada'} (${count})`;
    })
    : [];

  const focusedTotal = Object.values(focusedCounts).reduce((sum, count) => sum + count, 0);

  const compatibilityLines = focusedBrands.map((brand) => {
    const count = focusedCounts[brand] || 0;
    const compatibility = focusedTotal > 0 ? (count / focusedTotal) * 100 : 0;
    return `- ${brand}: ${compatibility.toFixed(1)}%`;
  });

  const confidenceLines = focusedBrands.map((brand) => {
    const evidence = thresholded.resolvedEvidence.get(brand);
    if (!evidence || evidence.count === 0) {
      return `- ${brand}: 0.0%`;
    }

    const average = getEvidenceAdjustedConfidence(evidence) * 100;
    return `- ${brand}: ${average.toFixed(1)}%`;
  });

  const observationLines = focusedBrands.map((brand) => {
    const evidence = thresholded.resolvedEvidence.get(brand) || {
      count: focusedCounts[brand] || 0,
      sourceCounts: createEmptySourceCounts(),
    };
    return formatBrandObservation(brand, evidence);
  });

  return [
    'RELATÓRIO DE GÔNDOLA',
    '',
    `Arquivo analisado: ${fileMetadata?.name || 'N/A'}`,
    `Data/hora do arquivo: ${formatFileDateTime(fileMetadata?.lastModified)}`,
    '',
    ...(usingDescriptionFocus
      ? ['Marcas esperadas (descrição):', ...focusedBrands.map((brand) => `- ${brand}`), '']
      : []),
    ...(usingDescriptionFocus
      ? ['Status das marcas esperadas:', ...expectedStatusLines, '']
      : []),
    'Marcas realmente detectadas na imagem:',
    ...(detectedPositiveBrands.length > 0
      ? detectedPositiveBrands.map((brand) => `- ${brand}`)
      : ['- Nenhuma marca confirmada']),
    '',
    'Contagem de produtos por marca:',
    ...countLines,
    '',
    `Total de itens detectados: ${focusedTotal}`,
    '',
    'Compatibilidade com os nomes da descrição:',
    ...compatibilityLines,
    '',
    'Distribuição aproximada na prateleira:',
    `- esquerda: ${data.layout.esquerda}`,
    `- centro: ${data.layout.centro}`,
    `- direita: ${data.layout.direita}`,
    '',
    'Confiança média da identificação por marca:',
    ...confidenceLines,
    '',
    'Observações:',
    ...observationLines,
    ...(expectedReference ? [`- Cobertura da descrição: ${(expectedReference.coverage * 100).toFixed(1)}%`] : []),
  ].join('\n');
}

/**
 * Orquestrador principal da análise: YOLO opcional + COCO + OCR + heurísticas,
 * seguido de fusão, validação e geração do relatório final.
 */
async function analyzeShelf() {
  const totalSteps = 11;
  if (!selectedImage) {
    return;
  }

  // Marca o campo como interagido e valida antes de iniciar o pipeline.
  descriptionInput.dataset.touched = 'true';
  validateDescriptionField();
  if (!isDescriptionFilled()) {
    descriptionInput.focus();
    setStatus('Informe as marcas esperadas antes de analisar.');
    return;
  }

  analyzeBtn.disabled = true;
  setAnalysisStep(1, totalSteps, 0, 'Iniciando análise...');
  setAnalysisStep(2, totalSteps, 5, 'Preparando imagem (compressão/redimensionamento)...');
  drawImagePreview(selectedImage);

  try {
    const expectedBrandsForOCR = extractExpectedBrands(descriptionInput.value);
    const expectedBrandKeys = new Set(expectedBrandsForOCR.map((brand) => normalizeBrandKey(brand)));

    setAnalysisStep(3, totalSteps, 14, 'Consultando detector YOLO no backend (opcional)...');
    const backendSummary = await detectBrandsByBackend(selectedImageFile, expectedBrandKeys);
    if (backendSummary.error) {
      updateBackendModeLabel('Fallback local ativado automaticamente.');
    } else {
      updateBackendModeLabel(backendSummary.used ? 'Backend respondeu com sucesso.' : 'Nenhuma detecção remota confirmada.');
    }

    if (!objectModel) {
      setAnalysisStep(4, totalSteps, 22, 'Carregando modelo de detecção (COCO-SSD)...');
      objectModel = await cocoSsd.load({ base: 'mobilenet_v2' });
    }

    setAnalysisStep(5, totalSteps, 32, 'Detectando produtos e embalagens...');
    const detections = await objectModel.detect(canvas);

    const summarized = summarizeDetections(detections);

    setAnalysisStep(6, totalSteps, 46, 'Executando OCR global...');
    const ocrFallback = await detectBrandsByOCR(expectedBrandKeys);

    setAnalysisStep(7, totalSteps, 60, 'Segmentando a gôndola para OCR regional e cor...');
    const heuristicFallback = await detectBrandsByShelfHeuristics(canvas, expectedBrandKeys);

    setAnalysisStep(8, totalSteps, 72, 'Validando assinaturas visuais por grade...');
    const gridFallback = detectBrandsByGridSignature(canvas);

    setAnalysisStep(9, totalSteps, 82, 'Procurando itens em janelas menores da imagem...');
    const denseWindowFallback = detectBrandsByDenseWindows(canvas);

    setAnalysisStep(10, totalSteps, 90, 'Consolidando contagem, share e layout...');
    const finalSummary = mergeAnalysis(summarized, backendSummary, ocrFallback, heuristicFallback, gridFallback, denseWindowFallback);

    const brandEvidence = buildBrandEvidenceSummary(finalSummary.boxes);
    const thresholded = applyBrandEvidenceThreshold(finalSummary, brandEvidence, expectedBrandsForOCR);
    const approvedBrands = new Set(Object.keys(thresholded.resolvedCounts));
    const filteredBoxes = deduplicateBoxes(
      finalSummary.boxes.filter((box) => approvedBrands.has(box.productName)),
    );
    const filteredSummary = recalculateMetrics(thresholded.resolvedCounts, filteredBoxes);

    drawImagePreview(selectedImage);
    drawBoxes(filteredSummary.boxes);

    setAnalysisStep(10, totalSteps, 96, 'Calculando compatibilidade e confiança...');
    const detectedProducts = Object.keys(filteredSummary.counts);
    const compatibility = await semanticCompatibility(descriptionInput.value, detectedProducts);
    const layout = analyzeLayout(filteredSummary.boxes);
    const confidence = blendMultipleConfidences([backendSummary, summarized, ocrFallback, heuristicFallback, gridFallback, denseWindowFallback]);

    const result = {
      ...filteredSummary,
      compatibility,
      layout,
      confidence,
    };

    renderSummary(result);
    reportEl.textContent = buildReport(result, descriptionInput.value.trim(), selectedFileMetadata);
    setAnalysisStep(11, totalSteps, 100, 'Análise concluída.');
  } catch (error) {
    console.error(error);
    setStatus(`Erro na análise: ${error.message}`);
    setAnalysisProgress(0, 'Falha na análise.');
  } finally {
    updateAnalyzeBtnState();
  }
}

/**
 * Carrega a imagem selecionada, atualiza preview/estado da UI
 * e prepara metadados para o relatório.
 */
async function handleFileSelection(file) {
  if (!file) {
    return;
  }

  try {
    setStatus('Carregando imagem...');
    selectedImageFile = file;
    selectedFileMetadata = {
      name: file.name || 'N/A',
      lastModified: Number(file.lastModified) || 0,
    };
    selectedImage = await loadImage(file);
    drawImagePreview(selectedImage);
    updateAnalyzeBtnState();
    resetOutput();
    setStatus(isDescriptionFilled()
      ? 'Imagem pronta para análise.'
      : 'Imagem carregada. Informe as marcas esperadas para habilitar a análise.');
  } catch (error) {
    selectedFileMetadata = null;
    selectedImage = null;
    selectedImageFile = null;
    updateAnalyzeBtnState();
    setStatus(`Erro ao carregar imagem: ${error.message}`);
  }
}

imageInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  handleFileSelection(file);
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('drag');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('drag');
  const [file] = event.dataTransfer.files;
  imageInput.files = event.dataTransfer.files;
  handleFileSelection(file);
});

analyzeBtn.addEventListener('click', analyzeShelf);

// Revalida estado do botão sempre que a descrição mudar.
descriptionInput.addEventListener('input', () => {
  descriptionInput.dataset.touched = 'true';
  validateDescriptionField();
});

descriptionInput.addEventListener('blur', () => {
  descriptionInput.dataset.touched = 'true';
  validateDescriptionField();
});

[backendToggle, backendUrlInput, backendThresholdInput].forEach((element) => {
  element?.addEventListener('input', () => {
    persistHybridSettings();
    updateBackendModeLabel();
    setBackendHealthLabel('Conexão não testada.');
    setBackendStatusBadge('idle', 'Desconectado');
  });
  element?.addEventListener('change', () => {
    persistHybridSettings();
    updateBackendModeLabel();
    setBackendHealthLabel('Conexão não testada.');
    setBackendStatusBadge('idle', 'Desconectado');
  });
});

checkBackendBtn?.addEventListener('click', checkBackendHealth);

// Carrega catálogo de marcas no startup e sobrescreve defaults quando disponível.
initializeHybridSettings();
initBrandCatalog();
