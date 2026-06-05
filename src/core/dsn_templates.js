import {
  DSN_ALLOWED_CHARS,
  DSN_RULE_TYPES,
  DSN_SCHEMA_VERSION,
  DSN_SEGMENT_KINDS,
  DSN_TYPE,
  DSN_VALUE_KINDS,
  DSN_VALUE_MODES
} from './dsn_schema.js';

const TEMPLATE_RULES = Object.freeze({
  [DSN_RULE_TYPES.LITERAL_TERMS]: Object.freeze({
    id: 'PROJECT_NAMES',
    type: DSN_RULE_TYPES.LITERAL_TERMS,
    enabled: true,
    placeholder_type: 'CUSTOM_TERM',
    priority: 500,
    description: 'Dummy project and organization names.',
    terms: Object.freeze(['Project Titan', 'Acme Corp']),
    case_sensitive: false,
    match_word_boundary: true
  }),
  [DSN_RULE_TYPES.LABELED_VALUE]: Object.freeze({
    id: 'DB_PASSWORD',
    type: DSN_RULE_TYPES.LABELED_VALUE,
    enabled: true,
    placeholder_type: 'DATABASE_SECRET',
    priority: 900,
    description: 'Dummy database password labels.',
    labels: Object.freeze(['DB_PASS']),
    separators: Object.freeze(['=', ':']),
    value_mode: DSN_VALUE_MODES.UNTIL_WHITESPACE,
    case_sensitive: false
  }),
  [DSN_RULE_TYPES.PREFIX_TOKEN]: Object.freeze({
    id: 'TEST_API_KEY',
    type: DSN_RULE_TYPES.PREFIX_TOKEN,
    enabled: true,
    placeholder_type: 'API_KEY',
    priority: 950,
    description: 'Dummy test API key prefix.',
    prefixes: Object.freeze(['sk_test_']),
    min_length: 16,
    max_length: 120,
    allowed_chars: DSN_ALLOWED_CHARS.ALPHA_NUM_UNDERSCORE_DASH,
    case_sensitive: true
  }),
  [DSN_RULE_TYPES.STRUCTURED_ID]: Object.freeze({
    id: 'INTERNAL_DOCUMENT_ID',
    type: DSN_RULE_TYPES.STRUCTURED_ID,
    enabled: true,
    placeholder_type: 'DOCUMENT_ID',
    priority: 700,
    description: 'Dummy internal document ids.',
    prefixes: Object.freeze(['DOC-INT-']),
    segments: Object.freeze([Object.freeze({
      kind: DSN_SEGMENT_KINDS.DIGITS,
      min: 4,
      max: 12
    })]),
    case_sensitive: true
  }),
  [DSN_RULE_TYPES.CONTEXT_VALUE]: Object.freeze({
    id: 'CARD_SECURITY_CODE',
    type: DSN_RULE_TYPES.CONTEXT_VALUE,
    enabled: true,
    placeholder_type: 'CARD_SECURITY_CODE',
    priority: 850,
    description: 'Dummy card security-code context.',
    context_labels: Object.freeze(['CVV']),
    separators: Object.freeze([':', '=']),
    value_kind: DSN_VALUE_KINDS.DIGITS,
    min_length: 3,
    max_length: 4,
    case_sensitive: false
  })
});

export function createDsnTemplateRule(type) {
  const template = TEMPLATE_RULES[type];

  if (!template) {
    throw new Error('Unsupported DSN template type.');
  }

  return deepClone(template);
}

export function createDsnExampleRuleset() {
  return createRuleset(Object.values(DSN_RULE_TYPES).map((type) => createDsnTemplateRule(type)), {
    ruleset_id: 'sanitas-safe-example',
    name: 'Sanitas Safe Example Rules',
    description: 'Safe dummy DSN examples for local session testing.'
  });
}

export function createDsnTemplateRuleset(type) {
  return createRuleset([createDsnTemplateRule(type)], {
    ruleset_id: `sanitas-${String(type).replace(/_/g, '-')}-template`,
    name: `Sanitas ${String(type).replace(/_/g, ' ')} template`,
    description: 'Safe dummy DSN template for local session testing.'
  });
}

export function insertDsnTemplateIntoText(inputText, type) {
  const text = String(inputText || '').trim();

  if (!text) {
    return {
      ok: true,
      text: stringifyDsn(createDsnTemplateRuleset(type))
    };
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        path: 'root',
        severity: 'error',
        message: 'DSN JSON could not be parsed.'
      }
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.rules)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_DSN',
        path: 'rules',
        severity: 'error',
        message: 'DSN rules must be an array.'
      }
    };
  }

  parsed.rules.push(createDsnTemplateRule(type));

  return {
    ok: true,
    text: stringifyDsn(parsed)
  };
}

export function formatDsnJson(inputText) {
  try {
    return {
      ok: true,
      text: stringifyDsn(JSON.parse(String(inputText || '')))
    };
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        path: 'root',
        severity: 'error',
        message: 'DSN JSON could not be parsed.'
      }
    };
  }
}

export function stringifyDsn(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createRuleset(rules, options = {}) {
  return {
    schema_version: DSN_SCHEMA_VERSION,
    dsn_type: DSN_TYPE,
    ruleset_id: options.ruleset_id || 'sanitas-safe-template',
    name: options.name || 'Sanitas Safe Template',
    version: '1.0.0',
    description: options.description || 'Safe dummy DSN rules for Sanitas.',
    rules
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
