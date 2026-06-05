import { MESSAGE_TYPES } from '../core/messages.js';
import {
  createDsnExampleRuleset,
  createDsnTemplateRule,
  formatDsnJson,
  insertDsnTemplateIntoText,
  stringifyDsn
} from '../core/dsn_templates.js';

export function initDsnEditor(options = {}) {
  const elements = cacheDsnElements();
  const setStatus = typeof options.setStatus === 'function' ? options.setStatus : () => {};
  let exportObjectUrl = '';

  elements.textarea.value = stringifyDsn(createDsnExampleRuleset());
  updateExportLink();

  elements.fileInput.addEventListener('change', async () => {
    const [file] = Array.from(elements.fileInput.files || []);

    if (!file) {
      return;
    }

    try {
      elements.textarea.value = await file.text();
      updateExportLink();
      clearValidationErrors();
      setStatus('DSN JSON loaded. Validate before applying.');
    } catch {
      setStatus('DSN JSON file could not be loaded.');
    } finally {
      elements.fileInput.value = '';
    }
  });

  elements.textarea.addEventListener('input', () => {
    updateExportLink();
  });

  for (const button of elements.templateButtons) {
    button.addEventListener('click', () => {
      insertTemplate(button.dataset.dsnTemplate);
    });
  }

  elements.fullExampleButton.addEventListener('click', () => {
    replaceWithSafeExample({ requireConfirmation: true });
  });

  elements.resetExampleButton.addEventListener('click', () => {
    replaceWithSafeExample({ requireConfirmation: true });
  });

  elements.prettyButton.addEventListener('click', () => {
    const formatted = formatDsnJson(elements.textarea.value);

    if (!formatted.ok) {
      renderValidationErrors([formatted.error]);
      setStatus('Invalid DSN ruleset.');
      return;
    }

    elements.textarea.value = formatted.text;
    updateExportLink();
    clearValidationErrors();
    setStatus('DSN JSON formatted.');
  });

  elements.validateButton.addEventListener('click', async () => {
    const validation = await validateCurrentDsn();

    if (!validation) {
      setStatus('DSN rules could not be validated.');
      return;
    }

    renderValidationResult(validation);
  });

  elements.applyButton.addEventListener('click', async () => {
    const validation = await validateCurrentDsn();

    if (!validation) {
      setStatus('DSN rules could not be validated.');
      return;
    }

    if (validation.ok !== true) {
      renderValidationResult(validation);
      return;
    }

    const response = await sendDsnMessage(MESSAGE_TYPES.IMPORT_DSN_RULES);

    if (!response || response.ok !== true) {
      renderValidationErrors(response && response.error ? [response.error] : []);
      setStatus('Invalid DSN ruleset.');
      return;
    }

    renderValidationSuccess();
    renderDsnSummary(response.data && response.data.dsnSummary);
    setStatus('DSN rules applied to current session.');
  });

  elements.clearButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_DSN_RULES }, (response) => {
      if (chrome.runtime.lastError || !response || response.ok !== true) {
        setStatus('DSN rules could not be cleared.');
        return;
      }

      renderDsnSummary(response.data && response.data.dsnSummary);
      clearValidationErrors();
      setStatus('DSN session rules cleared.');
    });
  });

  elements.cancelReplaceButton.addEventListener('click', () => {
    closeReplaceModal();
    setStatus('DSN JSON unchanged.');
  });

  elements.confirmReplaceButton.addEventListener('click', () => {
    closeReplaceModal();
    replaceWithSafeExample({ requireConfirmation: false });
  });

  elements.replaceModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeReplaceModal();
      setStatus('DSN JSON unchanged.');
    }
  });

  refreshDsnSummary();

  return {
    refreshSummary: refreshDsnSummary
  };

  function refreshDsnSummary(summary) {
    if (summary) {
      renderDsnSummary(summary);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_DSN_SUMMARY }, (response) => {
        if (!chrome.runtime.lastError && response && response.ok === true) {
          renderDsnSummary(response.data && response.data.dsnSummary);
        } else {
          renderDsnSummary();
        }

        resolve();
      });
    });
  }

  function sendDsnMessage(type) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type,
        payload: {
          text: elements.textarea.value
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response);
      });
    });
  }

  function validateCurrentDsn() {
    return sendDsnMessage(MESSAGE_TYPES.VALIDATE_DSN_RULES)
      .then((response) => {
        if (!response || response.ok !== true) {
          return null;
        }

        return response.data && response.data.validation;
      });
  }

  function insertTemplate(type) {
    try {
      createDsnTemplateRule(type);
    } catch {
      setStatus('DSN template is not available.');
      return;
    }

    const result = insertDsnTemplateIntoText(elements.textarea.value, type);

    if (!result.ok) {
      renderValidationErrors([result.error]);
      setStatus('Invalid DSN ruleset.');
      return;
    }

    elements.textarea.value = result.text;
    updateExportLink();
    clearValidationErrors();
    setStatus('DSN template inserted. Validate before applying.');
  }

  function replaceWithSafeExample(options = {}) {
    if (options.requireConfirmation && elements.textarea.value.trim()) {
      openReplaceModal();
      return;
    }

    elements.textarea.value = stringifyDsn(createDsnExampleRuleset());
    updateExportLink();
    clearValidationErrors();
    setStatus('Safe DSN example loaded. Validate before applying.');
  }

  function openReplaceModal() {
    elements.replaceModal.hidden = false;
    elements.confirmReplaceButton.focus();
  }

  function closeReplaceModal() {
    elements.replaceModal.hidden = true;
  }

  function updateExportLink() {
    if (exportObjectUrl) {
      URL.revokeObjectURL(exportObjectUrl);
    }

    const blob = new Blob([elements.textarea.value || '{}'], {
      type: 'application/json'
    });
    exportObjectUrl = URL.createObjectURL(blob);
    elements.exportLink.href = exportObjectUrl;
    elements.exportLink.download = `sanitas-dsn-backup-${formatTimestamp(new Date())}.json`;
  }

  function renderDsnSummary(summary = {}) {
    const count = Number.isFinite(Number(summary.enabledRuleCount))
      ? Math.max(0, Math.floor(Number(summary.enabledRuleCount)))
      : 0;
    const rulesetCount = Number.isFinite(Number(summary.rulesetCount))
      ? Math.max(0, Math.floor(Number(summary.rulesetCount)))
      : 0;
    const hasDsnRules = summary.hasDsnRules === true;
    const ruleTypes = Array.isArray(summary.ruleTypes) ? summary.ruleTypes.join(', ') : '';
    const placeholderTypes = Array.isArray(summary.placeholderTypes) ? summary.placeholderTypes.join(', ') : '';
    const lines = [
      `DSN rules active: ${count}`,
      `hasDsnRules: ${hasDsnRules}`,
      `rulesetCount: ${rulesetCount}`,
      `enabledRuleCount: ${count}`
    ];

    if (ruleTypes) {
      lines.push(`Rule types: ${ruleTypes}`);
    }

    if (placeholderTypes) {
      lines.push(`Placeholder types: ${placeholderTypes}`);
    }

    elements.summary.textContent = lines.join(' | ');
  }

  function renderValidationResult(validation) {
    if (validation && validation.ok === true) {
      renderValidationSuccess();
      renderDsnSummary(validation.summary);
      setStatus('Valid DSN ruleset.');
      return;
    }

    renderValidationErrors(validation && validation.errors);
    setStatus('Invalid DSN ruleset.');
  }

  function renderValidationSuccess() {
    elements.validationErrors.innerHTML = '';
    const message = document.createElement('p');

    message.textContent = 'Valid DSN ruleset.';
    elements.validationErrors.append(message);
  }

  function renderValidationErrors(errors = []) {
    const safeErrors = Array.isArray(errors) ? errors.slice(0, 5) : [];

    elements.validationErrors.innerHTML = '';

    const heading = document.createElement('p');
    heading.textContent = 'Invalid DSN ruleset.';
    elements.validationErrors.append(heading);

    if (safeErrors.length === 0) {
      return;
    }

    const list = document.createElement('ul');

    for (const item of safeErrors) {
      const row = document.createElement('li');
      const severity = item.severity || 'error';
      const path = formatErrorPath(item.path || 'root');
      const message = item.message || 'Validation error.';

      row.textContent = `${severity}: ${path} - ${message}`;
      list.append(row);
    }

    elements.validationErrors.append(list);
  }

  function clearValidationErrors() {
    elements.validationErrors.innerHTML = '';
  }
}

function cacheDsnElements() {
  return {
    textarea: document.getElementById('dsnRulesTextarea'),
    fileInput: document.getElementById('dsnFileInput'),
    templateButtons: Array.from(document.querySelectorAll('[data-dsn-template]')),
    fullExampleButton: document.getElementById('insertFullDsnExampleBtn'),
    prettyButton: document.getElementById('prettyFormatDsnBtn'),
    resetExampleButton: document.getElementById('resetDsnExampleBtn'),
    validateButton: document.getElementById('validateDsnRulesBtn'),
    applyButton: document.getElementById('applyDsnRulesBtn'),
    exportLink: document.getElementById('backupDsnRulesLink'),
    clearButton: document.getElementById('clearDsnRulesBtn'),
    summary: document.getElementById('dsnSummary'),
    validationErrors: document.getElementById('dsnValidationErrors'),
    replaceModal: document.getElementById('dsnReplaceModal'),
    cancelReplaceButton: document.getElementById('cancelDsnReplaceBtn'),
    confirmReplaceButton: document.getElementById('confirmDsnReplaceBtn')
  };
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatErrorPath(path) {
  return String(path || 'root').replace(/\.([0-9]+)/g, '[$1]');
}
