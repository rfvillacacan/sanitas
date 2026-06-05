export function normalizeSessionMap(value = {}) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    tokenToOriginal: clonePlainObject(source.tokenToOriginal),
    originalToToken: clonePlainObject(source.originalToToken),
    counters: clonePlainObject(source.counters)
  };
}

export function createToken(type, counter) {
  const normalizedType = normalizeTokenType(type);
  const normalizedCounter = Math.max(1, Math.floor(Number(counter || 1)));

  return `[[${normalizedType}_${String(normalizedCounter).padStart(4, '0')}]]`;
}

export function getOrCreateToken(original, type, sessionMap) {
  const normalizedType = normalizeTokenType(type);
  const normalizedOriginal = String(original || '');
  const normalizedMap = normalizeSessionMap(sessionMap);
  const originalKey = getOriginalKey(normalizedType, normalizedOriginal);
  const existing = normalizedMap.originalToToken[originalKey];

  if (existing) {
    return {
      token: existing,
      sessionMap: normalizedMap,
      created: false
    };
  }

  const nextCounter = Math.max(0, Number(normalizedMap.counters[normalizedType] || 0)) + 1;
  const token = createToken(normalizedType, nextCounter);

  normalizedMap.counters[normalizedType] = nextCounter;
  normalizedMap.originalToToken[originalKey] = token;
  normalizedMap.tokenToOriginal[token] = normalizedOriginal;

  return {
    token,
    sessionMap: normalizedMap,
    created: true
  };
}

export function normalizeTokenType(type) {
  return String(type || 'TOKEN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'TOKEN';
}

function getOriginalKey(type, original) {
  return `${type}:${original}`;
}

function clonePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.assign({}, value);
}
