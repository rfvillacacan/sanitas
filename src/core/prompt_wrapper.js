const WRAPPER_HEADER = 'Sanitas instruction: preserve Sanitas placeholders exactly.';

export function wrapSanitizedPrompt(text) {
  const input = String(text || '').trim();

  if (!input) {
    return '';
  }

  if (input.startsWith(WRAPPER_HEADER)) {
    return input;
  }

  return [
    WRAPPER_HEADER,
    'Do not rename, reformat, translate, split, or remove placeholders such as [[EMAIL_0001]].',
    '',
    input
  ].join('\n');
}
