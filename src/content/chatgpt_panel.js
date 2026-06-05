'use strict';

(function initSanitasChatGptPanel() {
  if (window.__SANITAS_CHATGPT_PANEL_LOADED__) {
    return;
  }

  window.__SANITAS_CHATGPT_PANEL_LOADED__ = true;

  const SANITAS_PANEL_HOST_ID = 'sanitas-panel-host';
  const SETTINGS_STORAGE_KEY = 'sanitasSettings';
  const MODES = Object.freeze({
    REAL_TO_DUMMY: 'real_to_dummy',
    DUMMY_TO_REAL: 'dummy_to_real'
  });
  const DEFAULT_SETTINGS = Object.freeze({
    sanitasPanelEnabled: false,
    sanitasCollapsed: false,
    theme: 'system',
    panelWidth: 380,
    sanitasWindowX: null,
    sanitasWindowY: null,
    sanitasSideTabY: null,
    sanitasWindowWidth: 380,
    sanitasWindowHeight: 560,
    sanitasMode: MODES.REAL_TO_DUMMY,
    autoWrapPrompt: true,
    showCaptureHelper: true,
    showMappingPreview: false,
    customTermsEnabled: true
  });
  const MESSAGE_TYPES = Object.freeze({
    GET_SETTINGS: 'SANITAS_GET_SETTINGS',
    UPDATE_SETTINGS: 'SANITAS_UPDATE_SETTINGS',
    SANITIZE_TEXT: 'SANITAS_SANITIZE_TEXT',
    RESTORE_TEXT: 'SANITAS_RESTORE_TEXT',
    CLEAR_SESSION: 'SANITAS_CLEAR_SESSION',
    SAVE_WORKSPACE_STATE: 'SANITAS_SAVE_WORKSPACE_STATE',
    GET_WORKSPACE_STATE: 'SANITAS_GET_WORKSPACE_STATE',
    VALIDATE_DSN_RULES: 'SANITAS_VALIDATE_DSN_RULES',
    IMPORT_DSN_RULES: 'SANITAS_IMPORT_DSN_RULES',
    CLEAR_DSN_RULES: 'SANITAS_CLEAR_DSN_RULES',
    GET_DSN_SUMMARY: 'SANITAS_GET_DSN_SUMMARY'
  });
  const PANEL_TABS = Object.freeze({
    TEXT: 'text',
    DSN: 'dsn'
  });
  const OUTPUT_STATES = Object.freeze({
    EMPTY: 'empty',
    SANITIZED: 'sanitized',
    RESTORED: 'restored'
  });
  const DSN_RULE_TYPES = Object.freeze({
    LITERAL_TERMS: 'literal_terms',
    LABELED_VALUE: 'labeled_value',
    PREFIX_TOKEN: 'prefix_token',
    STRUCTURED_ID: 'structured_id',
    CONTEXT_VALUE: 'context_value'
  });
  const DSN_TEMPLATE_TOOLTIPS = Object.freeze({
    [DSN_RULE_TYPES.LITERAL_TERMS]: 'Detect exact literal terms. Example: Project Titan -> [[CUSTOM_TERM_0001]]. Options: terms, case_sensitive, match_word_boundary.',
    [DSN_RULE_TYPES.LABELED_VALUE]: 'Detect a value after a label. Example: DB_PASS=SafeDummyValue -> DB_PASS=[[DATABASE_SECRET_0001]]. Options: labels, separators, value_mode.',
    [DSN_RULE_TYPES.PREFIX_TOKEN]: 'Detect tokens with a known prefix. Example: sk_test_ABCDEF1234567890 -> [[API_KEY_0001]]. Options: prefixes, min_length, max_length, allowed_chars.',
    [DSN_RULE_TYPES.STRUCTURED_ID]: 'Detect structured IDs. Example: DOC-INT-445566 -> [[DOCUMENT_ID_0001]]. Options: prefixes, segments.',
    [DSN_RULE_TYPES.CONTEXT_VALUE]: 'Detect weak values only near trusted context. Example: CVV: 123 -> CVV: [[CARD_SECURITY_CODE_0001]]. Options: context_labels, separators, value_kind.'
  });
  const DSN_TEMPLATE_RULES = Object.freeze({
    [DSN_RULE_TYPES.LITERAL_TERMS]: Object.freeze({
      id: 'PROJECT_NAMES',
      type: DSN_RULE_TYPES.LITERAL_TERMS,
      enabled: true,
      placeholder_type: 'CUSTOM_TERM',
      priority: 500,
      description: 'Dummy project and organization names.',
      terms: Object.freeze(['Project Titan', 'Acme Corp']),
      case_sensitive: false,
      match_word_boundary: true
    }),
    [DSN_RULE_TYPES.LABELED_VALUE]: Object.freeze({
      id: 'DB_PASSWORD',
      type: DSN_RULE_TYPES.LABELED_VALUE,
      enabled: true,
      placeholder_type: 'DATABASE_SECRET',
      priority: 900,
      description: 'Dummy database password labels.',
      labels: Object.freeze(['DB_PASS']),
      separators: Object.freeze(['=', ':']),
      value_mode: 'until_whitespace',
      case_sensitive: false
    }),
    [DSN_RULE_TYPES.PREFIX_TOKEN]: Object.freeze({
      id: 'TEST_API_KEY',
      type: DSN_RULE_TYPES.PREFIX_TOKEN,
      enabled: true,
      placeholder_type: 'API_KEY',
      priority: 950,
      description: 'Dummy test API key prefix.',
      prefixes: Object.freeze(['sk_test_']),
      min_length: 16,
      max_length: 120,
      allowed_chars: 'alpha_num_underscore_dash',
      case_sensitive: true
    }),
    [DSN_RULE_TYPES.STRUCTURED_ID]: Object.freeze({
      id: 'INTERNAL_DOCUMENT_ID',
      type: DSN_RULE_TYPES.STRUCTURED_ID,
      enabled: true,
      placeholder_type: 'DOCUMENT_ID',
      priority: 700,
      description: 'Dummy internal document ids.',
      prefixes: Object.freeze(['DOC-INT-']),
      segments: Object.freeze([Object.freeze({
        kind: 'digits',
        min: 4,
        max: 12
      })]),
      case_sensitive: true
    }),
    [DSN_RULE_TYPES.CONTEXT_VALUE]: Object.freeze({
      id: 'CARD_SECURITY_CODE',
      type: DSN_RULE_TYPES.CONTEXT_VALUE,
      enabled: true,
      placeholder_type: 'CARD_SECURITY_CODE',
      priority: 850,
      description: 'Dummy card security-code context.',
      context_labels: Object.freeze(['CVV']),
      separators: Object.freeze([':', '=']),
      value_kind: 'digits',
      min_length: 3,
      max_length: 4,
      case_sensitive: false
    })
  });
  const MIN_WINDOW_WIDTH = 320;
  const MAX_WINDOW_WIDTH = 720;
  const MIN_WINDOW_HEIGHT = 420;
  const MAX_WINDOW_HEIGHT = 900;
  const EDGE_GAP = 12;
  const DEFAULT_TOP = 72;
  const INPUT_DEBOUNCE_MS = 300;
  const WORKSPACE_SAVE_DEBOUNCE_MS = 300;

  let host = null;
  let elements = null;
  let outputState = OUTPUT_STATES.EMPTY;
  let currentMode = MODES.REAL_TO_DUMMY;
  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  let inputTimer = 0;
  let workspaceSaveTimer = 0;
  let processSerial = 0;
  let dragState = null;
  let resizeState = null;
  let sideTabDragState = null;
  let suppressSideTabClick = false;
  let isRestoringWorkspace = false;
  let settingsSaveChain = Promise.resolve();

  start();

  function start() {
    requestSettings();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) {
        return;
      }

      currentSettings = normalizePanelSettings(changes[SETTINGS_STORAGE_KEY].newValue);
      applySettingsState(currentSettings);
    });

    window.addEventListener('resize', () => {
      if (elements) {
        applyWindowGeometry(currentSettings);
      }
    });
  }

  function requestSettings() {
    sendRuntimeMessage({ type: MESSAGE_TYPES.GET_SETTINGS })
      .then((response) => {
        const settings = normalizePanelSettings(getResponseData(response).settings || response.settings || {});

        currentSettings = settings;
        applySettingsState(settings);
      })
      .catch(() => {
        currentSettings = Object.assign({}, DEFAULT_SETTINGS);
        applySettingsState(currentSettings);
      });
  }

  function applySettingsState(settings) {
    if (settings.sanitasPanelEnabled) {
      createPanel();
      applyPanelPreferences(settings);
      return;
    }

    removePanel();
  }

  function createPanel() {
    if (host && document.documentElement.contains(host)) {
      return;
    }

    host = document.createElement('div');
    host.id = SANITAS_PANEL_HOST_ID;
    host.setAttribute('data-sanitas-phase', '11');
    host.setAttribute('data-workspace-ready', 'false');
    setOutputState(OUTPUT_STATES.EMPTY);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(createStyles());
    shadow.appendChild(createPanelBody());
    document.documentElement.appendChild(host);
    applyPanelPreferences(currentSettings);
    restoreWorkspaceState();
  }

  function removePanel() {
    clearInputTimer();
    clearWorkspaceSaveTimer();

    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }

    host = null;
    elements = null;
    outputState = OUTPUT_STATES.EMPTY;
  }

  function createStyles() {
    const style = document.createElement('style');

    style.textContent = `
      :host {
        all: initial;
        color-scheme: light dark;
        font-family: Arial, sans-serif;
        --sanitas-window-background: Canvas;
        --sanitas-window-color: CanvasText;
        --sanitas-border: rgba(30, 41, 59, 0.22);
        --sanitas-subtle-border: rgba(30, 41, 59, 0.14);
        --sanitas-muted: color-mix(in srgb, var(--sanitas-window-color) 68%, transparent);
        --sanitas-accent: #0f766e;
        --sanitas-accent-soft: rgba(20, 184, 166, 0.12);
      }

      :host([data-sanitas-theme="light"]) {
        color-scheme: light;
        --sanitas-window-background: #ffffff;
        --sanitas-window-color: #111827;
        --sanitas-border: rgba(17, 24, 39, 0.22);
        --sanitas-subtle-border: rgba(17, 24, 39, 0.14);
        --sanitas-muted: rgba(17, 24, 39, 0.68);
        --sanitas-accent-soft: rgba(13, 148, 136, 0.12);
      }

      :host([data-sanitas-theme="dark"]) {
        color-scheme: dark;
        --sanitas-window-background: #111827;
        --sanitas-window-color: #f8fafc;
        --sanitas-border: rgba(248, 250, 252, 0.24);
        --sanitas-subtle-border: rgba(248, 250, 252, 0.16);
        --sanitas-muted: rgba(248, 250, 252, 0.68);
        --sanitas-accent-soft: rgba(45, 212, 191, 0.16);
      }

      .sanitas-window {
        box-sizing: border-box;
        position: fixed;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        min-width: ${MIN_WINDOW_WIDTH}px;
        min-height: ${MIN_WINDOW_HEIGHT}px;
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        background: var(--sanitas-window-background);
        color: var(--sanitas-window-color);
        box-shadow: 0 18px 54px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }

      .sanitas-window[hidden] {
        display: none !important;
      }

      .sanitas-side-tab[hidden] {
        display: none !important;
      }

      .sanitas-side-tab {
        box-sizing: border-box;
        position: fixed;
        right: 0;
        z-index: 2147483647;
        min-width: 42px;
        min-height: 112px;
        border: 1px solid var(--sanitas-border);
        border-right: 0;
        border-radius: 8px 0 0 8px;
        background: var(--sanitas-accent);
        color: #ffffff;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.24);
        cursor: grab;
        font: 700 12px/1.2 Arial, sans-serif;
        letter-spacing: 0;
        writing-mode: vertical-rl;
        text-orientation: mixed;
      }

      .sanitas-side-tab:active {
        cursor: grabbing;
      }

      .sanitas-header {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        align-items: start;
        padding: 12px 14px;
        border-bottom: 1px solid var(--sanitas-subtle-border);
        background: var(--sanitas-accent-soft);
        cursor: move;
        user-select: none;
      }

      .sanitas-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
      }

      .sanitas-subtitle {
        margin: 3px 0 0;
        color: var(--sanitas-muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .sanitas-main {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px 14px;
      }

      .sanitas-tab-list {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        overflow: hidden;
      }

      .sanitas-tab {
        min-height: 32px;
        border: 0;
        background: transparent;
        color: var(--sanitas-window-color);
        font: 12px/1.2 Arial, sans-serif;
        cursor: pointer;
      }

      .sanitas-tab[aria-selected="true"] {
        background: var(--sanitas-accent);
        color: #ffffff;
        font-weight: 700;
      }

      .sanitas-tab-panel {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        gap: 10px;
      }

      .sanitas-tab-panel[hidden] {
        display: none !important;
      }

      .sanitas-mode-toggle {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        overflow: hidden;
      }

      .sanitas-mode-option {
        min-height: 34px;
        border: 0;
        background: transparent;
        color: var(--sanitas-window-color);
        font: 12px/1.2 Arial, sans-serif;
        cursor: pointer;
      }

      .sanitas-mode-option[aria-checked="true"] {
        background: var(--sanitas-accent);
        color: #ffffff;
        font-weight: 700;
      }

      .sanitas-field {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        gap: 6px;
      }

      .sanitas-field-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .sanitas-label {
        font-size: 12px;
        font-weight: 700;
      }

      .sanitas-textarea {
        box-sizing: border-box;
        width: 100%;
        flex: 1;
        min-height: 96px;
        resize: none;
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        padding: 9px;
        background: var(--sanitas-window-background);
        color: var(--sanitas-window-color);
        font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      .sanitas-textarea[readonly] {
        color: color-mix(in srgb, var(--sanitas-window-color) 88%, transparent);
      }

      .sanitas-button {
        min-height: 30px;
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        padding: 0 10px;
        background: color-mix(in srgb, var(--sanitas-window-color) 5%, var(--sanitas-window-background));
        color: var(--sanitas-window-color);
        font: 12px/1.2 Arial, sans-serif;
        cursor: pointer;
      }

      .sanitas-button:disabled {
        cursor: wait;
        opacity: 0.68;
      }

      .sanitas-clear-button {
        min-width: 58px;
      }

      .sanitas-collapse-button {
        min-width: 30px;
        padding: 0 8px;
        font-weight: 700;
      }

      .sanitas-danger-button {
        border-color: #991b1b;
        background: #b91c1c;
        color: #ffffff;
      }

      .sanitas-status {
        min-height: 18px;
        margin: 0;
        padding-right: 20px;
        color: var(--sanitas-muted);
        font-size: 12px;
        line-height: 1.45;
      }

      .sanitas-dsn-help {
        margin: 0;
        color: var(--sanitas-muted);
        font-size: 11px;
        line-height: 1.35;
      }

      .sanitas-dsn-editor {
        box-sizing: border-box;
        width: 100%;
        flex: 1;
        min-height: 132px;
        resize: none;
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        padding: 9px;
        background: var(--sanitas-window-background);
        color: var(--sanitas-window-color);
        font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      .sanitas-dsn-summary,
      .sanitas-dsn-validation {
        margin: 0;
        color: var(--sanitas-muted);
        font-size: 11px;
        line-height: 1.35;
      }

      .sanitas-dsn-validation {
        max-height: 72px;
        overflow: auto;
      }

      .sanitas-dsn-validation p {
        margin: 0;
      }

      .sanitas-dsn-validation ul {
        margin: 4px 0 0;
        padding-left: 18px;
      }

      .sanitas-dsn-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .sanitas-dsn-actions .sanitas-button {
        min-height: 28px;
        padding: 0 8px;
        font-size: 11px;
      }

      .sanitas-resize-grip {
        position: absolute;
        right: 5px;
        bottom: 5px;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;
      }

      .sanitas-resize-grip::before {
        content: "";
        position: absolute;
        right: 2px;
        bottom: 2px;
        width: 12px;
        height: 12px;
        background:
          linear-gradient(135deg, transparent 0 45%, var(--sanitas-muted) 46% 54%, transparent 55%),
          linear-gradient(135deg, transparent 0 65%, var(--sanitas-muted) 66% 74%, transparent 75%);
      }

      .sanitas-modal-backdrop[hidden] {
        display: none !important;
      }

      .sanitas-modal-backdrop {
        position: absolute;
        inset: 0;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 23, 42, 0.46);
      }

      .sanitas-modal-dialog {
        box-sizing: border-box;
        width: min(100%, 340px);
        border: 1px solid var(--sanitas-border);
        border-radius: 8px;
        background: var(--sanitas-window-background);
        color: var(--sanitas-window-color);
        box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
        padding: 16px;
      }

      .sanitas-modal-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.25;
      }

      .sanitas-modal-message {
        margin: 8px 0 0;
        color: var(--sanitas-muted);
        font-size: 12px;
        line-height: 1.45;
      }

      .sanitas-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `;

    return style;
  }

  function createPanelBody() {
    const root = document.createElement('div');
    const panel = document.createElement('section');
    panel.className = 'sanitas-window';
    panel.dataset.sanitasWindow = 'true';
    panel.setAttribute('aria-label', 'Sanitas data sanitizer window');

    const header = document.createElement('header');
    header.className = 'sanitas-header';
    header.dataset.sanitasDragHandle = 'true';
    header.addEventListener('mousedown', startDrag);

    const heading = document.createElement('div');
    const title = document.createElement('p');
    const subtitle = document.createElement('p');

    title.className = 'sanitas-title';
    title.textContent = 'Sanitas';
    subtitle.className = 'sanitas-subtitle';
    subtitle.textContent = 'The Data Sanitizer';
    heading.append(title, subtitle);

    const clearSessionButton = createButton('Clear', 'sanitas-clear-button');
    const collapseButton = createButton('–', 'sanitas-collapse-button');

    collapseButton.setAttribute('aria-label', 'Collapse Sanitas');
    clearSessionButton.addEventListener('click', handleClearSession);
    collapseButton.addEventListener('click', () => {
      setCollapsedState(true, { save: true });
    });
    header.append(heading, collapseButton, clearSessionButton);

    const main = document.createElement('main');
    main.className = 'sanitas-main';

    const panelTabs = createPanelTabs();
    const textPanel = document.createElement('section');
    const dsnPanel = createDsnEditorPanel();
    const modeToggle = createModeToggle();
    const topTextarea = createTextareaField('sanitasTopTextarea', 'Input', createButton('Paste'));
    const bottomTextarea = createTextareaField('sanitasBottomTextarea', 'Output', createButton('Copy'), { readonly: true });
    const status = document.createElement('p');
    const resizeGrip = document.createElement('div');
    const clearModal = createClearSessionModal();
    const sideTab = document.createElement('button');

    topTextarea.action.addEventListener('click', handlePaste);
    bottomTextarea.action.addEventListener('click', handleCopy);
    topTextarea.textarea.addEventListener('input', () => {
      scheduleWorkspaceSave();
      scheduleProcessing();
    });

    textPanel.id = 'sanitasTextPanel';
    textPanel.className = 'sanitas-tab-panel';
    textPanel.dataset.sanitasTabPanel = PANEL_TABS.TEXT;
    textPanel.setAttribute('role', 'tabpanel');
    textPanel.setAttribute('aria-labelledby', 'sanitasTextTab');
    textPanel.append(modeToggle, topTextarea.field, bottomTextarea.field);

    status.className = 'sanitas-status';
    status.dataset.sanitasStatus = 'true';
    status.textContent = 'Ready.';

    resizeGrip.className = 'sanitas-resize-grip';
    resizeGrip.dataset.sanitasResizeGrip = 'true';
    resizeGrip.setAttribute('aria-hidden', 'true');
    resizeGrip.addEventListener('mousedown', startResize);

    sideTab.className = 'sanitas-side-tab';
    sideTab.dataset.sanitasSideTab = 'true';
    sideTab.type = 'button';
    sideTab.hidden = true;
    sideTab.setAttribute('aria-label', 'Expand Sanitas');
    sideTab.textContent = 'Sanitas';
    sideTab.addEventListener('mousedown', startSideTabDrag);
    sideTab.addEventListener('click', (event) => {
      if (suppressSideTabClick) {
        event.preventDefault();
        suppressSideTabClick = false;
        return;
      }

      setCollapsedState(false, { save: true });
    });

    main.append(panelTabs.tabList, textPanel, dsnPanel.panel, status);
    panel.append(header, main, resizeGrip, clearModal.backdrop);
    root.append(panel, sideTab);

    elements = {
      window: panel,
      sideTab,
      dragHandle: header,
      resizeGrip,
      topTextarea: topTextarea.textarea,
      bottomTextarea: bottomTextarea.textarea,
      status,
      tabButtons: panelTabs.buttons,
      tabPanels: [textPanel, dsnPanel.panel],
      modeButtons: Array.from(modeToggle.querySelectorAll('[data-sanitas-mode-option]')),
      dsnTextarea: dsnPanel.textarea,
      dsnSummary: dsnPanel.summary,
      dsnValidation: dsnPanel.validation,
      clearModal: clearModal.backdrop,
      clearModalCancelButton: clearModal.cancelButton,
      clearModalConfirmButton: clearModal.confirmButton,
      buttons: [
        clearSessionButton,
        topTextarea.action,
        bottomTextarea.action,
        ...panelTabs.buttons,
        ...dsnPanel.buttons
      ]
    };

    setActiveTab(PANEL_TABS.TEXT);
    renderDsnSummary();
    refreshDsnSummary();

    return root;
  }

  function createClearSessionModal() {
    const backdrop = document.createElement('div');
    const dialog = document.createElement('section');
    const title = document.createElement('h2');
    const message = document.createElement('p');
    const actions = document.createElement('div');
    const cancelButton = createButton('Cancel');
    const confirmButton = createButton('Clear Session', 'sanitas-danger-button');

    backdrop.className = 'sanitas-modal-backdrop';
    backdrop.dataset.sanitasClearModal = 'true';
    backdrop.hidden = true;
    backdrop.addEventListener('keydown', handleClearModalKeydown);

    dialog.className = 'sanitas-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'sanitasClearSessionTitle');
    dialog.setAttribute('aria-describedby', 'sanitasClearSessionMessage');

    title.id = 'sanitasClearSessionTitle';
    title.className = 'sanitas-modal-title';
    title.textContent = 'Clear session?';

    message.id = 'sanitasClearSessionMessage';
    message.className = 'sanitas-modal-message';
    message.textContent = 'This removes local placeholder mappings and session custom terms. Restoration will no longer be possible.';

    actions.className = 'sanitas-modal-actions';
    cancelButton.addEventListener('click', cancelClearSession);
    confirmButton.addEventListener('click', confirmClearSession);
    actions.append(cancelButton, confirmButton);
    dialog.append(title, message, actions);
    backdrop.append(dialog);

    return { backdrop, cancelButton, confirmButton };
  }

  function createPanelTabs() {
    const tabList = document.createElement('div');
    const textTab = createPanelTab(PANEL_TABS.TEXT, 'Text', 'sanitasTextTab', 'sanitasTextPanel');
    const dsnTab = createPanelTab(PANEL_TABS.DSN, 'DSN Rules', 'sanitasDsnTab', 'sanitasDsnPanel');

    tabList.className = 'sanitas-tab-list';
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'Sanitas workspace tabs');
    tabList.append(textTab, dsnTab);

    return {
      tabList,
      buttons: [textTab, dsnTab]
    };
  }

  function createPanelTab(tabName, label, id, panelId) {
    const button = document.createElement('button');

    button.id = id;
    button.className = 'sanitas-tab';
    button.type = 'button';
    button.dataset.sanitasTab = tabName;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.setAttribute('aria-controls', panelId);
    button.textContent = label;
    button.addEventListener('click', () => {
      setActiveTab(tabName);
    });

    return button;
  }

  function createDsnEditorPanel() {
    const panel = document.createElement('section');
    const help = document.createElement('p');
    const textarea = document.createElement('textarea');
    const summary = document.createElement('p');
    const validation = document.createElement('div');
    const templateActions = document.createElement('div');
    const actionRow = document.createElement('div');
    const fullExampleButton = createButton('Insert full example ruleset');
    const prettyButton = createButton('Pretty Format JSON');
    const validateButton = createButton('Validate Rules');
    const applyButton = createButton('Apply to Current Session');
    const clearRulesButton = createButton('Clear Session Rules');
    const buttons = [];

    panel.id = 'sanitasDsnPanel';
    panel.className = 'sanitas-tab-panel';
    panel.dataset.sanitasTabPanel = PANEL_TABS.DSN;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'sanitasDsnTab');
    panel.hidden = true;

    help.className = 'sanitas-dsn-help';
    help.textContent = 'Session-only DSN rules. Raw regex is rejected. Use templates, validate, then apply.';

    textarea.id = 'sanitasDsnRulesTextarea';
    textarea.className = 'sanitas-dsn-editor';
    textarea.setAttribute('aria-label', 'DSN JSON editor');
    textarea.spellcheck = false;
    textarea.value = stringifyDsn(createDsnExampleRuleset());
    textarea.addEventListener('input', clearDsnValidation);

    summary.className = 'sanitas-dsn-summary';
    summary.dataset.sanitasDsnSummary = 'true';

    validation.className = 'sanitas-dsn-validation';
    validation.dataset.sanitasDsnValidation = 'true';
    validation.setAttribute('aria-live', 'polite');

    templateActions.className = 'sanitas-dsn-actions';
    templateActions.setAttribute('aria-label', 'DSN template helpers');

    for (const type of Object.values(DSN_RULE_TYPES)) {
      const button = createDsnTemplateButton(type);

      templateActions.append(button);
      buttons.push(button);
    }

    fullExampleButton.title = 'Replace the editor with a complete safe dummy ruleset using all five DSN rule types.';
    prettyButton.title = 'Format valid DSN JSON with two-space indentation. Does not store rules.';
    validateButton.title = 'Check DSN JSON before applying it to the current browser session.';
    applyButton.title = 'Validate and store active DSN rules only for the current browser session.';
    clearRulesButton.title = 'Remove active DSN rules from the current browser session.';

    fullExampleButton.addEventListener('click', handleDsnFullExample);
    prettyButton.addEventListener('click', handleDsnPrettyFormat);
    validateButton.addEventListener('click', handleDsnValidate);
    applyButton.addEventListener('click', handleDsnApply);
    clearRulesButton.addEventListener('click', handleDsnClearRules);

    actionRow.className = 'sanitas-dsn-actions';
    actionRow.append(fullExampleButton, prettyButton, validateButton, applyButton, clearRulesButton);
    buttons.push(fullExampleButton, prettyButton, validateButton, applyButton, clearRulesButton);

    panel.append(help, textarea, summary, validation, templateActions, actionRow);

    return {
      panel,
      textarea,
      summary,
      validation,
      buttons
    };
  }

  function createDsnTemplateButton(type) {
    const button = createButton(`Insert ${type} template`);

    button.dataset.sanitasDsnTemplate = type;
    button.title = DSN_TEMPLATE_TOOLTIPS[type] || 'Insert a safe DSN template.';
    button.addEventListener('click', () => {
      handleDsnInsertTemplate(type);
    });

    return button;
  }

  function createModeToggle() {
    const wrapper = document.createElement('div');

    wrapper.className = 'sanitas-mode-toggle';
    wrapper.setAttribute('role', 'radiogroup');
    wrapper.setAttribute('aria-label', 'Sanitas translator mode');
    wrapper.append(
      createModeButton(MODES.REAL_TO_DUMMY, 'Clean'),
      createModeButton(MODES.DUMMY_TO_REAL, 'Restore')
    );

    return wrapper;
  }

  function createModeButton(mode, label) {
    const button = document.createElement('button');

    button.className = 'sanitas-mode-option';
    button.type = 'button';
    button.dataset.sanitasModeOption = mode;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.textContent = label;
    button.addEventListener('click', () => {
      setMode(mode, { save: true, process: true });
    });

    return button;
  }

  function createTextareaField(id, labelText, actionButton, options = {}) {
    const field = document.createElement('section');
    const row = document.createElement('div');
    const label = document.createElement('label');
    const textarea = document.createElement('textarea');

    field.className = 'sanitas-field';
    row.className = 'sanitas-field-row';
    label.className = 'sanitas-label';
    label.setAttribute('for', id);
    label.textContent = labelText;
    textarea.id = id;
    textarea.className = 'sanitas-textarea';
    textarea.setAttribute('aria-label', labelText);
    textarea.spellcheck = false;

    if (options.readonly) {
      textarea.readOnly = true;
    }

    row.append(label, actionButton);
    field.append(row, textarea);

    return { field, textarea, action: actionButton };
  }

  function createButton(label, extraClass = '') {
    const button = document.createElement('button');

    button.className = `sanitas-button ${extraClass}`.trim();
    button.type = 'button';
    button.textContent = label;

    return button;
  }

  function setActiveTab(tabName) {
    const safeTab = Object.values(PANEL_TABS).includes(tabName) ? tabName : PANEL_TABS.TEXT;

    if (!elements) {
      return;
    }

    for (const button of elements.tabButtons) {
      const isActive = button.dataset.sanitasTab === safeTab;

      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    }

    for (const panel of elements.tabPanels) {
      panel.hidden = panel.dataset.sanitasTabPanel !== safeTab;
    }

    if (safeTab === PANEL_TABS.DSN) {
      refreshDsnSummary();
    }
  }

  function handleDsnInsertTemplate(type) {
    if (!elements || !elements.dsnTextarea) {
      return;
    }

    const result = insertDsnTemplateIntoText(elements.dsnTextarea.value, type);

    if (!result.ok) {
      renderDsnValidationErrors([result.error]);
      setStatus('Invalid DSN ruleset.');
      return;
    }

    elements.dsnTextarea.value = result.text;
    clearDsnValidation();
    setStatus('DSN template inserted. Validate before applying.');
  }

  function handleDsnFullExample() {
    if (!elements || !elements.dsnTextarea) {
      return;
    }

    elements.dsnTextarea.value = stringifyDsn(createDsnExampleRuleset());
    clearDsnValidation();
    setStatus('Safe DSN example loaded. Validate before applying.');
  }

  function handleDsnPrettyFormat() {
    if (!elements || !elements.dsnTextarea) {
      return;
    }

    const result = formatDsnJson(elements.dsnTextarea.value);

    if (!result.ok) {
      renderDsnValidationErrors([result.error]);
      setStatus('Invalid DSN ruleset.');
      return;
    }

    elements.dsnTextarea.value = result.text;
    clearDsnValidation();
    setStatus('DSN JSON formatted.');
  }

  async function handleDsnValidate() {
    const validation = await validateCurrentDsn();

    if (!validation) {
      setStatus('DSN rules could not be validated.');
      return;
    }

    renderDsnValidationResult(validation);
  }

  async function handleDsnApply() {
    const validation = await validateCurrentDsn();

    if (!validation) {
      setStatus('DSN rules could not be validated.');
      return;
    }

    if (validation.ok !== true) {
      renderDsnValidationResult(validation);
      return;
    }

    setBusy(true);

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPES.IMPORT_DSN_RULES,
        payload: {
          text: elements.dsnTextarea.value
        }
      });

      if (!isOkResponse(response)) {
        renderDsnValidationErrors(response && response.error ? [response.error] : []);
        setStatus('Invalid DSN ruleset.');
        return;
      }

      renderDsnValidationSuccess();
      renderDsnSummary(getResponseData(response).dsnSummary);
      setStatus('DSN rules applied to current session.');

      if (currentMode === MODES.REAL_TO_DUMMY && elements.topTextarea.value) {
        processCurrentInput();
      }
    } catch {
      setStatus('DSN rules could not be applied.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDsnClearRules() {
    if (!elements) {
      return;
    }

    setBusy(true);

    try {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPES.CLEAR_DSN_RULES });

      if (!isOkResponse(response)) {
        setStatus('DSN rules could not be cleared.');
        return;
      }

      renderDsnSummary(getResponseData(response).dsnSummary);
      clearDsnValidation();
      setStatus('DSN session rules cleared.');

      if (currentMode === MODES.REAL_TO_DUMMY && elements.topTextarea.value) {
        processCurrentInput();
      }
    } catch {
      setStatus('DSN rules could not be cleared.');
    } finally {
      setBusy(false);
    }
  }

  async function validateCurrentDsn() {
    if (!elements || !elements.dsnTextarea) {
      return null;
    }

    try {
      const response = await sendRuntimeMessage({
        type: MESSAGE_TYPES.VALIDATE_DSN_RULES,
        payload: {
          text: elements.dsnTextarea.value
        }
      });

      if (!isOkResponse(response)) {
        renderDsnValidationErrors(response && response.error ? [response.error] : []);
        return null;
      }

      return getResponseData(response).validation;
    } catch {
      return null;
    }
  }

  async function refreshDsnSummary() {
    if (!elements || !elements.dsnSummary) {
      return;
    }

    try {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPES.GET_DSN_SUMMARY });

      if (isOkResponse(response)) {
        renderDsnSummary(getResponseData(response).dsnSummary);
        return;
      }
    } catch {
      // DSN summary is best-effort and must not expose editor contents in errors.
    }

    renderDsnSummary();
  }

  function renderDsnValidationResult(validation) {
    if (validation && validation.ok === true) {
      renderDsnValidationSuccess();
      renderDsnSummary(validation.summary);
      setStatus('Valid DSN ruleset.');
      return;
    }

    renderDsnValidationErrors(validation && validation.errors);
    setStatus('Invalid DSN ruleset.');
  }

  function renderDsnValidationSuccess() {
    if (!elements || !elements.dsnValidation) {
      return;
    }

    elements.dsnValidation.innerHTML = '';
    const message = document.createElement('p');

    message.textContent = 'Valid DSN ruleset.';
    elements.dsnValidation.append(message);
  }

  function renderDsnValidationErrors(errors = []) {
    if (!elements || !elements.dsnValidation) {
      return;
    }

    const safeErrors = Array.isArray(errors) ? errors.slice(0, 5) : [];
    const heading = document.createElement('p');

    elements.dsnValidation.innerHTML = '';
    heading.textContent = 'Invalid DSN ruleset.';
    elements.dsnValidation.append(heading);

    if (safeErrors.length === 0) {
      return;
    }

    const list = document.createElement('ul');

    for (const item of safeErrors) {
      const row = document.createElement('li');
      const severity = item.severity || 'error';
      const path = formatDsnErrorPath(item.path || 'root');
      const message = item.message || 'Validation error.';

      row.textContent = `${severity}: ${path} - ${message}`;
      list.append(row);
    }

    elements.dsnValidation.append(list);
  }

  function clearDsnValidation() {
    if (elements && elements.dsnValidation) {
      elements.dsnValidation.innerHTML = '';
    }
  }

  function renderDsnSummary(summary = {}) {
    if (!elements || !elements.dsnSummary) {
      return;
    }

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

    elements.dsnSummary.textContent = lines.join(' | ');
  }

  function createDsnTemplateRule(type) {
    const template = DSN_TEMPLATE_RULES[type];

    if (!template) {
      throw new Error('Unsupported DSN template type.');
    }

    return deepClone(template);
  }

  function createDsnExampleRuleset() {
    return createDsnRuleset(Object.values(DSN_RULE_TYPES).map((type) => createDsnTemplateRule(type)), {
      ruleset_id: 'sanitas-safe-example',
      name: 'Sanitas Safe Example Rules',
      description: 'Safe dummy DSN examples for local session testing.'
    });
  }

  function createDsnTemplateRuleset(type) {
    return createDsnRuleset([createDsnTemplateRule(type)], {
      ruleset_id: `sanitas-${String(type).replace(/_/g, '-')}-template`,
      name: `Sanitas ${String(type).replace(/_/g, ' ')} template`,
      description: 'Safe dummy DSN template for local session testing.'
    });
  }

  function insertDsnTemplateIntoText(inputText, type) {
    const text = String(inputText || '').trim();

    if (!text) {
      return {
        ok: true,
        text: stringifyDsn(createDsnTemplateRuleset(type))
      };
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: {
          path: 'root',
          severity: 'error',
          message: 'DSN JSON could not be parsed.'
        }
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.rules)) {
      return {
        ok: false,
        error: {
          path: 'rules',
          severity: 'error',
          message: 'DSN rules must be an array.'
        }
      };
    }

    parsed.rules.push(createDsnTemplateRule(type));

    return {
      ok: true,
      text: stringifyDsn(parsed)
    };
  }

  function formatDsnJson(inputText) {
    try {
      return {
        ok: true,
        text: stringifyDsn(JSON.parse(String(inputText || '')))
      };
    } catch {
      return {
        ok: false,
        error: {
          path: 'root',
          severity: 'error',
          message: 'DSN JSON could not be parsed.'
        }
      };
    }
  }

  function stringifyDsn(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  function createDsnRuleset(rules, options = {}) {
    return {
      schema_version: '1.0',
      dsn_type: 'sanitas_safe_rules',
      ruleset_id: options.ruleset_id || 'sanitas-safe-template',
      name: options.name || 'Sanitas Safe Template',
      version: '1.0.0',
      description: options.description || 'Safe dummy DSN rules for Sanitas.',
      rules
    };
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function formatDsnErrorPath(path) {
    return String(path || 'root').replace(/\.([0-9]+)/g, '[$1]');
  }

  function scheduleProcessing() {
    clearInputTimer();
    inputTimer = window.setTimeout(() => {
      processCurrentInput();
    }, INPUT_DEBOUNCE_MS);
  }

  function clearInputTimer() {
    if (inputTimer) {
      window.clearTimeout(inputTimer);
      inputTimer = 0;
    }
  }

  function scheduleWorkspaceSave() {
    if (isRestoringWorkspace) {
      return;
    }

    clearWorkspaceSaveTimer();
    workspaceSaveTimer = window.setTimeout(() => {
      saveWorkspaceStateNow();
    }, WORKSPACE_SAVE_DEBOUNCE_MS);
  }

  function clearWorkspaceSaveTimer() {
    if (workspaceSaveTimer) {
      window.clearTimeout(workspaceSaveTimer);
      workspaceSaveTimer = 0;
    }
  }

  async function saveWorkspaceStateNow() {
    if (!elements || isRestoringWorkspace) {
      return;
    }

    clearWorkspaceSaveTimer();

    try {
      await sendRuntimeMessage({
        type: MESSAGE_TYPES.SAVE_WORKSPACE_STATE,
        payload: {
          topText: elements.topTextarea.value,
          bottomText: elements.bottomTextarea.value,
          outputState
        }
      });
    } catch {
      // Workspace autosave is best-effort and must not expose text in UI errors.
    }
  }

  async function restoreWorkspaceState() {
    if (!elements) {
      return;
    }

    const initialTopText = elements.topTextarea.value;
    const initialBottomText = elements.bottomTextarea.value;

    try {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPES.GET_WORKSPACE_STATE });

      if (!isOkResponse(response) || !elements) {
        return;
      }

      const data = getResponseData(response);
      const workspaceState = data.workspaceState && typeof data.workspaceState === 'object'
        ? data.workspaceState
        : {};

      if (elements.topTextarea.value !== initialTopText || elements.bottomTextarea.value !== initialBottomText) {
        return;
      }

      isRestoringWorkspace = true;
      elements.topTextarea.value = typeof workspaceState.topText === 'string' ? workspaceState.topText : '';
      elements.bottomTextarea.value = typeof workspaceState.bottomText === 'string' ? workspaceState.bottomText : '';
      setOutputState(getSafeOutputState(workspaceState.outputState));
      setStatus('Ready.');
    } catch {
      if (elements && elements.topTextarea.value === initialTopText && elements.bottomTextarea.value === initialBottomText) {
        setStatus('Ready.');
      }
    } finally {
      isRestoringWorkspace = false;
      if (host) {
        host.setAttribute('data-workspace-ready', 'true');
      }
    }
  }

  async function processCurrentInput() {
    if (!elements) {
      return;
    }

    clearInputTimer();

    const serial = ++processSerial;
    const input = elements.topTextarea.value;

    if (!input) {
      elements.bottomTextarea.value = '';
      setOutputState(OUTPUT_STATES.EMPTY);
      setStatus('Ready.');
      saveWorkspaceStateNow();
      return;
    }

    setBusy(true);
    setStatus('Processing...');

    try {
      const message = currentMode === MODES.DUMMY_TO_REAL
        ? { type: MESSAGE_TYPES.RESTORE_TEXT, payload: { text: input } }
        : { type: MESSAGE_TYPES.SANITIZE_TEXT, payload: { text: input, options: {} } };
      const response = await sendRuntimeMessage(message);

      if (serial !== processSerial) {
        return;
      }

      if (!isOkResponse(response)) {
        setStatus(getFriendlyError(response));
        return;
      }

      applyProcessingResult(response);
    } catch {
      if (serial === processSerial) {
        setStatus('Sanitas action failed. Try again.');
      }
    } finally {
      if (serial === processSerial) {
        setBusy(false);
      }
    }
  }

  function applyProcessingResult(response) {
    const data = getResponseData(response);

    elements.bottomTextarea.value = data.text || '';

    if (currentMode === MODES.DUMMY_TO_REAL) {
      setOutputState(data.text ? OUTPUT_STATES.RESTORED : OUTPUT_STATES.EMPTY);
      setStatus(`Restored ${Number(data.restoredCount || 0)} placeholder(s).`);
      saveWorkspaceStateNow();
      return;
    }

    setOutputState(data.text ? OUTPUT_STATES.SANITIZED : OUTPUT_STATES.EMPTY);
    setStatus(`Sanitized ${Number(data.replacementCount || 0)} item(s).`);
    saveWorkspaceStateNow();
  }

  async function handlePaste() {
    if (!elements) {
      return;
    }

    try {
      const text = await navigator.clipboard.readText();

      elements.topTextarea.value = text;
      await processCurrentInput();
    } catch {
      setStatus('Clipboard paste failed.');
    }
  }

  async function handleCopy() {
    if (!elements) {
      return;
    }

    const value = elements.bottomTextarea.value;

    if (!value) {
      setStatus('Nothing to copy.');
      return;
    }

    try {
      await copyTextToClipboard(value);
      setStatus('Copied output.');
    } catch {
      setStatus('Clipboard copy failed.');
    }
  }

  async function copyTextToClipboard(value) {
    if (canUseClipboardWriteApi()) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall through to the selection-based copy path below.
      }
    }

    if (copyTextWithSelectionFallback(value)) {
      return;
    }

    throw new Error('Clipboard copy failed.');
  }

  function canUseClipboardWriteApi() {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      return false;
    }

    const policy = document.permissionsPolicy || document.featurePolicy;

    if (policy && typeof policy.allowsFeature === 'function') {
      try {
        return policy.allowsFeature('clipboard-write');
      } catch {
        return true;
      }
    }

    return true;
  }

  function copyTextWithSelectionFallback(value) {
    const textarea = document.createElement('textarea');
    const activeElement = document.activeElement;

    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    document.body.append(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      textarea.remove();

      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }
    }

    return copied;
  }

  async function handleClearSession() {
    if (!elements) {
      return;
    }

    showClearSessionModal();
  }

  function showClearSessionModal() {
    if (!elements || !elements.clearModal) {
      return;
    }

    elements.clearModal.hidden = false;
    elements.clearModalCancelButton.focus();
  }

  function hideClearSessionModal() {
    if (!elements || !elements.clearModal) {
      return;
    }

    elements.clearModal.hidden = true;
  }

  function cancelClearSession() {
    hideClearSessionModal();
    setStatus('Clear session cancelled.');
  }

  async function confirmClearSession() {
    hideClearSessionModal();

    setBusy(true);

    try {
      const response = await sendRuntimeMessage({ type: MESSAGE_TYPES.CLEAR_SESSION });

      if (!isOkResponse(response)) {
        setStatus(getFriendlyError(response));
        return;
      }

      ++processSerial;
      elements.topTextarea.value = '';
      elements.bottomTextarea.value = '';
      setOutputState(OUTPUT_STATES.EMPTY);
      renderDsnSummary(getResponseData(response).dsnSummary);
      clearDsnValidation();
      setStatus('Session cleared.');
    } catch {
      setStatus('Sanitas action failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleClearModalKeydown(event) {
    if (!elements || elements.clearModal.hidden) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelClearSession();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = [elements.clearModalCancelButton, elements.clearModalConfirmButton];
    const currentIndex = focusable.indexOf(host.shadowRoot.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);

    event.preventDefault();
    focusable[nextIndex].focus();
  }

  function setMode(mode, options = {}) {
    const nextMode = Object.values(MODES).includes(mode) ? mode : MODES.REAL_TO_DUMMY;

    currentMode = nextMode;

    if (host) {
      host.setAttribute('data-sanitas-mode', nextMode);
    }

    if (elements) {
      for (const button of elements.modeButtons) {
        button.setAttribute('aria-checked', button.dataset.sanitasModeOption === nextMode ? 'true' : 'false');
      }
    }

    if (options.save) {
      saveSettingsPatch({ sanitasMode: nextMode });
    }

    if (options.process && elements && elements.topTextarea.value) {
      processCurrentInput();
    } else if (options.save) {
      saveWorkspaceStateNow();
    }
  }

  function setCollapsedState(isCollapsed, options = {}) {
    const collapsed = isCollapsed === true;

    currentSettings = Object.assign({}, currentSettings, {
      sanitasCollapsed: collapsed
    });

    if (host) {
      host.setAttribute('data-sanitas-collapsed', collapsed ? 'true' : 'false');
    }

    if (elements) {
      elements.window.hidden = collapsed;
      elements.sideTab.hidden = !collapsed;
      applySideTabPosition(currentSettings);
    }

    if (options.save) {
      saveSettingsPatch({ sanitasCollapsed: collapsed });
    }
  }

  function applyPanelPreferences(settings) {
    const safeSettings = normalizePanelSettings(settings);

    currentSettings = safeSettings;
    currentMode = safeSettings.sanitasMode;

    if (!host) {
      return;
    }

    host.setAttribute('data-sanitas-theme', safeSettings.theme);
    setMode(safeSettings.sanitasMode, { save: false, process: false });
    applyWindowGeometry(safeSettings);
    setCollapsedState(safeSettings.sanitasCollapsed, { save: false });
  }

  function applyWindowGeometry(settings) {
    if (!elements) {
      return;
    }

    const rect = getSafeWindowRect(settings);

    elements.window.style.left = `${rect.x}px`;
    elements.window.style.top = `${rect.y}px`;
    elements.window.style.width = `${rect.width}px`;
    elements.window.style.height = `${rect.height}px`;
    applySideTabPosition(settings);
  }

  function applySideTabPosition(settings) {
    if (!elements || !elements.sideTab) {
      return;
    }

    const top = Number.isFinite(Number(settings.sanitasSideTabY))
      ? Number(settings.sanitasSideTabY)
      : Number.isFinite(Number(settings.sanitasWindowY))
        ? Number(settings.sanitasWindowY)
        : DEFAULT_TOP;
    const safeTop = getSafeSideTabTop(top);

    elements.sideTab.style.top = `${safeTop}px`;
  }

  function getSafeSideTabTop(value) {
    const fallbackHeight = 112;
    const tabHeight = elements && elements.sideTab
      ? (elements.sideTab.getBoundingClientRect().height || fallbackHeight)
      : fallbackHeight;
    const maxTop = Math.max(EDGE_GAP, getViewportHeight() - tabHeight - EDGE_GAP);

    return clampNumber(value, EDGE_GAP, maxTop);
  }

  function startSideTabDrag(event) {
    if (!elements || event.button !== 0) {
      return;
    }

    event.preventDefault();

    const rect = elements.sideTab.getBoundingClientRect();

    sideTabDragState = {
      startY: event.clientY,
      y: rect.top,
      moved: false
    };
    window.addEventListener('mousemove', moveSideTabDrag);
    window.addEventListener('mouseup', endSideTabDrag, { once: true });
  }

  function moveSideTabDrag(event) {
    if (!sideTabDragState || !elements) {
      return;
    }

    const deltaY = event.clientY - sideTabDragState.startY;
    const safeTop = getSafeSideTabTop(sideTabDragState.y + deltaY);

    if (Math.abs(deltaY) > 3) {
      sideTabDragState.moved = true;
    }

    elements.sideTab.style.top = `${safeTop}px`;
  }

  function endSideTabDrag() {
    window.removeEventListener('mousemove', moveSideTabDrag);

    if (!sideTabDragState || !elements) {
      sideTabDragState = null;
      return;
    }

    const wasMoved = sideTabDragState.moved;
    const rect = elements.sideTab.getBoundingClientRect();

    sideTabDragState = null;

    if (wasMoved) {
      suppressSideTabClick = true;
      saveSettingsPatch({
        sanitasSideTabY: Math.round(rect.top)
      });
    }
  }

  function startDrag(event) {
    if (!elements || event.button !== 0 || event.target.closest('button')) {
      return;
    }

    event.preventDefault();

    const rect = elements.window.getBoundingClientRect();

    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag, { once: true });
  }

  function moveDrag(event) {
    if (!dragState || !elements) {
      return;
    }

    const nextX = dragState.x + event.clientX - dragState.startX;
    const nextY = dragState.y + event.clientY - dragState.startY;
    const safe = clampWindowRect({
      x: nextX,
      y: nextY,
      width: dragState.width,
      height: dragState.height
    });

    elements.window.style.left = `${safe.x}px`;
    elements.window.style.top = `${safe.y}px`;
  }

  function endDrag() {
    window.removeEventListener('mousemove', moveDrag);

    if (!dragState || !elements) {
      dragState = null;
      return;
    }

    const rect = elements.window.getBoundingClientRect();

    dragState = null;
    saveSettingsPatch({
      sanitasWindowX: Math.round(rect.left),
      sanitasWindowY: Math.round(rect.top)
    });
  }

  function startResize(event) {
    if (!elements || event.button !== 0) {
      return;
    }

    event.preventDefault();

    const rect = elements.window.getBoundingClientRect();

    resizeState = {
      startX: event.clientX,
      startY: event.clientY,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    window.addEventListener('mousemove', moveResize);
    window.addEventListener('mouseup', endResize, { once: true });
  }

  function moveResize(event) {
    if (!resizeState || !elements) {
      return;
    }

    const safe = clampWindowRect({
      x: resizeState.x,
      y: resizeState.y,
      width: resizeState.width + event.clientX - resizeState.startX,
      height: resizeState.height + event.clientY - resizeState.startY
    });

    elements.window.style.width = `${safe.width}px`;
    elements.window.style.height = `${safe.height}px`;
  }

  function endResize() {
    window.removeEventListener('mousemove', moveResize);

    if (!resizeState || !elements) {
      resizeState = null;
      return;
    }

    const rect = elements.window.getBoundingClientRect();

    resizeState = null;
    saveSettingsPatch({
      sanitasWindowX: Math.round(rect.left),
      sanitasWindowY: Math.round(rect.top),
      sanitasWindowWidth: Math.round(rect.width),
      sanitasWindowHeight: Math.round(rect.height)
    });
  }

  function getSafeWindowRect(settings) {
    const viewportWidth = getViewportWidth();
    const viewportHeight = getViewportHeight();
    const maxWidth = Math.min(MAX_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, viewportWidth - EDGE_GAP * 2));
    const maxHeight = Math.min(MAX_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, viewportHeight - EDGE_GAP * 2));
    const width = clampNumber(settings.sanitasWindowWidth, MIN_WINDOW_WIDTH, maxWidth);
    const height = clampNumber(settings.sanitasWindowHeight, MIN_WINDOW_HEIGHT, maxHeight);
    const defaultX = Math.max(EDGE_GAP, viewportWidth - width - 24);
    const defaultY = Math.min(DEFAULT_TOP, Math.max(EDGE_GAP, viewportHeight - height - EDGE_GAP));

    return clampWindowRect({
      x: Number.isFinite(Number(settings.sanitasWindowX)) ? Number(settings.sanitasWindowX) : defaultX,
      y: Number.isFinite(Number(settings.sanitasWindowY)) ? Number(settings.sanitasWindowY) : defaultY,
      width,
      height
    });
  }

  function clampWindowRect(rect) {
    const viewportWidth = getViewportWidth();
    const viewportHeight = getViewportHeight();
    const maxWidth = Math.min(MAX_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, viewportWidth - EDGE_GAP * 2));
    const maxHeight = Math.min(MAX_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, viewportHeight - EDGE_GAP * 2));
    const width = clampNumber(rect.width, MIN_WINDOW_WIDTH, maxWidth);
    const height = clampNumber(rect.height, MIN_WINDOW_HEIGHT, maxHeight);
    const maxX = Math.max(EDGE_GAP, viewportWidth - width - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, viewportHeight - height - EDGE_GAP);

    return {
      x: clampNumber(rect.x, EDGE_GAP, maxX),
      y: clampNumber(rect.y, EDGE_GAP, maxY),
      width,
      height
    };
  }

  function getViewportWidth() {
    return window.innerWidth || document.documentElement.clientWidth || 1024;
  }

  function getViewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight || 768;
  }

  function clampNumber(value, minimum, maximum) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return minimum;
    }

    return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
  }

  function saveSettingsPatch(patch) {
    const nextPatch = Object.assign({}, patch || {});

    settingsSaveChain = settingsSaveChain
      .catch(() => {})
      .then(async () => {
        try {
          const response = await sendRuntimeMessage({
            type: MESSAGE_TYPES.UPDATE_SETTINGS,
            settings: nextPatch
          });

          if (isOkResponse(response)) {
            currentSettings = normalizePanelSettings(getResponseData(response).settings || response.settings || currentSettings);
          }
        } catch {
          // Safe UI preference saves are best-effort and must not expose page data.
        }
      });

    return settingsSaveChain;
  }

  function setStatus(message) {
    if (!elements) {
      return;
    }

    elements.status.textContent = message;
  }

  function setOutputState(nextState) {
    outputState = getSafeOutputState(nextState);

    if (host) {
      host.setAttribute('data-output-state', outputState);
    }
  }

  function getSafeOutputState(value) {
    return Object.values(OUTPUT_STATES).includes(value) ? value : OUTPUT_STATES.EMPTY;
  }

  function setBusy(isBusy) {
    if (!elements) {
      return;
    }

    elements.buttons.forEach((button) => {
      button.disabled = Boolean(isBusy);
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('runtime message failed'));
          return;
        }

        resolve(response);
      });
    });
  }

  function isOkResponse(response) {
    return Boolean(response && response.ok === true);
  }

  function getResponseData(response) {
    return response && response.data && typeof response.data === 'object' ? response.data : {};
  }

  function getFriendlyError(response) {
    const code = response && response.error && response.error.code;

    if (code === 'TEXT_TOO_LARGE') {
      return 'Text is too large for this version.';
    }

    if (code === 'VALIDATION_ERROR') {
      return 'Enter text before processing.';
    }

    return 'Sanitas action failed. Try again.';
  }

  function normalizePanelSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    const theme = ['system', 'light', 'dark'].includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme;
    const parsedPanelWidth = Number(source.panelWidth);
    const panelWidth = Number.isFinite(parsedPanelWidth) && parsedPanelWidth >= 320 && parsedPanelWidth <= 520
      ? Math.round(parsedPanelWidth)
      : DEFAULT_SETTINGS.panelWidth;
    const rawWindowWidth = Object.hasOwn(source, 'sanitasWindowWidth') ? source.sanitasWindowWidth : panelWidth;

    return {
      sanitasPanelEnabled: typeof source.sanitasPanelEnabled === 'boolean'
        ? source.sanitasPanelEnabled
        : DEFAULT_SETTINGS.sanitasPanelEnabled,
      sanitasCollapsed: typeof source.sanitasCollapsed === 'boolean'
        ? source.sanitasCollapsed
        : DEFAULT_SETTINGS.sanitasCollapsed,
      theme,
      panelWidth,
      sanitasWindowX: normalizeCoordinate(source.sanitasWindowX),
      sanitasWindowY: normalizeCoordinate(source.sanitasWindowY),
      sanitasSideTabY: normalizeCoordinate(source.sanitasSideTabY),
      sanitasWindowWidth: normalizeSize(rawWindowWidth, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH, DEFAULT_SETTINGS.sanitasWindowWidth),
      sanitasWindowHeight: normalizeSize(source.sanitasWindowHeight, MIN_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT, DEFAULT_SETTINGS.sanitasWindowHeight),
      sanitasMode: Object.values(MODES).includes(source.sanitasMode) ? source.sanitasMode : DEFAULT_SETTINGS.sanitasMode,
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
        : DEFAULT_SETTINGS.customTermsEnabled
    };
  }

  function normalizeCoordinate(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
      return null;
    }

    return Math.round(parsed);
  }

  function normalizeSize(value, minimum, maximum, fallback) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
  }
})();
