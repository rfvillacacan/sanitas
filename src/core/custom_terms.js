export const MIN_CUSTOM_TERM_LENGTH = 3;
export const MAX_CUSTOM_TERM_LENGTH = 120;
export const MAX_CUSTOM_TERMS = 100;
export const MAX_CUSTOM_TERMS_PAYLOAD_LENGTH = 20000;

export function normalizeCustomTerms(value, options = {}) {
  const maxTerms = positiveInteger(options.maxTerms, MAX_CUSTOM_TERMS);
  const maxTermLength = positiveInteger(options.maxTermLength, MAX_CUSTOM_TERM_LENGTH);
  const minTermLength = positiveInteger(options.minTermLength, MIN_CUSTOM_TERM_LENGTH);
  const values = getCandidateValues(value);
  const terms = [];
  const seen = new Set();
  let rejectedCount = 0;

  for (const rawValue of values) {
    const term = String(rawValue || '').trim();

    if (!term) {
      continue;
    }

    if (term.length < minTermLength || term.length > maxTermLength || seen.has(term)) {
      rejectedCount += term.length > 0 && seen.has(term) === false ? 1 : 0;
      continue;
    }

    if (terms.length >= maxTerms) {
      rejectedCount += 1;
      continue;
    }

    seen.add(term);
    terms.push(term);
  }

  return {
    terms,
    rejectedCount
  };
}

export function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCandidateValues(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value.split(/\r?\n/g);
  }

  return [];
}

function positiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
