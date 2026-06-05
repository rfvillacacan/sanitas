import { escapeRegExp, normalizeCustomTerms } from './custom_terms.js';

export const DETECTOR_TYPES = Object.freeze({
  BEARER_TOKEN: 'BEARER_TOKEN',
  JWT: 'JWT',
  API_KEY_LIKE_SECRET: 'API_KEY_LIKE_SECRET',
  URL: 'URL',
  EMAIL: 'EMAIL',
  IPV6: 'IPV6',
  IPV4: 'IPV4',
  MAC_ADDRESS: 'MAC_ADDRESS',
  WINDOWS_FILE_PATH: 'WINDOWS_FILE_PATH',
  LINUX_FILE_PATH: 'LINUX_FILE_PATH',
  CUSTOM_TERM: 'CUSTOM_TERM',
  HOSTNAME: 'HOSTNAME',
  DOMAIN: 'DOMAIN',
  PHONE: 'PHONE'
});

export const DETECTOR_PRIORITY = Object.freeze({
  [DETECTOR_TYPES.BEARER_TOKEN]: 1,
  [DETECTOR_TYPES.JWT]: 2,
  [DETECTOR_TYPES.API_KEY_LIKE_SECRET]: 3,
  [DETECTOR_TYPES.URL]: 4,
  [DETECTOR_TYPES.EMAIL]: 5,
  [DETECTOR_TYPES.IPV6]: 6,
  [DETECTOR_TYPES.IPV4]: 7,
  [DETECTOR_TYPES.MAC_ADDRESS]: 8,
  [DETECTOR_TYPES.WINDOWS_FILE_PATH]: 9,
  [DETECTOR_TYPES.LINUX_FILE_PATH]: 10,
  [DETECTOR_TYPES.CUSTOM_TERM]: 11,
  [DETECTOR_TYPES.HOSTNAME]: 12,
  [DETECTOR_TYPES.DOMAIN]: 13,
  [DETECTOR_TYPES.PHONE]: 14
});

const DEFAULT_RULES = Object.freeze([
  { type: DETECTOR_TYPES.BEARER_TOKEN, priority: DETECTOR_PRIORITY.BEARER_TOKEN },
  { type: DETECTOR_TYPES.JWT, priority: DETECTOR_PRIORITY.JWT },
  { type: DETECTOR_TYPES.API_KEY_LIKE_SECRET, priority: DETECTOR_PRIORITY.API_KEY_LIKE_SECRET, tokenType: 'API_KEY' },
  { type: DETECTOR_TYPES.URL, priority: DETECTOR_PRIORITY.URL },
  { type: DETECTOR_TYPES.EMAIL, priority: DETECTOR_PRIORITY.EMAIL },
  { type: DETECTOR_TYPES.IPV6, priority: DETECTOR_PRIORITY.IPV6 },
  { type: DETECTOR_TYPES.IPV4, priority: DETECTOR_PRIORITY.IPV4 },
  { type: DETECTOR_TYPES.MAC_ADDRESS, priority: DETECTOR_PRIORITY.MAC_ADDRESS },
  { type: DETECTOR_TYPES.WINDOWS_FILE_PATH, priority: DETECTOR_PRIORITY.WINDOWS_FILE_PATH },
  { type: DETECTOR_TYPES.LINUX_FILE_PATH, priority: DETECTOR_PRIORITY.LINUX_FILE_PATH },
  { type: DETECTOR_TYPES.HOSTNAME, priority: DETECTOR_PRIORITY.HOSTNAME },
  { type: DETECTOR_TYPES.DOMAIN, priority: DETECTOR_PRIORITY.DOMAIN },
  { type: DETECTOR_TYPES.PHONE, priority: DETECTOR_PRIORITY.PHONE }
]);

export function getDefaultRules() {
  return DEFAULT_RULES.map((rule) => Object.assign({}, rule));
}

export function getCustomRules(options = {}) {
  return Array.isArray(options.customRules) ? options.customRules.slice() : [];
}

export function detectEntities(text, options = {}) {
  const input = String(text || '');

  if (!input) {
    return [];
  }

  const matches = [
    ...detectRegex(input, DETECTOR_TYPES.BEARER_TOKEN, /\bBearer\s+[A-Za-z0-9._~+/-]{16,}\b/g),
    ...detectRegex(input, DETECTOR_TYPES.JWT, /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g),
    ...detectApiKeyLikeSecrets(input),
    ...detectRegex(input, DETECTOR_TYPES.URL, /\bhttps?:\/\/[^\s<>"']+/g, { trimTrailing: true }),
    ...detectRegex(input, DETECTOR_TYPES.EMAIL, /(?<![\w.-])[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?![\w-])/g),
    ...detectIpv6(input),
    ...detectRegex(input, DETECTOR_TYPES.IPV4, /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g),
    ...detectRegex(input, DETECTOR_TYPES.MAC_ADDRESS, /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g),
    ...detectRegex(input, DETECTOR_TYPES.WINDOWS_FILE_PATH, /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\s\r\n]+/g),
    ...detectRegex(input, DETECTOR_TYPES.LINUX_FILE_PATH, /\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+/g),
    ...detectHostnames(input),
    ...detectCustomTerms(input, options),
    ...detectDomains(input),
    ...detectRegex(input, DETECTOR_TYPES.PHONE, /(?:\+?\d[\d\s().-]{7,}\d)/g, { trimTrailing: true })
  ];

  return filterEnabledDetectors(matches, options);
}

function filterEnabledDetectors(matches, options = {}) {
  if (!Array.isArray(options.enabledDetectorTypes)) {
    return matches;
  }

  const enabledTypes = new Set(options.enabledDetectorTypes);

  return matches.filter((match) => {
    if (match.type === DETECTOR_TYPES.CUSTOM_TERM) {
      return true;
    }

    return !Object.hasOwn(DETECTOR_TYPES, match.type) || enabledTypes.has(match.type);
  });
}

function detectRegex(input, type, pattern, options = {}) {
  const matches = [];

  for (const match of input.matchAll(pattern)) {
    const rawText = match[0];
    const normalized = options.trimTrailing ? trimTrailingPunctuation(rawText) : rawText;

    if (!normalized) {
      continue;
    }

    matches.push(createMatch(type, normalized, match.index));
  }

  return matches;
}

function detectApiKeyLikeSecrets(input) {
  const pattern = /\b(?:api[_-]?key|secret|token|access[_-]?key)\b\s*[:=]\s*["']?([A-Za-z0-9_./~+:-]{20,})["']?/gi;
  const matches = [];

  for (const match of input.matchAll(pattern)) {
    const value = match[1];
    const valueStart = match.index + match[0].indexOf(value);

    matches.push(createMatch(DETECTOR_TYPES.API_KEY_LIKE_SECRET, value, valueStart, 'API_KEY'));
  }

  return matches;
}

function detectIpv6(input) {
  const candidates = input.matchAll(/[0-9A-Fa-f:]{3,}/g);
  const matches = [];

  for (const match of candidates) {
    const value = trimTrailingPunctuation(match[0]);

    if (isValidIpv6(value) && hasCleanBoundaries(input, match.index, match.index + value.length)) {
      matches.push(createMatch(DETECTOR_TYPES.IPV6, value, match.index));
    }
  }

  return matches;
}

function detectHostnames(input) {
  return detectDomainLike(input, DETECTOR_TYPES.HOSTNAME, (value) => {
    const labels = value.split('.');
    const firstLabel = labels[0] || '';

    return labels.length >= 3 && /[-\d]/.test(firstLabel) && !isIpv4(value);
  });
}

function detectDomains(input) {
  return detectDomainLike(input, DETECTOR_TYPES.DOMAIN, (value) => {
    const labels = value.split('.');

    return labels.length >= 2 && !isIpv4(value);
  });
}

function detectDomainLike(input, type, filter) {
  const pattern = /\b[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+\b/g;
  const matches = [];

  for (const match of input.matchAll(pattern)) {
    const value = trimTrailingPunctuation(match[0]);

    if (input[match.index - 1] === '@' || input[match.index + value.length] === '@') {
      continue;
    }

    if (filter(value)) {
      matches.push(createMatch(type, value, match.index));
    }
  }

  return matches;
}

function detectCustomTerms(input, options = {}) {
  if (options.customTermsEnabled === false) {
    return [];
  }

  const customTerms = getCustomTermsFromOptions(options);
  const caseSensitive = options.customTermsCaseSensitive === true;
  const flags = caseSensitive ? 'g' : 'gi';
  const matches = [];

  for (const term of customTerms) {
    const pattern = new RegExp(escapeRegExp(term), flags);

    for (const match of input.matchAll(pattern)) {
      matches.push(createMatch(DETECTOR_TYPES.CUSTOM_TERM, match[0], match.index));
    }
  }

  return matches;
}

function getCustomTermsFromOptions(options = {}) {
  if (Array.isArray(options.customTerms) || typeof options.customTerms === 'string') {
    return normalizeCustomTerms(options.customTerms).terms;
  }

  const rules = getCustomRules(options)
    .map((rule) => rule && rule.term)
    .filter((term) => typeof term === 'string' && term.trim());

  return normalizeCustomTerms(rules).terms;
}

function createMatch(type, text, start, tokenType = type) {
  return {
    type,
    tokenType,
    text,
    start,
    end: start + text.length,
    priority: DETECTOR_PRIORITY[type] || 999
  };
}

function trimTrailingPunctuation(value) {
  return String(value || '').replace(/[.,;:!?)}\]]+$/g, '');
}

function hasCleanBoundaries(input, start, end) {
  const before = input[start - 1] || '';
  const after = input[end] || '';

  return !/[A-Za-z0-9_:.-]/.test(before) && !/[A-Za-z0-9_:.-]/.test(after);
}

function isValidIpv6(value) {
  if (!value || value.includes(':') === false || value.includes('::') === false && value.split(':').length < 3) {
    return false;
  }

  if (/^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(value)) {
    return false;
  }

  if ((value.match(/::/g) || []).length > 1) {
    return false;
  }

  const parts = value.split(':').filter(Boolean);

  return parts.length >= 2 && parts.length <= 8 && parts.every((part) => /^[0-9A-Fa-f]{1,4}$/.test(part));
}

function isIpv4(value) {
  return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(value);
}
