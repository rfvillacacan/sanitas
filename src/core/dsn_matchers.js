import {
  DSN_ALLOWED_CHARS,
  DSN_RULE_TYPES,
  DSN_SEGMENT_KINDS,
  DSN_VALUE_KINDS,
  DSN_VALUE_MODES
} from './dsn_schema.js';

export function createDsnMatchesForRule(inputText, rule) {
  const input = String(inputText || '');

  if (!input || !rule || rule.enabled !== true) {
    return [];
  }

  let matches = [];

  if (rule.type === DSN_RULE_TYPES.LITERAL_TERMS) {
    matches = detectLiteralTerms(input, rule);
  } else if (rule.type === DSN_RULE_TYPES.LABELED_VALUE) {
    matches = detectLabeledValues(input, rule);
  } else if (rule.type === DSN_RULE_TYPES.PREFIX_TOKEN) {
    matches = detectPrefixTokens(input, rule);
  } else if (rule.type === DSN_RULE_TYPES.STRUCTURED_ID) {
    matches = detectStructuredIds(input, rule);
  } else if (rule.type === DSN_RULE_TYPES.CONTEXT_VALUE) {
    matches = detectContextValues(input, rule);
  }

  return matches.slice(0, rule.max_matches);
}

function detectLiteralTerms(input, rule) {
  const matches = [];

  for (const term of rule.terms || []) {
    for (const start of findLiteralOccurrences(input, term, rule.case_sensitive)) {
      const end = start + term.length;

      if (rule.match_word_boundary && !hasWordBoundaries(input, start, end)) {
        continue;
      }

      matches.push(createMatch(input.slice(start, end), start, end, rule));
    }
  }

  return sortMatches(matches);
}

function detectLabeledValues(input, rule) {
  const matches = [];

  for (const label of rule.labels || []) {
    for (const labelStart of findLiteralOccurrences(input, label, rule.case_sensitive)) {
      if (isWordChar(input[labelStart - 1] || '')) {
        continue;
      }

      const valueRange = readLabeledValue(input, labelStart, label, rule.separators || [], rule.value_mode);

      if (valueRange) {
        matches.push(createMatch(input.slice(valueRange.start, valueRange.end), valueRange.start, valueRange.end, rule));
      }
    }
  }

  return sortMatches(matches);
}

function detectPrefixTokens(input, rule) {
  const matches = [];

  for (const prefix of rule.prefixes || []) {
    for (const start of findLiteralOccurrences(input, prefix, rule.case_sensitive)) {
      if (isAllowedTokenChar(input[start - 1] || '', rule.allowed_chars)) {
        continue;
      }

      let end = start + prefix.length;

      while (end < input.length && isAllowedTokenChar(input[end], rule.allowed_chars)) {
        end += 1;
      }

      const token = input.slice(start, end);

      if (token.length >= rule.min_length && token.length <= rule.max_length) {
        matches.push(createMatch(token, start, end, rule));
      }
    }
  }

  return sortMatches(matches);
}

function detectStructuredIds(input, rule) {
  const matches = [];

  for (const prefix of rule.prefixes || []) {
    for (const start of findLiteralOccurrences(input, prefix, rule.case_sensitive)) {
      if (isStructuredChar(input[start - 1] || '')) {
        continue;
      }

      let cursor = start + prefix.length;
      let ok = true;

      for (const segment of rule.segments || []) {
        const nextCursor = readStructuredSegment(input, cursor, segment);

        if (nextCursor === null) {
          ok = false;
          break;
        }

        cursor = nextCursor;
      }

      if (ok && cursor > start + prefix.length && !isStructuredChar(input[cursor] || '')) {
        matches.push(createMatch(input.slice(start, cursor), start, cursor, rule));
      }
    }
  }

  return sortMatches(matches);
}

function detectContextValues(input, rule) {
  const matches = [];

  for (const label of rule.context_labels || []) {
    for (const labelStart of findLiteralOccurrences(input, label, rule.case_sensitive)) {
      if (isWordChar(input[labelStart - 1] || '')) {
        continue;
      }

      const valueRange = readContextValue(input, labelStart, label, rule);

      if (valueRange) {
        matches.push(createMatch(input.slice(valueRange.start, valueRange.end), valueRange.start, valueRange.end, rule));
      }
    }
  }

  return sortMatches(matches);
}

function readLabeledValue(input, labelStart, label, separators, valueMode) {
  let cursor = labelStart + label.length;

  cursor = skipHorizontalWhitespace(input, cursor);
  const separator = findSeparator(input, cursor, separators);

  if (!separator) {
    return null;
  }

  cursor += separator.length;
  cursor = skipHorizontalWhitespace(input, cursor);

  return readValueByMode(input, cursor, valueMode || DSN_VALUE_MODES.UNTIL_WHITESPACE);
}

function readContextValue(input, labelStart, label, rule) {
  let cursor = labelStart + label.length;

  cursor = skipHorizontalWhitespace(input, cursor);
  const separator = findSeparator(input, cursor, rule.separators || []);

  if (!separator) {
    return null;
  }

  cursor += separator.length;
  cursor = skipHorizontalWhitespace(input, cursor);

  return readValueByKind(input, cursor, rule);
}

function readValueByMode(input, cursor, mode) {
  if (mode === DSN_VALUE_MODES.QUOTED_VALUE) {
    const quote = input[cursor];

    if (quote !== '"' && quote !== "'") {
      return null;
    }

    const end = input.indexOf(quote, cursor + 1);

    if (end <= cursor + 1) {
      return null;
    }

    return {
      start: cursor + 1,
      end
    };
  }

  if (mode === DSN_VALUE_MODES.UNTIL_LINE_END) {
    let end = cursor;

    while (end < input.length && input[end] !== '\n' && input[end] !== '\r') {
      end += 1;
    }

    while (end > cursor && /\s/.test(input[end - 1])) {
      end -= 1;
    }

    return end > cursor ? { start: cursor, end } : null;
  }

  const isValid = mode === DSN_VALUE_MODES.TOKEN
    ? (char) => isAllowedTokenChar(char, DSN_ALLOWED_CHARS.TOKEN_SAFE)
    : (char) => Boolean(char) && /\s/.test(char) === false;
  let end = cursor;

  while (end < input.length && isValid(input[end])) {
    end += 1;
  }

  return end > cursor ? { start: cursor, end } : null;
}

function readValueByKind(input, cursor, rule) {
  if (rule.value_kind === DSN_VALUE_KINDS.DATE_MM_YY || rule.value_kind === DSN_VALUE_KINDS.DATE_MM_YYYY) {
    const length = rule.value_kind === DSN_VALUE_KINDS.DATE_MM_YYYY ? 7 : 5;
    const value = input.slice(cursor, cursor + length);
    const pattern = rule.value_kind === DSN_VALUE_KINDS.DATE_MM_YYYY
      ? /^(0[1-9]|1[0-2])\/\d{4}$/
      : /^(0[1-9]|1[0-2])\/\d{2}$/;

    return pattern.test(value) ? { start: cursor, end: cursor + length } : null;
  }

  const kind = rule.value_kind || DSN_VALUE_KINDS.TOKEN;
  const predicate = getValueKindPredicate(kind);
  let end = cursor;

  while (end < input.length && predicate(input[end])) {
    end += 1;
  }

  const length = end - cursor;

  if (length < rule.min_length || length > rule.max_length) {
    return null;
  }

  return length > 0 ? { start: cursor, end } : null;
}

function readStructuredSegment(input, cursor, segment) {
  if (segment.kind === DSN_SEGMENT_KINDS.LITERAL) {
    return input.startsWith(segment.value, cursor) ? cursor + segment.value.length : null;
  }

  const predicate = getSegmentPredicate(segment.kind);
  let end = cursor;

  while (end < input.length && predicate(input[end]) && end - cursor < segment.max) {
    end += 1;
  }

  const length = end - cursor;

  if (length < segment.min || length > segment.max) {
    return null;
  }

  return end;
}

function findLiteralOccurrences(input, literal, caseSensitive) {
  const source = caseSensitive ? input : input.toLowerCase();
  const needle = caseSensitive ? literal : literal.toLowerCase();
  const positions = [];
  let cursor = 0;

  while (cursor <= source.length - needle.length) {
    const index = source.indexOf(needle, cursor);

    if (index === -1) {
      break;
    }

    positions.push(index);
    cursor = index + Math.max(1, needle.length);
  }

  return positions;
}

function findSeparator(input, cursor, separators) {
  return (separators || [])
    .slice()
    .sort((left, right) => right.length - left.length)
    .find((separator) => input.startsWith(separator, cursor)) || null;
}

function skipHorizontalWhitespace(input, cursor) {
  let next = cursor;

  while (next < input.length && (input[next] === ' ' || input[next] === '\t')) {
    next += 1;
  }

  return next;
}

function createMatch(text, start, end, rule) {
  return {
    type: rule.placeholder_type,
    tokenType: rule.placeholder_type,
    text,
    start,
    end,
    priority: rule.priority,
    resolverPriority: -Math.max(1, Number(rule.priority || 1)),
    score: 0.95,
    source: 'dsn_rule',
    ruleId: rule.id,
    rule_id: rule.id,
    ruleType: rule.type,
    rule_type: rule.type
  };
}

function sortMatches(matches) {
  return matches.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.end - right.start - (left.end - left.start);
  });
}

function hasWordBoundaries(input, start, end) {
  return !isWordChar(input[start - 1] || '') && !isWordChar(input[end] || '');
}

function isWordChar(char) {
  return /[A-Za-z0-9_]/.test(char);
}

function isStructuredChar(char) {
  return /[A-Za-z0-9_-]/.test(char);
}

function getValueKindPredicate(kind) {
  if (kind === DSN_VALUE_KINDS.DIGITS) {
    return (char) => /[0-9]/.test(char);
  }

  if (kind === DSN_VALUE_KINDS.ALNUM) {
    return (char) => /[A-Za-z0-9]/.test(char);
  }

  return (char) => isAllowedTokenChar(char, DSN_ALLOWED_CHARS.TOKEN_SAFE);
}

function getSegmentPredicate(kind) {
  if (kind === DSN_SEGMENT_KINDS.DIGITS) {
    return (char) => /[0-9]/.test(char);
  }

  if (kind === DSN_SEGMENT_KINDS.ALPHA) {
    return (char) => /[A-Za-z]/.test(char);
  }

  if (kind === DSN_SEGMENT_KINDS.ALNUM) {
    return (char) => /[A-Za-z0-9]/.test(char);
  }

  if (kind === DSN_SEGMENT_KINDS.HEX) {
    return (char) => /[A-Fa-f0-9]/.test(char);
  }

  return () => false;
}

function isAllowedTokenChar(char, allowedChars) {
  if (!char) {
    return false;
  }

  if (allowedChars === DSN_ALLOWED_CHARS.ALPHA_NUM) {
    return /[A-Za-z0-9]/.test(char);
  }

  if (allowedChars === DSN_ALLOWED_CHARS.ALPHA_NUM_DASH) {
    return /[A-Za-z0-9-]/.test(char);
  }

  if (allowedChars === DSN_ALLOWED_CHARS.ALPHA_NUM_UNDERSCORE) {
    return /[A-Za-z0-9_]/.test(char);
  }

  if (allowedChars === DSN_ALLOWED_CHARS.ALPHA_NUM_UNDERSCORE_DASH || allowedChars === DSN_ALLOWED_CHARS.BASE64URL) {
    return /[A-Za-z0-9_-]/.test(char);
  }

  if (allowedChars === DSN_ALLOWED_CHARS.HEX) {
    return /[A-Fa-f0-9]/.test(char);
  }

  return /[A-Za-z0-9_./~+:-]/.test(char);
}
