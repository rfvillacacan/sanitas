import { detectEntities } from './detectors.js';
import { detectDsnEntities } from './dsn_detector.js';
import { resolveOverlaps } from './overlap.js';
import { getOrCreateToken, normalizeSessionMap, normalizeTokenType } from './tokenizer.js';

export function sanitizeText(inputText, sessionMap, options = {}) {
  const input = String(inputText || '');
  let nextSessionMap = normalizeSessionMap(sessionMap);

  if (!input) {
    return createResult('', nextSessionMap, [], false);
  }

  const matches = resolveOverlaps([
    ...detectEntities(input, options),
    ...detectDsnEntities(input, options)
  ]);
  const entities = [];
  let output = input;

  for (const match of matches) {
    const tokenType = getPlaceholderType(match);
    const tokenResult = getOrCreateToken(match.text, tokenType, nextSessionMap);

    nextSessionMap = tokenResult.sessionMap;
    entities.push({
      type: match.type,
      tokenType,
      token: tokenResult.token,
      original: match.text,
      start: match.start,
      end: match.end
    });
  }

  for (const entity of entities.slice().sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, entity.start)}${entity.token}${output.slice(entity.end)}`;
  }

  return createResult(output, nextSessionMap, entities, output !== input);
}

function createResult(text, sessionMap, entities, changed) {
  return {
    text,
    sessionMap,
    entities,
    summary: summarize(entities),
    changed
  };
}

function summarize(entities) {
  const byType = {};

  for (const entity of entities) {
    byType[entity.tokenType] = (byType[entity.tokenType] || 0) + 1;
  }

  return {
    totalReplacements: entities.length,
    byType
  };
}

function getPlaceholderType(match) {
  if (match.tokenType === 'API_KEY') {
    return 'API_KEY';
  }

  return normalizeTokenType(match.tokenType || match.type);
}
