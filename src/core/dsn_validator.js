import {
  DSN_ALLOWED_CHARS,
  DSN_COMMON_RULE_FIELDS,
  DSN_LIMITS,
  DSN_RISKY_FIELDS,
  DSN_RULE_TYPES,
  DSN_SCHEMA_VERSION,
  DSN_SEGMENT_KINDS,
  DSN_TOP_LEVEL_FIELDS,
  DSN_TYPE,
  DSN_TYPE_FIELDS,
  DSN_VALUE_KINDS,
  DSN_VALUE_MODES,
  isPlainObject,
  isSafeIdentifier,
  isSafeRulesetId,
  isSupportedRuleType,
  isValidPlaceholderType
} from './dsn_schema.js';

const VALUE_MODES = new Set(Object.values(DSN_VALUE_MODES));
const ALLOWED_CHARS = new Set(Object.values(DSN_ALLOWED_CHARS));
const SEGMENT_KINDS = new Set(Object.values(DSN_SEGMENT_KINDS));
const VALUE_KINDS = new Set(Object.values(DSN_VALUE_KINDS));
const RISKY_FIELDS = new Set(DSN_RISKY_FIELDS);
const TOP_LEVEL_FIELDS = new Set(DSN_TOP_LEVEL_FIELDS);
const COMMON_RULE_FIELDS = new Set(DSN_COMMON_RULE_FIELDS);

export function validateDsnRules(input, options = {}) {
  const parsed = parseInput(input, options);

  if (!parsed.ok) {
    return invalid(parsed.error);
  }

  const unsafe = findUnsafeField(parsed.value);

  if (unsafe) {
    return invalid(error('UNSAFE_FIELD', unsafe.path, 'DSN contains an unsupported unsafe field.'));
  }

  const topLevel = validateTopLevel(parsed.value);

  if (!topLevel.ok) {
    return invalid(topLevel.error);
  }

  const rules = [];

  for (let index = 0; index < parsed.value.rules.length; index += 1) {
    const normalizedRule = validateRule(parsed.value.rules[index], `rules.${index}`);

    if (!normalizedRule.ok) {
      return invalid(normalizedRule.error);
    }

    rules.push(normalizedRule.rule);
  }

  const ruleset = {
    schema_version: DSN_SCHEMA_VERSION,
    dsn_type: DSN_TYPE,
    ruleset_id: parsed.value.ruleset_id.trim(),
    version: parsed.value.version.trim(),
    rules
  };

  if (typeof parsed.value.name === 'string' && parsed.value.name.trim()) {
    ruleset.name = parsed.value.name.trim();
  }

  if (typeof parsed.value.description === 'string' && parsed.value.description.trim()) {
    ruleset.description = trimToLimit(parsed.value.description, DSN_LIMITS.MAX_DESCRIPTION_LENGTH);
  }

  return {
    ok: true,
    ruleset,
    rulesets: [ruleset],
    summary: createDsnValidationSummary([ruleset]),
    errors: []
  };
}

export function createDsnValidationSummary(rulesets) {
  const normalizedRulesets = Array.isArray(rulesets) ? rulesets : [];
  const ruleTypes = new Set();
  const placeholderTypes = new Set();
  let enabledRuleCount = 0;

  for (const ruleset of normalizedRulesets) {
    for (const rule of Array.isArray(ruleset.rules) ? ruleset.rules : []) {
      if (rule.enabled !== true) {
        continue;
      }

      enabledRuleCount += 1;
      ruleTypes.add(rule.type);
      placeholderTypes.add(rule.placeholder_type);
    }
  }

  return {
    hasDsnRules: enabledRuleCount > 0,
    rulesetCount: normalizedRulesets.length,
    enabledRuleCount,
    ruleTypes: Array.from(ruleTypes).sort(),
    placeholderTypes: Array.from(placeholderTypes).sort()
  };
}

function parseInput(input, options = {}) {
  if (typeof input === 'string') {
    if (input.length > Number(options.maxJsonSize || DSN_LIMITS.MAX_JSON_SIZE)) {
      return {
        ok: false,
        error: error('TEXT_TOO_LARGE', 'root', 'DSN JSON exceeds the maximum supported size.')
      };
    }

    try {
      return {
        ok: true,
        value: JSON.parse(input)
      };
    } catch {
      return {
        ok: false,
        error: error('INVALID_JSON', 'root', 'DSN JSON could not be parsed.')
      };
    }
  }

  return {
    ok: true,
    value: input
  };
}

function validateTopLevel(value) {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: error('INVALID_DSN', 'root', 'DSN must be a JSON object.')
    };
  }

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_FIELDS.has(key)) {
      return {
        ok: false,
        error: error('UNKNOWN_FIELD', key, 'DSN contains an unsupported field.')
      };
    }
  }

  const required = ['schema_version', 'dsn_type', 'ruleset_id', 'version', 'rules'];

  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      return {
        ok: false,
        error: error('MISSING_FIELD', field, 'DSN is missing a required field.')
      };
    }
  }

  if (value.schema_version !== DSN_SCHEMA_VERSION) {
    return {
      ok: false,
      error: error('UNSUPPORTED_SCHEMA_VERSION', 'schema_version', 'DSN schema version is not supported.')
    };
  }

  if (value.dsn_type !== DSN_TYPE) {
    return {
      ok: false,
      error: error('INVALID_DSN_TYPE', 'dsn_type', 'DSN type is not supported.')
    };
  }

  if (!isSafeRulesetId(value.ruleset_id)) {
    return {
      ok: false,
      error: error('INVALID_RULESET_ID', 'ruleset_id', 'Ruleset id is not valid.')
    };
  }

  if (typeof value.version !== 'string' || !value.version.trim() || value.version.length > 40) {
    return {
      ok: false,
      error: error('INVALID_VERSION', 'version', 'Ruleset version is not valid.')
    };
  }

  if (!Array.isArray(value.rules)) {
    return {
      ok: false,
      error: error('INVALID_RULES', 'rules', 'DSN rules must be an array.')
    };
  }

  if (value.rules.length > DSN_LIMITS.MAX_RULES_PER_RULESET) {
    return {
      ok: false,
      error: error('TOO_MANY_RULES', 'rules', 'DSN rules exceed the maximum supported count.')
    };
  }

  return { ok: true };
}

function validateRule(rule, path) {
  if (!isPlainObject(rule)) {
    return {
      ok: false,
      error: error('INVALID_RULE', path, 'DSN rule must be an object.')
    };
  }

  for (const field of ['id', 'type', 'enabled', 'placeholder_type']) {
    if (!Object.hasOwn(rule, field)) {
      return {
        ok: false,
        error: error('MISSING_FIELD', `${path}.${field}`, 'DSN rule is missing a required field.')
      };
    }
  }

  if (!isSupportedRuleType(rule.type)) {
    return {
      ok: false,
      error: error('UNSUPPORTED_RULE_TYPE', `${path}.type`, 'DSN rule type is not supported.')
    };
  }

  const allowedFields = new Set([
    ...COMMON_RULE_FIELDS,
    ...(DSN_TYPE_FIELDS[rule.type] || [])
  ]);

  for (const key of Object.keys(rule)) {
    if (!allowedFields.has(key)) {
      return {
        ok: false,
        error: error('UNKNOWN_FIELD', `${path}.${key}`, 'DSN rule contains an unsupported field.')
      };
    }
  }

  if (!isSafeIdentifier(rule.id)) {
    return {
      ok: false,
      error: error('INVALID_RULE_ID', `${path}.id`, 'DSN rule id is not valid.')
    };
  }

  if (typeof rule.enabled !== 'boolean') {
    return {
      ok: false,
      error: error('INVALID_ENABLED', `${path}.enabled`, 'DSN enabled flag must be boolean.')
    };
  }

  if (!isValidPlaceholderType(rule.placeholder_type)) {
    return {
      ok: false,
      error: error('INVALID_PLACEHOLDER_TYPE', `${path}.placeholder_type`, 'DSN placeholder type is not valid.')
    };
  }

  const common = {
    id: rule.id.trim(),
    type: rule.type,
    enabled: rule.enabled,
    placeholder_type: rule.placeholder_type.trim(),
    priority: normalizeInteger(rule.priority, 800, 1, 9999),
    case_sensitive: rule.case_sensitive === true,
    max_matches: normalizeInteger(rule.max_matches, DSN_LIMITS.MAX_MATCHES_PER_RULE, 1, DSN_LIMITS.MAX_MATCHES_PER_RULE)
  };

  if (typeof rule.description === 'string' && rule.description.trim()) {
    common.description = trimToLimit(rule.description, DSN_LIMITS.MAX_DESCRIPTION_LENGTH);
  }

  const typed = validateRuleByType(rule, common, path);

  if (!typed.ok) {
    return typed;
  }

  return {
    ok: true,
    rule: typed.rule
  };
}

function validateRuleByType(rule, common, path) {
  if (rule.type === DSN_RULE_TYPES.LITERAL_TERMS) {
    const terms = normalizeStringList(rule.terms, {
      path: `${path}.terms`,
      maxItems: DSN_LIMITS.MAX_TERMS_PER_RULE,
      maxLength: DSN_LIMITS.MAX_TERM_LENGTH,
      minLength: 3,
      itemName: 'terms'
    });

    if (!terms.ok) {
      return { ok: false, error: terms.error };
    }

    return {
      ok: true,
      rule: Object.assign({}, common, {
        terms: terms.values,
        match_word_boundary: rule.match_word_boundary !== false
      })
    };
  }

  if (rule.type === DSN_RULE_TYPES.LABELED_VALUE) {
    const labels = normalizeStringList(rule.labels, {
      path: `${path}.labels`,
      maxItems: DSN_LIMITS.MAX_LABELS_PER_RULE,
      maxLength: DSN_LIMITS.MAX_LABEL_LENGTH,
      minLength: 1,
      itemName: 'labels'
    });
    const separators = normalizeStringList(rule.separators, {
      path: `${path}.separators`,
      maxItems: 10,
      maxLength: 5,
      minLength: 1,
      itemName: 'separators'
    });

    if (!labels.ok) {
      return { ok: false, error: labels.error };
    }

    if (!separators.ok) {
      return { ok: false, error: separators.error };
    }

    if (rule.value_mode !== undefined && !VALUE_MODES.has(rule.value_mode)) {
      return {
        ok: false,
        error: error('INVALID_VALUE_MODE', `${path}.value_mode`, 'DSN value mode is not supported.')
      };
    }

    return {
      ok: true,
      rule: Object.assign({}, common, {
        labels: labels.values,
        separators: separators.values,
        value_mode: rule.value_mode || DSN_VALUE_MODES.UNTIL_WHITESPACE
      })
    };
  }

  if (rule.type === DSN_RULE_TYPES.PREFIX_TOKEN) {
    const prefixes = normalizeStringList(rule.prefixes, {
      path: `${path}.prefixes`,
      maxItems: DSN_LIMITS.MAX_PREFIXES_PER_RULE,
      maxLength: DSN_LIMITS.MAX_PREFIX_LENGTH,
      minLength: 1,
      itemName: 'prefixes'
    });

    if (!prefixes.ok) {
      return { ok: false, error: prefixes.error };
    }

    if (rule.allowed_chars !== undefined && !ALLOWED_CHARS.has(rule.allowed_chars)) {
      return {
        ok: false,
        error: error('INVALID_ALLOWED_CHARS', `${path}.allowed_chars`, 'DSN allowed character set is not supported.')
      };
    }

    const minLength = normalizeInteger(rule.min_length, 8, 1, 1000);
    const maxLength = normalizeInteger(rule.max_length, 120, minLength, 1000);

    return {
      ok: true,
      rule: Object.assign({}, common, {
        prefixes: prefixes.values,
        min_length: minLength,
        max_length: maxLength,
        allowed_chars: rule.allowed_chars || DSN_ALLOWED_CHARS.TOKEN_SAFE
      })
    };
  }

  if (rule.type === DSN_RULE_TYPES.STRUCTURED_ID) {
    const prefixes = normalizeStringList(rule.prefixes, {
      path: `${path}.prefixes`,
      maxItems: DSN_LIMITS.MAX_PREFIXES_PER_RULE,
      maxLength: DSN_LIMITS.MAX_PREFIX_LENGTH,
      minLength: 1,
      itemName: 'prefixes'
    });
    const segments = normalizeSegments(rule.segments, `${path}.segments`);

    if (!prefixes.ok) {
      return { ok: false, error: prefixes.error };
    }

    if (!segments.ok) {
      return { ok: false, error: segments.error };
    }

    return {
      ok: true,
      rule: Object.assign({}, common, {
        prefixes: prefixes.values,
        segments: segments.values
      })
    };
  }

  if (rule.type === DSN_RULE_TYPES.CONTEXT_VALUE) {
    const labels = normalizeStringList(rule.context_labels, {
      path: `${path}.context_labels`,
      maxItems: DSN_LIMITS.MAX_CONTEXT_LABELS_PER_RULE,
      maxLength: DSN_LIMITS.MAX_LABEL_LENGTH,
      minLength: 1,
      itemName: 'context labels'
    });
    const separators = normalizeStringList(rule.separators, {
      path: `${path}.separators`,
      maxItems: 10,
      maxLength: 5,
      minLength: 1,
      itemName: 'separators'
    });

    if (!labels.ok) {
      return { ok: false, error: labels.error };
    }

    if (!separators.ok) {
      return { ok: false, error: separators.error };
    }

    if (rule.value_kind !== undefined && !VALUE_KINDS.has(rule.value_kind)) {
      return {
        ok: false,
        error: error('INVALID_VALUE_KIND', `${path}.value_kind`, 'DSN value kind is not supported.')
      };
    }

    const minLength = normalizeInteger(rule.min_length, 1, 1, 200);
    const maxLength = normalizeInteger(rule.max_length, 120, minLength, 200);

    return {
      ok: true,
      rule: Object.assign({}, common, {
        context_labels: labels.values,
        separators: separators.values,
        value_kind: rule.value_kind || DSN_VALUE_KINDS.TOKEN,
        min_length: minLength,
        max_length: maxLength
      })
    };
  }

  return {
    ok: false,
    error: error('UNSUPPORTED_RULE_TYPE', `${path}.type`, 'DSN rule type is not supported.')
  };
}

function normalizeSegments(segments, path) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      ok: false,
      error: error('INVALID_SEGMENTS', path, 'DSN structured_id segments must be a non-empty array.')
    };
  }

  if (segments.length > DSN_LIMITS.MAX_SEGMENTS_PER_RULE) {
    return {
      ok: false,
      error: error('TOO_MANY_SEGMENTS', path, 'DSN structured_id segments exceed the maximum supported count.')
    };
  }

  const values = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentPath = `${path}.${index}`;

    if (!isPlainObject(segment)) {
      return {
        ok: false,
        error: error('INVALID_SEGMENT', segmentPath, 'DSN segment must be an object.')
      };
    }

    if (!SEGMENT_KINDS.has(segment.kind)) {
      return {
        ok: false,
        error: error('INVALID_SEGMENT_KIND', `${segmentPath}.kind`, 'DSN segment kind is not supported.')
      };
    }

    const allowed = segment.kind === DSN_SEGMENT_KINDS.LITERAL
      ? new Set(['kind', 'value'])
      : new Set(['kind', 'min', 'max']);

    for (const key of Object.keys(segment)) {
      if (!allowed.has(key)) {
        return {
          ok: false,
          error: error('UNKNOWN_FIELD', `${segmentPath}.${key}`, 'DSN segment contains an unsupported field.')
        };
      }
    }

    if (segment.kind === DSN_SEGMENT_KINDS.LITERAL) {
      if (typeof segment.value !== 'string' || !segment.value || segment.value.length > DSN_LIMITS.MAX_PREFIX_LENGTH) {
        return {
          ok: false,
          error: error('INVALID_SEGMENT_LITERAL', `${segmentPath}.value`, 'DSN segment literal is not valid.')
        };
      }

      values.push({
        kind: segment.kind,
        value: segment.value
      });
      continue;
    }

    const min = normalizeInteger(segment.min, 1, 1, 200);
    const max = normalizeInteger(segment.max, min, min, 200);

    values.push({
      kind: segment.kind,
      min,
      max
    });
  }

  return {
    ok: true,
    values
  };
}

function normalizeStringList(value, options) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: error('INVALID_LIST', options.path, `DSN ${options.itemName} must be an array.`)
    };
  }

  if (value.length > options.maxItems) {
    return {
      ok: false,
      error: error(getTooManyCode(options.itemName), options.path, `DSN ${options.itemName} exceed the maximum supported count.`)
    };
  }

  const values = [];
  const seen = new Set();

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const itemPath = `${options.path}.${index}`;

    if (typeof item !== 'string') {
      return {
        ok: false,
        error: error('INVALID_VALUE', itemPath, `DSN ${options.itemName} must contain strings only.`)
      };
    }

    const normalized = item.trim();

    if (!normalized) {
      continue;
    }

    if (normalized.length < options.minLength) {
      return {
        ok: false,
        error: error('VALUE_TOO_SHORT', itemPath, 'DSN value is shorter than the supported minimum.')
      };
    }

    if (normalized.length > options.maxLength) {
      return {
        ok: false,
        error: error('VALUE_TOO_LONG', itemPath, 'DSN value exceeds the supported maximum length.')
      };
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      values.push(normalized);
    }
  }

  if (values.length === 0) {
    return {
      ok: false,
      error: error('EMPTY_LIST', options.path, `DSN ${options.itemName} must contain at least one value.`)
    };
  }

  return {
    ok: true,
    values
  };
}

function findUnsafeField(value, path = 'root') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findUnsafeField(value[index], `${path}.${index}`);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of Object.keys(value)) {
    if (RISKY_FIELDS.has(key)) {
      return {
        path: `${path}.${key}`
      };
    }

    const found = findUnsafeField(value[key], `${path}.${key}`);

    if (found) {
      return found;
    }
  }

  return null;
}

function invalid(singleError) {
  return {
    ok: false,
    errors: [singleError],
    ruleset: null,
    rulesets: [],
    summary: createDsnValidationSummary([])
  };
}

function error(code, path, message) {
  return {
    code,
    path,
    severity: 'error',
    message
  };
}

function normalizeInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function trimToLimit(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function getTooManyCode(itemName) {
  if (itemName === 'terms') {
    return 'TOO_MANY_TERMS';
  }

  return 'TOO_MANY_VALUES';
}
