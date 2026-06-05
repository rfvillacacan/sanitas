'use strict';

(function initSanitasChatGptAdapter() {
  if (window.SanitasChatGptAdapter) {
    return;
  }

  // Selector priority: ChatGPT commonly uses a contenteditable composer; explicit textbox role is safest.
  const CONTENTEDITABLE_SELECTORS = [
    // Stable composer shape seen on ChatGPT-like UIs.
    '[contenteditable="true"][role="textbox"]',
    // Scoped fallback keeps selection inside the main app area when role metadata changes.
    'main [contenteditable="true"]',
    // Last contenteditable fallback; guarded by visibility and enabled checks before use.
    '[contenteditable="true"]'
  ];

  // Textarea fallback: older/simple composers and the mock page may use a textarea instead.
  const TEXTAREA_SELECTORS = [
    // Prefer prompt-labeled textarea composers.
    'textarea[aria-label*="prompt" i]',
    // Some composer implementations expose message placeholder text instead of labels.
    'textarea[placeholder*="message" i]',
    // Scoped fallback avoids unrelated textareas outside the main app when possible.
    'main textarea',
    // Last textarea fallback; guarded by visibility and enabled checks before use.
    'textarea'
  ];

  // Selector priority: use ChatGPT's explicit assistant role first, then documented mock/test fallbacks.
  const ASSISTANT_MESSAGE_SELECTORS = [
    // Explicit ChatGPT assistant-message attribute.
    '[data-message-author-role="assistant"]',
    // Mock fixture fallback: safe controlled pages use this test id.
    '[data-testid="assistant-message"]',
    // Mock fixture fallback: allows assistant-labeled article variants without scanning arbitrary text.
    'article[data-testid*="assistant" i]'
  ];

  function insertTextIntoComposer(text) {
    const value = typeof text === 'string' ? text : '';

    if (!value) {
      return { ok: false, error: { code: 'EMPTY_TEXT' } };
    }

    const composer = findComposer();

    if (!composer) {
      return { ok: false, error: { code: 'COMPOSER_NOT_FOUND' } };
    }

    if (isTextarea(composer)) {
      setTextareaValue(composer, value);
      return { ok: true, data: { composerType: 'textarea' } };
    }

    setContenteditableValue(composer, value);
    return { ok: true, data: { composerType: 'contenteditable' } };
  }

  function findComposer() {
    return queryFirstUsable(CONTENTEDITABLE_SELECTORS) || queryFirstUsable(TEXTAREA_SELECTORS);
  }

  function captureLatestAssistantResponse() {
    const message = findLatestAssistantMessage();

    if (!message) {
      return { ok: false, error: { code: 'ASSISTANT_RESPONSE_NOT_FOUND' } };
    }

    const text = normalizeCapturedText(message.textContent);

    if (!text) {
      return { ok: false, error: { code: 'ASSISTANT_RESPONSE_NOT_FOUND' } };
    }

    return { ok: true, data: { text } };
  }

  function findLatestAssistantMessage() {
    const candidates = collectUniqueCandidates(ASSISTANT_MESSAGE_SELECTORS)
      .filter(isVisibleMessage)
      .filter((element) => normalizeCapturedText(element.textContent));

    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  }

  function queryFirstUsable(selectors) {
    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);

      for (const candidate of candidates) {
        if (isUsableComposer(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  function collectUniqueCandidates(selectors) {
    const seen = new Set();

    for (const selector of selectors) {
      for (const candidate of document.querySelectorAll(selector)) {
        seen.add(candidate);
      }
    }

    return Array.from(seen).sort(compareDocumentOrder);
  }

  function isUsableComposer(element) {
    if (!element || element.disabled || element.readOnly) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function isVisibleMessage(element) {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function isTextarea(element) {
    return element instanceof HTMLTextAreaElement;
  }

  function setTextareaValue(textarea, value) {
    textarea.focus();

    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');

    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(textarea, value);
    } else {
      textarea.value = value;
    }

    dispatchComposerEvents(textarea, value);
  }

  function setContenteditableValue(element, value) {
    element.focus();
    element.textContent = value;
    dispatchComposerEvents(element, value);
  }

  function dispatchComposerEvents(element, value) {
    let inputEvent;

    try {
      inputEvent = new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value
      });
    } catch {
      inputEvent = new Event('input', { bubbles: true });
    }

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function compareDocumentOrder(left, right) {
    if (left === right) {
      return 0;
    }

    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  function normalizeCapturedText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  window.SanitasChatGptAdapter = Object.freeze({
    captureLatestAssistantResponse,
    findComposer,
    insertTextIntoComposer
  });
})();
