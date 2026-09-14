(() => {
  'use strict';

  const STORAGE_KEY = 'scenario.app.v1';
  const BACKUP_FORMAT = 'scenario-backup';
  const BACKUP_VERSION = 1;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_SCENARIOS = 1000;
  const MAX_SUBTASKS = 12;

  const elements = {
    button: document.querySelector('#data-button'),
    dialog: document.querySelector('#data-dialog'),
    close: document.querySelector('#data-dialog-close'),
    home: document.querySelector('#data-home'),
    exportButton: document.querySelector('#export-data-button'),
    importButton: document.querySelector('#import-data-button'),
    importInput: document.querySelector('#import-data-input'),
    review: document.querySelector('#import-review'),
    summary: document.querySelector('#import-summary'),
    reviewCancel: document.querySelector('#import-review-cancel'),
    replaceButton: document.querySelector('#import-replace-button'),
    mergeButton: document.querySelector('#import-merge-button'),
    toast: document.querySelector('#toast'),
    liveRegion: document.querySelector('#live-region')
  };

  let pendingImport = null;
  let toastTimer = null;

  bindEvents();

  function bindEvents() {
    elements.button.addEventListener('click', openDialog);
    elements.close.addEventListener('click', closeDialog);
    elements.exportButton.addEventListener('click', exportBackup);
    elements.importButton.addEventListener('click', () => elements.importInput.click());
    elements.importInput.addEventListener('change', handleImportFile);
    elements.reviewCancel.addEventListener('click', resetImportReview);
    elements.replaceButton.addEventListener('click', () => applyImport('replace'));
    elements.mergeButton.addEventListener('click', () => applyImport('merge'));

    elements.dialog.addEventListener('click', event => {
      if (event.target === elements.dialog) closeDialog();
    });

    elements.dialog.addEventListener('close', resetDialog);

    document.addEventListener('keydown', event => {
      if (!elements.dialog.open) return;
      if (event.key === '/' || event.key.toLowerCase() === 'n') {
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function openDialog() {
    resetDialog();
    elements.dialog.showModal();
  }

  function closeDialog() {
    if (elements.dialog.open) elements.dialog.close();
  }

  function resetDialog() {
    pendingImport = null;
    elements.home.hidden = false;
    elements.review.hidden = true;
    elements.summary.textContent = '';
    elements.importInput.value = '';
  }

  function resetImportReview() {
    resetDialog();
    elements.importButton.focus();
  }

  function exportBackup() {
    try {
      const scenarios = readCurrentScenarios();
      const backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        scenarios
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `scenario-backup-${todayISO()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      showToast('Backup exported');
      announce(`Exported ${scenarios.length} scenarios.`);
    } catch (error) {
      console.warn('Could not export Scenario backup.', error);
      showToast('Could not export');
      announce('Could not export the Scenario backup.');
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      showToast('Backup file is too large');
      announce('Could not import backup. The file is too large.');
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const scenarios = parseBackup(parsed);

      pendingImport = scenarios;
      elements.home.hidden = true;
      elements.review.hidden = false;
      elements.summary.textContent = `This backup contains ${scenarios.length} ${scenarios.length === 1 ? 'scenario' : 'scenarios'}.`;
      elements.mergeButton.focus();
    } catch (error) {
      console.warn('Could not import Scenario backup.', error);
      showToast('Invalid backup file');
      announce('Could not import backup. The file is not a valid Scenario backup.');
    }
  }

  function parseBackup(value) {
    let rawScenarios;

    if (Array.isArray(value)) {
      rawScenarios = value;
    } else if (
      value &&
      typeof value === 'object' &&
      value.format === BACKUP_FORMAT &&
      value.version === BACKUP_VERSION &&
      Array.isArray(value.scenarios)
    ) {
      rawScenarios = value.scenarios;
    } else {
      throw new Error('Unsupported backup format');
    }

    if (rawScenarios.length > MAX_SCENARIOS) {
      throw new Error('Backup contains too many scenarios');
    }

    const normalized = rawScenarios.map(normalizeScenario);
    if (normalized.some(scenario => !scenario)) {
      throw new Error('Backup contains invalid scenarios');
    }

    return deduplicateScenarios(normalized);
  }

  function applyImport(mode) {
    if (!pendingImport) return;

    try {
      const current = readCurrentScenarios();
      const next = mode === 'replace'
        ? pendingImport.map(cloneScenario)
        : mergeScenarioLists(current, pendingImport);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      announce(mode === 'replace' ? 'Backup restored.' : 'Backup merged.');
      closeDialog();
      window.location.reload();
    } catch (error) {
      console.warn('Could not save imported Scenario data.', error);
      showToast('Could not import');
      announce('Could not save the imported Scenario data.');
    }
  }

  function readCurrentScenarios() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeScenario)
      .filter(Boolean)
      .slice(0, MAX_SCENARIOS);
  }

  function mergeScenarioLists(current, incoming) {
    const merged = current.map(cloneScenario);
    const indexById = new Map(merged.map((scenario, index) => [scenario.id, index]));

    incoming.forEach(source => {
      const scenario = cloneScenario(source);
      const index = indexById.get(scenario.id);

      if (index === undefined) {
        indexById.set(scenario.id, merged.length);
        merged.push(scenario);
        return;
      }

      if (scenario.updatedAt >= merged[index].updatedAt) {
        merged[index] = scenario;
      }
    });

    return merged.slice(0, MAX_SCENARIOS);
  }

  function deduplicateScenarios(scenarios) {
    const unique = new Map();

    scenarios.forEach(scenario => {
      const existing = unique.get(scenario.id);
      if (!existing || scenario.updatedAt >= existing.updatedAt) {
        unique.set(scenario.id, scenario);
      }
    });

    return [...unique.values()];
  }

  function normalizeScenario(value) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string') return null;

    const title = value.title.trim().slice(0, 90);
    if (!title) return null;

    return {
      id: typeof value.id === 'string' && value.id ? value.id : createId(),
      title,
      notes: typeof value.notes === 'string' ? value.notes.slice(0, 320) : '',
      priority: ['low', 'medium', 'high'].includes(value.priority) ? value.priority : 'medium',
      due: /^\d{4}-\d{2}-\d{2}$/.test(value.due || '') ? value.due : '',
      subtasks: normalizeSubtasks(value.subtasks),
      completed: Boolean(value.completed),
      createdAt: Number(value.createdAt) || Date.now(),
      updatedAt: Number(value.updatedAt) || Date.now()
    };
  }

  function normalizeSubtasks(value) {
    if (!Array.isArray(value)) return [];

    return value
      .filter(subtask => subtask && typeof subtask === 'object' && typeof subtask.text === 'string')
      .map(subtask => ({
        id: typeof subtask.id === 'string' && subtask.id ? subtask.id : createId(),
        text: subtask.text.trim().slice(0, 100),
        completed: Boolean(subtask.completed)
      }))
      .filter(subtask => subtask.text)
      .slice(0, MAX_SUBTASKS);
  }

  function cloneScenario(scenario) {
    return {
      ...scenario,
      subtasks: scenario.subtasks.map(subtask => ({ ...subtask }))
    };
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 1800);
  }

  function announce(message) {
    elements.liveRegion.textContent = '';
    requestAnimationFrame(() => {
      elements.liveRegion.textContent = message;
    });
  }

  function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function todayISO() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
})();
