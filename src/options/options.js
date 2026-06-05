import { MESSAGE_TYPES } from '../core/messages.js';
import {
  BUILT_IN_DETECTOR_TYPES,
  DEFAULT_DETECTOR_SETTINGS,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  sanitizeSettings
} from '../core/settings.js';

const elements = {};
let currentSettings = DEFAULT_SETTINGS;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  await loadOptions();
}

function cacheElements() {
  elements.form = document.getElementById('optionsForm');
  elements.panelWidth = document.getElementById('panelWidth');
  elements.theme = document.getElementById('theme');
  elements.autoWrapPrompt = document.getElementById('autoWrapPrompt');
  elements.showCaptureHelper = document.getElementById('showCaptureHelper');
  elements.showMappingPreview = document.getElementById('showMappingPreview');
  elements.customTermsEnabled = document.getElementById('customTermsEnabled');
  elements.detectorControls = document.getElementById('detectorControls');
  elements.enableAllDetectorsBtn = document.getElementById('enableAllDetectorsBtn');
  elements.disableAllDetectorsBtn = document.getElementById('disableAllDetectorsBtn');
  elements.resetDetectorsBtn = document.getElementById('resetDetectorsBtn');
  elements.customTermsInput = document.getElementById('customTermsInput');
  elements.customTermsSummary = document.getElementById('customTermsSummary');
  elements.saveCustomTermsBtn = document.getElementById('saveCustomTermsBtn');
  elements.clearCustomTermsBtn = document.getElementById('clearCustomTermsBtn');
  elements.dsnSummary = document.getElementById('dsnSummary');
  elements.clearDsnRulesBtn = document.getElementById('clearDsnRulesBtn');
  elements.resetBtn = document.getElementById('resetBtn');
  elements.clearSessionBtn = document.getElementById('clearSessionBtn');
  elements.status = document.getElementById('status');
}

function bindEvents() {
  elements.form.addEventListener('submit', saveOptions);
  elements.enableAllDetectorsBtn.addEventListener('click', () => setDetectorCheckboxes(true));
  elements.disableAllDetectorsBtn.addEventListener('click', () => setDetectorCheckboxes(false));
  elements.resetDetectorsBtn.addEventListener('click', () => renderDetectorSettings(DEFAULT_DETECTOR_SETTINGS));
  elements.saveCustomTermsBtn.addEventListener('click', saveCustomTerms);
  elements.clearCustomTermsBtn.addEventListener('click', clearCustomTerms);
  elements.clearDsnRulesBtn.addEventListener('click', clearDsnRules);
  elements.resetBtn.addEventListener('click', resetOptions);
  elements.clearSessionBtn.addEventListener('click', clearCurrentSession);
}

async function loadOptions() {
  try {
    const data = await chrome.storage.local.get([SETTINGS_STORAGE_KEY]);
    currentSettings = sanitizeSettings(data[SETTINGS_STORAGE_KEY]);

    if (!data[SETTINGS_STORAGE_KEY] || JSON.stringify(data[SETTINGS_STORAGE_KEY]) !== JSON.stringify(currentSettings)) {
      await chrome.storage.local.set({
        [SETTINGS_STORAGE_KEY]: currentSettings
      });
    }

    renderSettings(currentSettings);
    await refreshCustomTermsSummary();
    await refreshDsnSummary();
    setStatus('Options loaded.');
  } catch {
    currentSettings = DEFAULT_SETTINGS;
    renderSettings(currentSettings);
    renderDsnSummary();
    setStatus('Options could not be loaded.');
  }
}

async function saveOptions(event) {
  event.preventDefault();

  const nextSettings = sanitizeSettings({
    sanitasPanelEnabled: currentSettings.sanitasPanelEnabled,
    panelWidth: elements.panelWidth.value,
    theme: elements.theme.value,
    autoWrapPrompt: elements.autoWrapPrompt.checked,
    showCaptureHelper: elements.showCaptureHelper.checked,
    showMappingPreview: elements.showMappingPreview.checked,
    customTermsEnabled: elements.customTermsEnabled.checked,
    detectors: readDetectorSettings()
  });

  await persistSettings(nextSettings, 'Options saved.');
}

async function resetOptions() {
  await persistSettings(DEFAULT_SETTINGS, 'Defaults restored.');
}

async function persistSettings(settings, statusMessage) {
  try {
    currentSettings = sanitizeSettings(settings);
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: currentSettings
    });
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: currentSettings },
      settings: currentSettings
    });
    renderSettings(currentSettings);
    await refreshCustomTermsSummary();
    await refreshDsnSummary();
    setStatus(statusMessage);
  } catch {
    setStatus('Options could not be saved.');
  }
}

function clearCurrentSession() {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_SESSION }, (response) => {
    if (chrome.runtime.lastError || !response || response.ok !== true) {
      setStatus('Session could not be cleared.');
      return;
    }

    renderCustomTermsSummary(response.data && response.data.customTermsSummary);
    renderDsnSummary(response.data && response.data.dsnSummary);
    elements.customTermsInput.value = '';
    setStatus('Session cleared.');
  });
}

function saveCustomTerms() {
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.SET_CUSTOM_TERMS,
    payload: {
      text: elements.customTermsInput.value
    }
  }, (response) => {
    if (chrome.runtime.lastError || !response || response.ok !== true) {
      setStatus('Custom terms could not be saved.');
      return;
    }

    elements.customTermsInput.value = '';
    renderCustomTermsSummary(response.data && response.data.customTermsSummary);
    setStatus('Custom terms saved for current session.');
  });
}

function clearCustomTerms() {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_CUSTOM_TERMS }, (response) => {
    if (chrome.runtime.lastError || !response || response.ok !== true) {
      setStatus('Custom terms could not be cleared.');
      return;
    }

    elements.customTermsInput.value = '';
    renderCustomTermsSummary(response.data && response.data.customTermsSummary);
    setStatus('Custom terms cleared.');
  });
}

function clearDsnRules() {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_DSN_RULES }, (response) => {
    if (chrome.runtime.lastError || !response || response.ok !== true) {
      setStatus('DSN rules could not be cleared.');
      return;
    }

    renderDsnSummary(response.data && response.data.dsnSummary);
    setStatus('DSN session rules cleared.');
  });
}

function renderSettings(settings) {
  const safeSettings = sanitizeSettings(settings);

  elements.panelWidth.value = String(safeSettings.panelWidth);
  elements.theme.value = safeSettings.theme;
  elements.autoWrapPrompt.checked = safeSettings.autoWrapPrompt;
  elements.showCaptureHelper.checked = safeSettings.showCaptureHelper;
  elements.showMappingPreview.checked = safeSettings.showMappingPreview;
  elements.customTermsEnabled.checked = safeSettings.customTermsEnabled;
  renderDetectorSettings(safeSettings.detectors);
}

function setStatus(message) {
  elements.status.textContent = message;
}

function refreshCustomTermsSummary() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_CUSTOM_TERMS_SUMMARY }, (response) => {
      if (!chrome.runtime.lastError && response && response.ok === true) {
        renderCustomTermsSummary(response.data && response.data.customTermsSummary);
      } else {
        renderCustomTermsSummary();
      }

      resolve();
    });
  });
}

function renderCustomTermsSummary(summary = {}) {
  const count = Number.isFinite(Number(summary.count)) ? Math.max(0, Math.floor(Number(summary.count))) : 0;

  elements.customTermsSummary.textContent = `Custom terms active: ${count}`;
}

function refreshDsnSummary() {
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

function renderDsnSummary(summary = {}) {
  const count = Number.isFinite(Number(summary.enabledRuleCount))
    ? Math.max(0, Math.floor(Number(summary.enabledRuleCount)))
    : 0;
  const rulesetCount = Number.isFinite(Number(summary.rulesetCount))
    ? Math.max(0, Math.floor(Number(summary.rulesetCount)))
    : 0;
  const hasDsnRules = summary.hasDsnRules === true;

  elements.dsnSummary.textContent = `DSN rules active: ${count} | hasDsnRules: ${hasDsnRules} | rulesetCount: ${rulesetCount} | enabledRuleCount: ${count}`;
}

function renderDetectorSettings(detectors) {
  if (elements.detectorControls.childElementCount === 0) {
    for (const type of BUILT_IN_DETECTOR_TYPES) {
      elements.detectorControls.appendChild(createDetectorControl(type));
    }
  }

  for (const type of BUILT_IN_DETECTOR_TYPES) {
    const checkbox = document.getElementById(getDetectorInputId(type));

    checkbox.checked = detectors[type] === true;
  }
}

function createDetectorControl(type) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  const text = document.createElement('span');

  label.className = 'check-row detector-row';
  checkbox.id = getDetectorInputId(type);
  checkbox.type = 'checkbox';
  checkbox.dataset.detectorType = type;
  text.textContent = `${type} detector`;

  label.append(checkbox, text);

  return label;
}

function readDetectorSettings() {
  const detectors = {};

  for (const type of BUILT_IN_DETECTOR_TYPES) {
    const checkbox = document.getElementById(getDetectorInputId(type));

    detectors[type] = checkbox ? checkbox.checked : DEFAULT_DETECTOR_SETTINGS[type];
  }

  return detectors;
}

function setDetectorCheckboxes(value) {
  for (const type of BUILT_IN_DETECTOR_TYPES) {
    const checkbox = document.getElementById(getDetectorInputId(type));

    if (checkbox) {
      checkbox.checked = Boolean(value);
    }
  }
}

function getDetectorInputId(type) {
  return `detector-${type}`;
}
