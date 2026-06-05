import { DETECTOR_TYPES } from './detectors.js';

export const SETTINGS_STORAGE_KEY = 'sanitasSettings';

export const BUILT_IN_DETECTOR_TYPES = Object.freeze([
  DETECTOR_TYPES.BEARER_TOKEN,
  DETECTOR_TYPES.JWT,
  DETECTOR_TYPES.API_KEY_LIKE_SECRET,
  DETECTOR_TYPES.URL,
  DETECTOR_TYPES.EMAIL,
  DETECTOR_TYPES.IPV6,
  DETECTOR_TYPES.IPV4,
  DETECTOR_TYPES.MAC_ADDRESS,
  DETECTOR_TYPES.WINDOWS_FILE_PATH,
  DETECTOR_TYPES.LINUX_FILE_PATH,
  DETECTOR_TYPES.HOSTNAME,
  DETECTOR_TYPES.DOMAIN,
  DETECTOR_TYPES.PHONE
]);

export const DEFAULT_DETECTOR_SETTINGS = Object.freeze(Object.fromEntries(
  BUILT_IN_DETECTOR_TYPES.map((type) => [type, true])
));

export const DEFAULT_SETTINGS = Object.freeze({
  sanitasPanelEnabled: false,
  sanitasCollapsed: false,
  theme: 'system',
  panelWidth: 380,
  sanitasWindowX: null,
  sanitasWindowY: null,
  sanitasSideTabY: null,
  sanitasWindowWidth: 380,
  sanitasWindowHeight: 560,
  sanitasMode: 'real_to_dummy',
  autoWrapPrompt: true,
  showCaptureHelper: true,
  showMappingPreview: false,
  customTermsEnabled: true,
  detectors: DEFAULT_DETECTOR_SETTINGS
});

const THEMES = new Set(['light', 'dark', 'system']);
const MODES = new Set(['real_to_dummy', 'dummy_to_real']);
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 520;
const MIN_WINDOW_WIDTH = 320;
const MAX_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 420;
const MAX_WINDOW_HEIGHT = 900;
const MAX_WINDOW_POSITION = 5000;

export function sanitizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const theme = THEMES.has(source.theme) ? source.theme : DEFAULT_SETTINGS.theme;
  const parsedPanelWidth = Number(source.panelWidth);
  let panelWidth = DEFAULT_SETTINGS.panelWidth;

  if (Number.isFinite(parsedPanelWidth)) {
    if (parsedPanelWidth >= MIN_PANEL_WIDTH && parsedPanelWidth <= MAX_PANEL_WIDTH) {
      panelWidth = Math.round(parsedPanelWidth);
    }
  }

  const windowWidth = sanitizeWindowSize(
    Object.hasOwn(source, 'sanitasWindowWidth') ? source.sanitasWindowWidth : panelWidth,
    MIN_WINDOW_WIDTH,
    MAX_WINDOW_WIDTH,
    DEFAULT_SETTINGS.sanitasWindowWidth
  );
  const windowHeight = sanitizeWindowSize(
    source.sanitasWindowHeight,
    MIN_WINDOW_HEIGHT,
    MAX_WINDOW_HEIGHT,
    DEFAULT_SETTINGS.sanitasWindowHeight
  );

  return {
    sanitasPanelEnabled: typeof source.sanitasPanelEnabled === 'boolean'
      ? source.sanitasPanelEnabled
      : DEFAULT_SETTINGS.sanitasPanelEnabled,
    sanitasCollapsed: typeof source.sanitasCollapsed === 'boolean'
      ? source.sanitasCollapsed
      : DEFAULT_SETTINGS.sanitasCollapsed,
    theme,
    panelWidth,
    sanitasWindowX: sanitizeWindowPosition(source.sanitasWindowX),
    sanitasWindowY: sanitizeWindowPosition(source.sanitasWindowY),
    sanitasSideTabY: sanitizeWindowPosition(source.sanitasSideTabY),
    sanitasWindowWidth: windowWidth,
    sanitasWindowHeight: windowHeight,
    sanitasMode: MODES.has(source.sanitasMode) ? source.sanitasMode : DEFAULT_SETTINGS.sanitasMode,
    autoWrapPrompt: typeof source.autoWrapPrompt === 'boolean'
      ? source.autoWrapPrompt
      : DEFAULT_SETTINGS.autoWrapPrompt,
    showCaptureHelper: typeof source.showCaptureHelper === 'boolean'
      ? source.showCaptureHelper
      : DEFAULT_SETTINGS.showCaptureHelper,
    showMappingPreview: typeof source.showMappingPreview === 'boolean'
      ? source.showMappingPreview
      : DEFAULT_SETTINGS.showMappingPreview,
    customTermsEnabled: typeof source.customTermsEnabled === 'boolean'
      ? source.customTermsEnabled
      : DEFAULT_SETTINGS.customTermsEnabled,
    detectors: sanitizeDetectorSettings(source.detectors)
  };
}

export function normalizeSettings(value) {
  return sanitizeSettings(value);
}

export function mergeSettings(current, patch) {
  const safeCurrent = sanitizeSettings(current);
  const sourcePatch = patch && typeof patch === 'object' ? patch : {};
  const merged = Object.assign({}, safeCurrent, sourcePatch);

  if (Object.hasOwn(sourcePatch, 'panelWidth') && !Object.hasOwn(sourcePatch, 'sanitasWindowWidth')) {
    merged.sanitasWindowWidth = sourcePatch.panelWidth;
  }

  if (sourcePatch.detectors && typeof sourcePatch.detectors === 'object') {
    merged.detectors = Object.assign({}, safeCurrent.detectors, sourcePatch.detectors);
  }

  return sanitizeSettings(merged);
}

export function getSafeSettingsSummary(settings) {
  const safeSettings = sanitizeSettings(settings);
  const enabledDetectorCount = getEnabledDetectorTypes(safeSettings).length;

  return {
    sanitasPanelEnabled: safeSettings.sanitasPanelEnabled,
    sanitasCollapsed: safeSettings.sanitasCollapsed,
    theme: safeSettings.theme,
    panelWidth: safeSettings.panelWidth,
    sanitasWindowX: safeSettings.sanitasWindowX,
    sanitasWindowY: safeSettings.sanitasWindowY,
    sanitasSideTabY: safeSettings.sanitasSideTabY,
    sanitasWindowWidth: safeSettings.sanitasWindowWidth,
    sanitasWindowHeight: safeSettings.sanitasWindowHeight,
    sanitasMode: safeSettings.sanitasMode,
    autoWrapPrompt: safeSettings.autoWrapPrompt,
    showCaptureHelper: safeSettings.showCaptureHelper,
    showMappingPreview: safeSettings.showMappingPreview,
    customTermsEnabled: safeSettings.customTermsEnabled,
    enabledDetectorCount,
    disabledDetectorCount: BUILT_IN_DETECTOR_TYPES.length - enabledDetectorCount
  };
}

export function getEnabledDetectorTypes(settings) {
  const safeSettings = sanitizeSettings(settings);

  return BUILT_IN_DETECTOR_TYPES.filter((type) => safeSettings.detectors[type] === true);
}

function sanitizeDetectorSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const detectors = {};

  for (const type of BUILT_IN_DETECTOR_TYPES) {
    detectors[type] = typeof source[type] === 'boolean'
      ? source[type]
      : DEFAULT_DETECTOR_SETTINGS[type];
  }

  return detectors;
}

function sanitizeWindowPosition(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_WINDOW_POSITION) {
    return null;
  }

  return Math.round(parsed);
}

function sanitizeWindowSize(value, minimum, maximum, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}
