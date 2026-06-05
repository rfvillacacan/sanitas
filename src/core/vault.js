import { normalizeCustomTerms } from './custom_terms.js';

export const SESSION_STORAGE_KEY = 'sanitasSessionMap';
export const CUSTOM_TERMS_STORAGE_KEY = 'sanitasCustomTerms';
export const WORKSPACE_STATE_STORAGE_KEY = 'sanitasWorkspaceState';

const OUTPUT_STATES = new Set(['empty', 'sanitized', 'restored']);

export function createEmptySessionMap(options = {}) {
  const timestamp = resolveNow(options);

  return {
    tokenToOriginal: {},
    originalToToken: {},
    counters: {},
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeSessionMap(value, options = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const timestamp = resolveNow(options);
  const createdAt = normalizeTimestamp(source.createdAt) || timestamp;
  const updatedAt = normalizeTimestamp(source.updatedAt) || createdAt;

  return {
    tokenToOriginal: plainObjectOrEmpty(source.tokenToOriginal),
    originalToToken: plainObjectOrEmpty(source.originalToToken),
    counters: normalizeCounters(source.counters),
    createdAt,
    updatedAt
  };
}

export async function getSessionMap(storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([SESSION_STORAGE_KEY]);

  return normalizeSessionMap(data[SESSION_STORAGE_KEY], options);
}

export async function saveSessionMap(map, storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([SESSION_STORAGE_KEY]);
  const existing = data[SESSION_STORAGE_KEY] ? normalizeSessionMap(data[SESSION_STORAGE_KEY], options) : null;
  const timestamp = resolveNow(options);
  const normalized = normalizeSessionMap(Object.assign({}, map, {
    createdAt: normalizeTimestamp(map && map.createdAt) || (existing && existing.createdAt) || timestamp,
    updatedAt: timestamp
  }), options);

  await storageArea.set({
    [SESSION_STORAGE_KEY]: normalized
  });

  return normalized;
}

export async function clearSessionMap(storageArea = chrome.storage.session, options = {}) {
  await storageArea.remove([SESSION_STORAGE_KEY]);

  return createEmptySessionMap(options);
}

export function createEmptyCustomTerms(options = {}) {
  const timestamp = resolveNow(options);

  return {
    terms: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeCustomTermsState(value, options = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const timestamp = resolveNow(options);
  const createdAt = normalizeTimestamp(source.createdAt) || timestamp;
  const updatedAt = normalizeTimestamp(source.updatedAt) || createdAt;
  const normalized = normalizeCustomTerms(source.terms);

  return {
    terms: normalized.terms,
    createdAt,
    updatedAt
  };
}

export async function getCustomTerms(storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([CUSTOM_TERMS_STORAGE_KEY]);

  return normalizeCustomTermsState(data[CUSTOM_TERMS_STORAGE_KEY], options);
}

export async function saveCustomTerms(terms, storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([CUSTOM_TERMS_STORAGE_KEY]);
  const existing = data[CUSTOM_TERMS_STORAGE_KEY] ? normalizeCustomTermsState(data[CUSTOM_TERMS_STORAGE_KEY], options) : null;
  const timestamp = resolveNow(options);
  const normalizedTerms = normalizeCustomTerms(terms).terms;
  const normalized = normalizeCustomTermsState({
    terms: normalizedTerms,
    createdAt: (existing && existing.createdAt) || timestamp,
    updatedAt: timestamp
  }, options);

  await storageArea.set({
    [CUSTOM_TERMS_STORAGE_KEY]: normalized
  });

  return normalized;
}

export async function clearCustomTerms(storageArea = chrome.storage.session, options = {}) {
  await storageArea.remove([CUSTOM_TERMS_STORAGE_KEY]);

  return createEmptyCustomTerms(options);
}

export function createEmptyWorkspaceState(options = {}) {
  const timestamp = resolveNow(options);

  return {
    topText: '',
    bottomText: '',
    outputState: 'empty',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeWorkspaceState(value, options = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const timestamp = resolveNow(options);
  const createdAt = normalizeTimestamp(source.createdAt) || timestamp;
  const updatedAt = normalizeTimestamp(source.updatedAt) || createdAt;

  return {
    topText: typeof source.topText === 'string' ? source.topText : '',
    bottomText: typeof source.bottomText === 'string' ? source.bottomText : '',
    outputState: OUTPUT_STATES.has(source.outputState) ? source.outputState : 'empty',
    createdAt,
    updatedAt
  };
}

export async function getWorkspaceState(storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([WORKSPACE_STATE_STORAGE_KEY]);

  return normalizeWorkspaceState(data[WORKSPACE_STATE_STORAGE_KEY], options);
}

export async function saveWorkspaceState(state, storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([WORKSPACE_STATE_STORAGE_KEY]);
  const existing = data[WORKSPACE_STATE_STORAGE_KEY] ? normalizeWorkspaceState(data[WORKSPACE_STATE_STORAGE_KEY], options) : null;
  const timestamp = resolveNow(options);
  const normalized = normalizeWorkspaceState(Object.assign({}, existing || {}, state, {
    createdAt: (existing && existing.createdAt) || timestamp,
    updatedAt: timestamp
  }), options);

  await storageArea.set({
    [WORKSPACE_STATE_STORAGE_KEY]: normalized
  });

  return normalized;
}

export async function clearWorkspaceState(storageArea = chrome.storage.session, options = {}) {
  await storageArea.remove([WORKSPACE_STATE_STORAGE_KEY]);

  return createEmptyWorkspaceState(options);
}

export function createSessionSummary(map) {
  const normalized = normalizeSessionMap(map);
  const tokenTypes = getTokenTypes(normalized);
  const totalMappings = Object.keys(normalized.tokenToOriginal).length;

  return {
    hasActiveSession: totalMappings > 0,
    totalMappings,
    tokenTypes,
    counters: normalizeCounters(normalized.counters)
  };
}

export function createCustomTermsSummary(customTerms, enabled = true) {
  const normalized = normalizeCustomTermsState(customTerms);
  const count = normalized.terms.length;

  return {
    enabled: enabled === true,
    count,
    hasCustomTerms: count > 0
  };
}

export function createWorkspaceSummary(workspaceState) {
  const normalized = normalizeWorkspaceState(workspaceState);

  return {
    hasWorkspaceState: Boolean(normalized.topText || normalized.bottomText || normalized.outputState !== 'empty'),
    topTextLength: normalized.topText.length,
    bottomTextLength: normalized.bottomText.length,
    outputState: normalized.outputState
  };
}

function plainObjectOrEmpty(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.assign({}, value);
}

function normalizeCounters(value) {
  const source = plainObjectOrEmpty(value);
  const counters = {};

  Object.keys(source).sort().forEach((key) => {
    const count = Math.max(0, Math.floor(Number(source[key] || 0)));

    if (count > 0) {
      counters[key] = count;
    }
  });

  return counters;
}

function getTokenTypes(map) {
  const tokenTypes = new Set(Object.keys(map.counters));

  Object.keys(map.tokenToOriginal).forEach((token) => {
    const match = token.match(/^\[\[([A-Z0-9_]+)_\d{4}\]\]$/);

    if (match) {
      tokenTypes.add(match[1]);
    }
  });

  return Array.from(tokenTypes).sort();
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && value.trim() ? value : '';
}

function resolveNow(options) {
  if (options && typeof options.now === 'function') {
    return options.now();
  }

  if (options && typeof options.now === 'string') {
    return options.now;
  }

  return new Date().toISOString();
}
