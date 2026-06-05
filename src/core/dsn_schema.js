export const DSN_SCHEMA_VERSION = '1.0';
export const DSN_TYPE = 'sanitas_safe_rules';

export const DSN_RULE_TYPES = Object.freeze({
  LITERAL_TERMS: 'literal_terms',
  LABELED_VALUE: 'labeled_value',
  PREFIX_TOKEN: 'prefix_token',
  STRUCTURED_ID: 'structured_id',
  CONTEXT_VALUE: 'context_value'
});

export const DSN_VALUE_MODES = Object.freeze({
  UNTIL_WHITESPACE: 'until_whitespace',
  UNTIL_LINE_END: 'until_line_end',
  QUOTED_VALUE: 'quoted_value',
  TOKEN: 'token'
});

export const DSN_ALLOWED_CHARS = Object.freeze({
  ALPHA_NUM: 'alpha_num',
  ALPHA_NUM_DASH: 'alpha_num_dash',
  ALPHA_NUM_UNDERSCORE: 'alpha_num_underscore',
  ALPHA_NUM_UNDERSCORE_DASH: 'alpha_num_underscore_dash',
  BASE64URL: 'base64url',
  HEX: 'hex',
  TOKEN_SAFE: 'token_safe'
});

export const DSN_SEGMENT_KINDS = Object.freeze({
  DIGITS: 'digits',
  ALPHA: 'alpha',
  ALNUM: 'alnum',
  HEX: 'hex',
  LITERAL: 'literal'
});

export const DSN_VALUE_KINDS = Object.freeze({
  DIGITS: 'digits',
  DATE_MM_YY: 'date_mm_yy',
  DATE_MM_YYYY: 'date_mm_yyyy',
  TOKEN: 'token',
  ALNUM: 'alnum'
});

export const DSN_LIMITS = Object.freeze({
  MAX_JSON_SIZE: 256 * 1024,
  MAX_RULESETS: 10,
  MAX_RULES_PER_RULESET: 200,
  MAX_TERMS_PER_RULE: 500,
  MAX_LABELS_PER_RULE: 50,
  MAX_PREFIXES_PER_RULE: 50,
  MAX_CONTEXT_LABELS_PER_RULE: 50,
  MAX_SEGMENTS_PER_RULE: 12,
  MAX_TERM_LENGTH: 120,
  MAX_LABEL_LENGTH: 80,
  MAX_PREFIX_LENGTH: 80,
  MAX_RULE_ID_LENGTH: 80,
  MAX_RULESET_ID_LENGTH: 80,
  MAX_PLACEHOLDER_TYPE_LENGTH: 40,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_MATCHES_PER_RULE: 1000
});

export const DSN_RISKY_FIELDS = Object.freeze([
  'pattern',
  'regex',
  'flags',
  'capture_group',
  'script',
  'code',
  'eval',
  'function',
  'remote_update_url',
  'external_url',
  'url',
  'javascript',
  'data'
]);

export const DSN_TOP_LEVEL_FIELDS = Object.freeze([
  'schema_version',
  'dsn_type',
  'ruleset_id',
  'name',
  'version',
  'description',
  'rules'
]);

export const DSN_COMMON_RULE_FIELDS = Object.freeze([
  'id',
  'type',
  'enabled',
  'placeholder_type',
  'priority',
  'description',
  'case_sensitive',
  'max_matches'
]);

export const DSN_TYPE_FIELDS = Object.freeze({
  [DSN_RULE_TYPES.LITERAL_TERMS]: ['terms', 'match_word_boundary'],
  [DSN_RULE_TYPES.LABELED_VALUE]: ['labels', 'separators', 'value_mode'],
  [DSN_RULE_TYPES.PREFIX_TOKEN]: ['prefixes', 'min_length', 'max_length', 'allowed_chars'],
  [DSN_RULE_TYPES.STRUCTURED_ID]: ['prefixes', 'segments'],
  [DSN_RULE_TYPES.CONTEXT_VALUE]: ['context_labels', 'separators', 'value_kind', 'min_length', 'max_length']
});

export const DSN_PLACEHOLDER_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
export const DSN_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
export const DSN_RULESET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && Array.isArray(value) === false;
}

export function isSupportedRuleType(type) {
  return Object.values(DSN_RULE_TYPES).includes(type);
}

export function isValidPlaceholderType(value) {
  return typeof value === 'string' &&
    value.length <= DSN_LIMITS.MAX_PLACEHOLDER_TYPE_LENGTH &&
    DSN_PLACEHOLDER_PATTERN.test(value);
}

export function isSafeIdentifier(value) {
  return typeof value === 'string' &&
    value.length <= DSN_LIMITS.MAX_RULE_ID_LENGTH &&
    DSN_IDENTIFIER_PATTERN.test(value);
}

export function isSafeRulesetId(value) {
  return typeof value === 'string' &&
    value.length <= DSN_LIMITS.MAX_RULESET_ID_LENGTH &&
    DSN_RULESET_ID_PATTERN.test(value);
}
