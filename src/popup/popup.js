import { MESSAGE_TYPES } from '../core/messages.js';
import { SETTINGS_STORAGE_KEY, mergeSettings, normalizeSettings } from '../core/settings.js';

const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  await loadSettings();
}

function cacheElements() {
  elements.panelToggle = document.getElementById('panelToggle');
  elements.optionsBtn = document.getElementById('optionsBtn');
  elements.clearSessionBtn = document.getElementById('clearSessionBtn');
  elements.status = document.getElementById('status');
}

function bindEvents() {
  elements.panelToggle.addEventListener('change', savePanelEnabled);
  elements.optionsBtn.addEventListener('click', openOptions);
  elements.clearSessionBtn.addEventListener('click', clearSession);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) {
      return;
    }

    applySettings(changes[SETTINGS_STORAGE_KEY].newValue);
  });
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([SETTINGS_STORAGE_KEY]);
    const settings = normalizeSettings(data[SETTINGS_STORAGE_KEY]);

    if (!data[SETTINGS_STORAGE_KEY]) {
      await chrome.storage.local.set({
        [SETTINGS_STORAGE_KEY]: settings
      });
    }

    applySettings(settings);
    setStatus('Settings loaded.');
  } catch (error) {
    applySettings();
    setStatus('Settings could not be loaded.');
  }
}

async function savePanelEnabled() {
  try {
    const data = await chrome.storage.local.get([SETTINGS_STORAGE_KEY]);
    const settings = mergeSettings(data[SETTINGS_STORAGE_KEY], {
      sanitasPanelEnabled: elements.panelToggle.checked
    });

    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: settings
    });

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      settings
    });

    setStatus(settings.sanitasPanelEnabled ? 'Panel enabled on ChatGPT.' : 'Panel disabled.');
  } catch (error) {
    setStatus('Panel setting could not be saved.');
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function clearSession() {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_SESSION }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      setStatus('Session could not be cleared.');
      return;
    }

    setStatus('Session cleared.');
  });
}

function applySettings(value) {
  const settings = normalizeSettings(value);

  elements.panelToggle.checked = settings.sanitasPanelEnabled;
}

function setStatus(message) {
  elements.status.textContent = message;
}
