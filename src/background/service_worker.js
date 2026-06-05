import { MESSAGE_TYPES, createError, createOk } from '../core/messages.js';
import { restoreText } from '../core/restore.js';
import { sanitizeText } from '../core/sanitizer.js';
import { SETTINGS_STORAGE_KEY, getEnabledDetectorTypes, mergeSettings, normalizeSettings } from '../core/settings.js';
import { wrapSanitizedPrompt } from '../core/prompt_wrapper.js';
import { MAX_CUSTOM_TERMS_PAYLOAD_LENGTH, normalizeCustomTerms } from '../core/custom_terms.js';
import { DSN_LIMITS } from '../core/dsn_schema.js';
import { validateDsnRules } from '../core/dsn_validator.js';
import { clearDsnRules, createDsnSummary, getDsnRules, saveDsnRules } from '../core/dsn_storage.js';
import {
  clearCustomTerms,
  clearSessionMap,
  clearWorkspaceState,
  createCustomTermsSummary,
  createSessionSummary,
  createWorkspaceSummary,
  getCustomTerms,
  getSessionMap,
  getWorkspaceState,
  saveCustomTerms,
  saveSessionMap,
  saveWorkspaceState
} from '../core/vault.js';

export const DEFAULT_MAX_TEXT_LENGTH = 200000;

export function createMessageHandler(options = {}) {
  const localStorageArea = options.localStorageArea || chrome.storage.local;
  const sessionStorageArea = options.sessionStorageArea || chrome.storage.session;
  const maxTextLength = Math.max(1, Number(options.maxTextLength || DEFAULT_MAX_TEXT_LENGTH));
  const now = options.now;

  return async function handleMessage(message) {
    try {
      return await routeMessage(message, {
        localStorageArea,
        sessionStorageArea,
        maxTextLength,
        now
      });
    } catch {
      return createError('INTERNAL_ERROR', 'Sanitas request failed.');
    }
  };
}

export async function initializeExtension(handlerOptions = {}) {
  const localStorageArea = handlerOptions.localStorageArea || chrome.storage.local;
  const sessionStorageArea = handlerOptions.sessionStorageArea || chrome.storage.session;

  await ensureSettings(localStorageArea);
  await getSessionMap(sessionStorageArea, { now: handlerOptions.now });
  await getDsnRules(sessionStorageArea, { now: handlerOptions.now });
}

async function routeMessage(message, context) {
  if (!message || typeof message !== 'object' || !message.type) {
    return createError('VALIDATION_ERROR', 'Message type is required.');
  }

  if (message.type === MESSAGE_TYPES.GET_SETTINGS) {
    const settings = await ensureSettings(context.localStorageArea);

    return withLegacySettings(createOk({ settings }), settings);
  }

  if (message.type === MESSAGE_TYPES.UPDATE_SETTINGS) {
    const settings = await updateSettings(message.settings || (message.payload && message.payload.settings), context.localStorageArea);

    return withLegacySettings(createOk({ settings }), settings);
  }

  if (message.type === MESSAGE_TYPES.SANITIZE_TEXT) {
    return sanitizeMessage(message, context);
  }

  if (message.type === MESSAGE_TYPES.RESTORE_TEXT) {
    return restoreMessage(message, context);
  }

  if (message.type === MESSAGE_TYPES.CLEAR_SESSION) {
    const emptyMap = await clearSessionMap(context.sessionStorageArea, { now: context.now });
    const emptyCustomTerms = await clearCustomTerms(context.sessionStorageArea, { now: context.now });
    const emptyWorkspaceState = await clearWorkspaceState(context.sessionStorageArea, { now: context.now });
    const emptyDsnRules = await clearDsnRules(context.sessionStorageArea, { now: context.now });
    const settings = await ensureSettings(context.localStorageArea);

    return createOk({
      cleared: true,
      sessionSummary: createSessionSummary(emptyMap),
      customTermsSummary: createCustomTermsSummary(emptyCustomTerms, settings.customTermsEnabled),
      workspaceSummary: createWorkspaceSummary(emptyWorkspaceState),
      dsnSummary: createDsnSummary(emptyDsnRules)
    });
  }

  if (message.type === MESSAGE_TYPES.GET_SESSION_SUMMARY) {
    const sessionMap = await getSessionMap(context.sessionStorageArea, { now: context.now });

    return createOk({
      sessionSummary: createSessionSummary(sessionMap)
    });
  }

  if (message.type === MESSAGE_TYPES.SET_CUSTOM_TERMS) {
    return setCustomTermsMessage(message, context);
  }

  if (message.type === MESSAGE_TYPES.CLEAR_CUSTOM_TERMS) {
    const emptyCustomTerms = await clearCustomTerms(context.sessionStorageArea, { now: context.now });
    const settings = await ensureSettings(context.localStorageArea);

    return createOk({
      customTermsSummary: createCustomTermsSummary(emptyCustomTerms, settings.customTermsEnabled)
    });
  }

  if (message.type === MESSAGE_TYPES.GET_CUSTOM_TERMS_SUMMARY) {
    const customTerms = await getCustomTerms(context.sessionStorageArea, { now: context.now });
    const settings = await ensureSettings(context.localStorageArea);

    return createOk({
      customTermsSummary: createCustomTermsSummary(customTerms, settings.customTermsEnabled)
    });
  }

  if (message.type === MESSAGE_TYPES.WRAP_PROMPT) {
    const validation = validateTextPayload(message, context.maxTextLength);

    if (!validation.ok) {
      return validation.response;
    }

    return createOk({
      text: wrapSanitizedPrompt(validation.text)
    });
  }

  if (message.type === MESSAGE_TYPES.SAVE_WORKSPACE_STATE) {
    return saveWorkspaceStateMessage(message, context);
  }

  if (message.type === MESSAGE_TYPES.GET_WORKSPACE_STATE) {
    const workspaceState = await getWorkspaceState(context.sessionStorageArea, { now: context.now });

    return createOk({
      workspaceState: getWorkspaceStatePayload(workspaceState),
      workspaceSummary: createWorkspaceSummary(workspaceState)
    });
  }

  if (message.type === MESSAGE_TYPES.CLEAR_WORKSPACE_STATE) {
    const emptyWorkspaceState = await clearWorkspaceState(context.sessionStorageArea, { now: context.now });

    return createOk({
      workspaceSummary: createWorkspaceSummary(emptyWorkspaceState)
    });
  }

  if (message.type === MESSAGE_TYPES.VALIDATE_DSN_RULES) {
    return validateDsnRulesMessage(message, context);
  }

  if (message.type === MESSAGE_TYPES.IMPORT_DSN_RULES) {
    return importDsnRulesMessage(message, context);
  }

  if (message.type === MESSAGE_TYPES.CLEAR_DSN_RULES) {
    const emptyDsnRules = await clearDsnRules(context.sessionStorageArea, { now: context.now });

    return createOk({
      dsnSummary: createDsnSummary(emptyDsnRules)
    });
  }

  if (message.type === MESSAGE_TYPES.GET_DSN_SUMMARY) {
    const dsnRules = await getDsnRules(context.sessionStorageArea, { now: context.now });

    return createOk({
      dsnSummary: createDsnSummary(dsnRules)
    });
  }

  return createError('UNKNOWN_MESSAGE_TYPE', 'Unsupported Sanitas message type.');
}

async function sanitizeMessage(message, context) {
  const validation = validateTextPayload(message, context.maxTextLength);

  if (!validation.ok) {
    return validation.response;
  }

  const sessionMap = await getSessionMap(context.sessionStorageArea, { now: context.now });
  const settings = await ensureSettings(context.localStorageArea);
  const customTerms = await getCustomTerms(context.sessionStorageArea, { now: context.now });
  const dsnRules = await getDsnRules(context.sessionStorageArea, { now: context.now });
  const result = sanitizeText(validation.text, sessionMap, Object.assign({}, getPayloadOptions(message), {
    enabledDetectorTypes: getEnabledDetectorTypes(settings),
    customTermsEnabled: settings.customTermsEnabled,
    customTerms: settings.customTermsEnabled ? customTerms.terms : [],
    dsnRulesets: dsnRules.rulesets
  }));
  const savedMap = await saveSessionMap(result.sessionMap, context.sessionStorageArea, {
    now: context.now
  });

  return createOk({
    text: result.text,
    detectedCount: result.entities.length,
    replacementCount: result.summary.totalReplacements,
    sessionSummary: createSessionSummary(savedMap),
    dsnSummary: createDsnSummary(dsnRules)
  });
}

async function validateDsnRulesMessage(message, context) {
  const payload = validateDsnPayload(message);

  if (!payload.ok) {
    return payload.response;
  }

  const validation = validateDsnRules(payload.value, {
    maxJsonSize: DSN_LIMITS.MAX_JSON_SIZE
  });

  return createOk({
    validation,
    dsnSummary: validation.summary
  });
}

async function importDsnRulesMessage(message, context) {
  const payload = validateDsnPayload(message);

  if (!payload.ok) {
    return payload.response;
  }

  const validation = validateDsnRules(payload.value, {
    maxJsonSize: DSN_LIMITS.MAX_JSON_SIZE
  });

  if (!validation.ok) {
    return createError('DSN_VALIDATION_ERROR', 'DSN rules are not valid.');
  }

  const savedDsnRules = await saveDsnRules(validation.ruleset, context.sessionStorageArea, {
    now: context.now
  });

  return createOk({
    dsnSummary: createDsnSummary(savedDsnRules)
  });
}

async function setCustomTermsMessage(message, context) {
  const validation = validateCustomTermsPayload(message);

  if (!validation.ok) {
    return validation.response;
  }

  const normalized = normalizeCustomTerms(validation.value);
  const savedCustomTerms = await saveCustomTerms(normalized.terms, context.sessionStorageArea, {
    now: context.now
  });
  const settings = await ensureSettings(context.localStorageArea);

  return createOk({
    acceptedCount: savedCustomTerms.terms.length,
    rejectedCount: normalized.rejectedCount,
    customTermsSummary: createCustomTermsSummary(savedCustomTerms, settings.customTermsEnabled)
  });
}

async function restoreMessage(message, context) {
  const validation = validateTextPayload(message, context.maxTextLength);

  if (!validation.ok) {
    return validation.response;
  }

  const sessionMap = await getSessionMap(context.sessionStorageArea, { now: context.now });
  const result = restoreText(validation.text, sessionMap, getPayloadOptions(message));

  return createOk({
    text: result.text,
    restoredCount: result.restoredCount,
    unknownTokenCount: result.unknownTokens.length,
    sessionSummary: createSessionSummary(sessionMap)
  });
}

async function saveWorkspaceStateMessage(message, context) {
  const validation = validateWorkspaceStatePayload(message, context.maxTextLength);

  if (!validation.ok) {
    return validation.response;
  }

  const savedWorkspaceState = await saveWorkspaceState(validation.value, context.sessionStorageArea, {
    now: context.now
  });

  return createOk({
    workspaceSummary: createWorkspaceSummary(savedWorkspaceState)
  });
}

function validateTextPayload(message, maxTextLength) {
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};

  if (typeof payload.text !== 'string') {
    return {
      ok: false,
      response: createError('VALIDATION_ERROR', 'Text must be a string.')
    };
  }

  if (payload.text.length > maxTextLength) {
    return {
      ok: false,
      response: createError('TEXT_TOO_LARGE', 'Text exceeds the maximum supported length.')
    };
  }

  return {
    ok: true,
    text: payload.text
  };
}

function getPayloadOptions(message) {
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};

  return payload.options && typeof payload.options === 'object' ? payload.options : {};
}

function validateCustomTermsPayload(message) {
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  const value = typeof payload.text === 'string' ? payload.text : payload.terms;

  if (typeof value !== 'string' && Array.isArray(value) === false) {
    return {
      ok: false,
      response: createError('VALIDATION_ERROR', 'Custom terms text is required.')
    };
  }

  const size = typeof value === 'string'
    ? value.length
    : JSON.stringify(value).length;

  if (size > MAX_CUSTOM_TERMS_PAYLOAD_LENGTH) {
    return {
      ok: false,
      response: createError('TEXT_TOO_LARGE', 'Custom terms exceed the maximum supported length.')
    };
  }

  return {
    ok: true,
    value
  };
}

function validateWorkspaceStatePayload(message, maxTextLength) {
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  const topText = typeof payload.topText === 'string' ? payload.topText : null;
  const bottomText = typeof payload.bottomText === 'string' ? payload.bottomText : null;
  const outputState = typeof payload.outputState === 'string' ? payload.outputState : null;

  if (topText === null || bottomText === null || outputState === null) {
    return {
      ok: false,
      response: createError('VALIDATION_ERROR', 'Workspace state is required.')
    };
  }

  if (topText.length > maxTextLength || bottomText.length > maxTextLength) {
    return {
      ok: false,
      response: createError('TEXT_TOO_LARGE', 'Text exceeds the maximum supported length.')
    };
  }

  return {
    ok: true,
    value: {
      topText,
      bottomText,
      outputState
    }
  };
}

function validateDsnPayload(message) {
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};

  if (typeof payload.text === 'string') {
    return {
      ok: true,
      value: payload.text
    };
  }

  if (payload.dsn && typeof payload.dsn === 'object') {
    return {
      ok: true,
      value: payload.dsn
    };
  }

  return {
    ok: false,
    response: createError('VALIDATION_ERROR', 'DSN JSON text is required.')
  };
}

function getWorkspaceStatePayload(workspaceState) {
  return {
    topText: workspaceState.topText,
    bottomText: workspaceState.bottomText,
    outputState: workspaceState.outputState
  };
}

async function ensureSettings(localStorageArea) {
  const data = await localStorageArea.get([SETTINGS_STORAGE_KEY]);
  const settings = normalizeSettings(data[SETTINGS_STORAGE_KEY]);

  if (!data[SETTINGS_STORAGE_KEY] || JSON.stringify(data[SETTINGS_STORAGE_KEY]) !== JSON.stringify(settings)) {
    await localStorageArea.set({
      [SETTINGS_STORAGE_KEY]: settings
    });
  }

  return settings;
}

async function updateSettings(patch, localStorageArea) {
  const current = await ensureSettings(localStorageArea);
  const settings = mergeSettings(current, patch);

  await localStorageArea.set({
    [SETTINGS_STORAGE_KEY]: settings
  });

  return settings;
}

function withLegacySettings(response, settings) {
  return Object.assign({}, response, { settings });
}

function registerServiceWorker() {
  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    !chrome.runtime.onMessage ||
    !chrome.runtime.onInstalled ||
    !chrome.storage ||
    !chrome.storage.local ||
    !chrome.storage.session
  ) {
    return;
  }

  const handleMessage = createMessageHandler({
    localStorageArea: chrome.storage.local,
    sessionStorageArea: chrome.storage.session
  });

  chrome.runtime.onInstalled.addListener(() => {
    initializeExtension({
      localStorageArea: chrome.storage.local,
      sessionStorageArea: chrome.storage.session
    }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(() => {
        sendResponse(createError('INTERNAL_ERROR', 'Sanitas request failed.'));
      });

    return true;
  });
}

registerServiceWorker();
