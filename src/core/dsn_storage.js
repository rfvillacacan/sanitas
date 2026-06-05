import { createDsnValidationSummary } from './dsn_validator.js';

export const DSN_RULES_STORAGE_KEY = 'sanitasDsnRules';

export function createEmptyDsnRulesState(options = {}) {
  const timestamp = resolveNow(options);

  return {
    rulesets: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeDsnRulesState(value, options = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const timestamp = resolveNow(options);
  const createdAt = normalizeTimestamp(source.createdAt) || timestamp;
  const updatedAt = normalizeTimestamp(source.updatedAt) || createdAt;
  const rulesets = Array.isArray(source.rulesets)
    ? source.rulesets.filter((ruleset) => ruleset && typeof ruleset === 'object').slice(0, 10)
    : [];

  return {
    rulesets,
    createdAt,
    updatedAt
  };
}

export async function getDsnRules(storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([DSN_RULES_STORAGE_KEY]);

  return normalizeDsnRulesState(data[DSN_RULES_STORAGE_KEY], options);
}

export async function saveDsnRules(rulesetOrRulesets, storageArea = chrome.storage.session, options = {}) {
  const data = await storageArea.get([DSN_RULES_STORAGE_KEY]);
  const existing = data[DSN_RULES_STORAGE_KEY] ? normalizeDsnRulesState(data[DSN_RULES_STORAGE_KEY], options) : null;
  const timestamp = resolveNow(options);
  const rulesets = Array.isArray(rulesetOrRulesets)
    ? rulesetOrRulesets
    : [rulesetOrRulesets].filter(Boolean);
  const normalized = normalizeDsnRulesState({
    rulesets,
    createdAt: (existing && existing.createdAt) || timestamp,
    updatedAt: timestamp
  }, options);

  await storageArea.set({
    [DSN_RULES_STORAGE_KEY]: normalized
  });

  return normalized;
}

export async function clearDsnRules(storageArea = chrome.storage.session, options = {}) {
  await storageArea.remove([DSN_RULES_STORAGE_KEY]);

  return createEmptyDsnRulesState(options);
}

export function createDsnSummary(dsnRulesState) {
  const state = normalizeDsnRulesState(dsnRulesState);

  return createDsnValidationSummary(state.rulesets);
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
