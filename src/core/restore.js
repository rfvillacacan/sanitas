import { normalizeSessionMap } from './tokenizer.js';

const TOKEN_PATTERN = /\[\[[A-Z0-9_]+_\d{4}\]\]/g;

export function restoreText(inputText, sessionMap) {
  const input = String(inputText || '');
  const map = normalizeSessionMap(sessionMap);

  if (!input) {
    return {
      text: '',
      restoredCount: 0,
      unknownTokens: [],
      changed: false
    };
  }

  let restoredCount = 0;
  const unknownTokens = [];
  const seenUnknown = new Set();

  const text = input.replace(TOKEN_PATTERN, (token) => {
    if (Object.hasOwn(map.tokenToOriginal, token)) {
      restoredCount += 1;
      return map.tokenToOriginal[token];
    }

    if (!seenUnknown.has(token)) {
      unknownTokens.push(token);
      seenUnknown.add(token);
    }

    return token;
  });

  return {
    text,
    restoredCount,
    unknownTokens,
    changed: text !== input
  };
}
