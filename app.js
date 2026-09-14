(() => {
  'use strict';

  const STORAGE_KEY = 'scenario.app.v1';
  const MAX_SUBTASKS = 12;
  const REPEAT_OPTIONS = ['never', 'daily', 'weekdays', 'weekly', 'monthly'];
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const LEGACY_STARTERS = [
    {
      title: 'Define today’s main objective',
      notes: 'Choose one outcome that would make today feel meaningfully complete.'
    },
    {
      title: 'Turn one idea into something visible',
      notes: 'A sketch, a commit, a page, a draft — something concrete.'
    },
    {
      title: 'Review the archive',
      notes: 'Keep what matters. Remove what does not.'
    }
  ];

  const elements = {
    list: document.querySelector('#scenario-list'),
    template: document.querySelector('#scenario-card-template'),
    emptyState: document.querySelector('#empty-state'),
    emptyCopy: document.querySelector('#empty-state-copy'),
    resultCount: document.querySelector('#result-count'),
    activeCount: document.querySelector('#active-count'),
    completedCount: document.querySelector('#completed-count'),
    progressValue: document.querySelector('#progress-value'),
    progressBar: document.querySelector('#progress-bar'),
    todayLabel: document.querySelector('#today-label'),
    search: document.querySelector('#scenario-search'),
    sort: document.querySelector('#scenario-sort'),
    filters: [...document.querySelectorAll('[data-filter]')],
    newButtons: [document.querySelector('#new-scenario-button'), document.querySelector('#empty-new-button')],
    dialog: document.querySelector('#scenario-dialog'),
    form: document.querySelector('#scenario-form'),
    dialogTitle: document.querySelector('#dialog-title'),
    dialogClose: document.querySelector('#dialog-close'),
    dialogCancel: document.querySelector('#dialog-cancel'),
    deleteButton: document.querySelector('#delete-scenario-button'),
    title: document.querySelector('#scenario-title'),
    titleError: document.querySelector('#title-error'),
    notes: document.querySelector('#scenario-notes'),
    notesCount: document.querySelector('#notes-count'),
    priority: document.querySelector('#scenario-priority'),
    due: document.querySelector('#scenario-due'),
    repeat: document.querySelector('#scenario-repeat'),
    repeatError: document.querySelector('#repeat-error'),
    addSubtaskButton: document.querySelector('#add-subtask-button'),
    subtaskEditorList: document.querySelector('#subtask-editor-list'),
    subtaskEditorTemplate: document.querySelector('#subtask-editor-row-template'),
    toast: document.querySelector('#toast'),
    liveRegion: document.querySelector('#live-region')
  };

  const state = {
    scenarios: loadScenarios(),
    filter: 'all',
    search: '',
    sort: 'smart',
    editingId: null
  };

  let editorSubtasks = [];
  let toastTimer = null;

  initialize();

  function initialize() {
    elements.todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(new Date());

    bindEvents();
    render();
  }

  function bindEvents() {
    elements.newButtons.forEach(button => button?.addEventListener('click', () => openEditor()));

    elements.search.addEventListener('input', event => {
      state.search = event.target.value.trim().toLowerCase();
      renderList();
    });

    elements.sort.addEventListener('change', event => {
      state.sort = event.target.value;
      renderList();
    });

    elements.filters.forEach(button => {
      button.addEventListener('click', () => setFilter(button.dataset.filter));
    });

    elements.form.addEventListener('submit', handleSubmit);
    elements.dialogClose.addEventListener('click', closeEditor);
    elements.dialogCancel.addEventListener('click', closeEditor);
    elements.deleteButton.addEventListener('click', deleteEditingScenario);
    elements.notes.addEventListener('input', updateNotesCount);
    elements.addSubtaskButton.addEventListener('click', () => addEditorSubtask());
    elements.due.addEventListener('change', clearRepeatError);
    elements.repeat.addEventListener('change', clearRepeatError);

    elements.dialog.addEventListener('click', event => {
      if (event.target === elements.dialog) closeEditor();
    });

    elements.dialog.addEventListener('close', resetForm);
    document.addEventListener('keydown', handleKeyboardShortcuts);
  }

  function handleKeyboardShortcuts(event) {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable;

    if (event.key === '/' && !isTyping && !elements.dialog.open) {
      event.preventDefault();
      elements.search.focus();
      return;
    }

    if (
      event.key.toLowerCase() === 'n' &&
      !isTyping &&
      !elements.dialog.open &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      openEditor();
    }
  }

  function setFilter(filter) {
    state.filter = filter;

    elements.filters.forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    renderList();
  }

  function render() {
    renderMetrics();
    renderList();
  }

  function renderMetrics() {
    const active = state.scenarios.filter(scenario => !scenario.completed).length;
    const completed = state.scenarios.length - active;
    const progress = state.scenarios.length
      ? Math.round((completed / state.scenarios.length) * 100)
      : 0;

    elements.activeCount.textContent = String(active);
    elements.completedCount.textContent = String(completed);
    elements.progressValue.textContent = `${progress}%`;
    elements.progressBar.style.width = `${progress}%`;
  }

  function renderList() {
    const scenarios = getVisibleScenarios();
    elements.list.replaceChildren();

    scenarios.forEach(scenario => {
      elements.list.append(createScenarioCard(scenario));
    });

    const count = scenarios.length;
    elements.resultCount.textContent = `${count} ${count === 1 ? 'scenario' : 'scenarios'}`;
    elements.emptyState.hidden = count > 0;
    elements.emptyCopy.textContent = getEmptyMessage();
  }

  function createScenarioCard(scenario) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector('.scenario-card');
    const toggle = fragment.querySelector('.complete-toggle');
    const priority = fragment.querySelector('.priority-pill');
    const due = fragment.querySelector('.due-label');
    const repeat = fragment.querySelector('.repeat-label');
    const title = fragment.querySelector('.scenario-title');
    const notes = fragment.querySelector('.scenario-notes');
    const edit = fragment.querySelector('.edit-button');
    const subtaskBox = fragment.querySelector('.scenario-subtasks');
    const subtaskCount = fragment.querySelector('.subtask-count');
    const subtaskProgress = fragment.querySelector('.subtask-progress-track i');
    const subtaskList = fragment.querySelector('.subtask-list');

    card.dataset.id = scenario.id;
    card.classList.toggle('is-complete', scenario.completed);

    priority.textContent = scenario.priority;
    priority.dataset.priority = scenario.priority;
    title.textContent = scenario.title;
    notes.textContent = scenario.notes || '';

    const duePresentation = formatDueDate(scenario.due);
    due.textContent = duePresentation.label;
    due.classList.toggle('is-overdue', duePresentation.overdue && !scenario.completed);
    due.hidden = !duePresentation.label;

    repeat.textContent = formatRepeatLabel(scenario.repeat);
    repeat.hidden = scenario.repeat === 'never';

    renderCardSubtasks(scenario, subtaskBox, subtaskCount, subtaskProgress, subtaskList);

    toggle.setAttribute(
      'aria-label',
      scenario.completed
        ? `Mark “${scenario.title}” active`
        : `Mark “${scenario.title}” complete`
    );

    toggle.addEventListener('click', () => toggleScenario(scenario.id));
    edit.addEventListener('click', () => openEditor(scenario.id));

    return fragment;
  }

  function renderCardSubtasks(scenario, box, countLabel, progressBar, list) {
    const subtasks = scenario.subtasks || [];
    if (!subtasks.length) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    const completed = subtasks.filter(subtask => subtask.completed).length;
    const percent = Math.round((completed / subtasks.length) * 100);

    countLabel.textContent = `${completed}/${subtasks.length} steps`;
    progressBar.style.width = `${percent}%`;
    list.replaceChildren();

    subtasks.forEach(subtask => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'subtask-item';
      button.classList.toggle('is-complete', subtask.completed);
      button.setAttribute(
        'aria-label',
        subtask.completed
          ? `Mark “${subtask.text}” incomplete`
          : `Mark “${subtask.text}” complete`
      );

      const check = document.createElement('span');
      check.className = 'subtask-check';
      check.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'subtask-text';
      text.textContent = subtask.text;

      button.append(check, text);
      button.addEventListener('click', () => toggleSubtask(scenario.id, subtask.id));
      list.append(button);
    });
  }

  function getVisibleScenarios() {
    const today = todayISO();

    const filtered = state.scenarios.filter(scenario => {
      const subtaskText = scenario.subtasks.map(subtask => subtask.text).join(' ');
      const text = `${scenario.title} ${scenario.notes} ${subtaskText}`.toLowerCase();
      if (state.search && !text.includes(state.search)) return false;

      if (state.filter === 'active') return !scenario.completed;
      if (state.filter === 'completed') return scenario.completed;
      if (state.filter === 'today') return !scenario.completed && scenario.due === today;
      return true;
    });

    return filtered.sort((a, b) => {
      if (state.sort === 'newest') return b.createdAt - a.createdAt;
      if (state.sort === 'priority') {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.createdAt - a.createdAt;
      }
      if (state.sort === 'due') {
        return compareDueDates(a, b) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }

      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      return compareDueDates(a, b) ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        b.createdAt - a.createdAt;
    });
  }

  function compareDueDates(a, b) {
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  }

  function getEmptyMessage() {
    if (state.search) return 'No scenarios match your search.';
    if (state.filter === 'completed') return 'No completed scenarios yet.';
    if (state.filter === 'today') return 'Nothing is due today.';
    if (state.filter === 'active') return 'You’re all caught up.';
    return 'Add a scenario to get started.';
  }

  function openEditor(id = null) {
    state.editingId = id;
    elements.titleError.textContent = '';
    elements.repeatError.textContent = '';

    if (id) {
      const scenario = state.scenarios.find(item => item.id === id);
      if (!scenario) return;

      elements.dialogTitle.textContent = 'Edit scenario';
      elements.title.value = scenario.title;
      elements.notes.value = scenario.notes;
      elements.priority.value = scenario.priority;
      elements.due.value = scenario.due;
      elements.repeat.value = scenario.repeat;
      editorSubtasks = scenario.subtasks.map(subtask => ({ ...subtask }));
      elements.deleteButton.hidden = false;
    } else {
      elements.dialogTitle.textContent = 'New scenario';
      elements.form.reset();
      elements.priority.value = 'medium';
      elements.repeat.value = 'never';
      editorSubtasks = [];
      elements.deleteButton.hidden = true;
    }

    renderSubtaskEditor();
    updateNotesCount();
    elements.dialog.showModal();
    requestAnimationFrame(() => elements.title.focus());
  }

  function closeEditor() {
    if (elements.dialog.open) elements.dialog.close();
  }

  function resetForm() {
    state.editingId = null;
    editorSubtasks = [];
    elements.form.reset();
    elements.priority.value = 'medium';
    elements.repeat.value = 'never';
    elements.titleError.textContent = '';
    elements.repeatError.textContent = '';
    elements.notesCount.textContent = '0';
    elements.subtaskEditorList.replaceChildren();
    elements.addSubtaskButton.disabled = false;
    elements.deleteButton.hidden = true;
  }

  function addEditorSubtask(text = '') {
    if (editorSubtasks.length >= MAX_SUBTASKS) {
      showToast(`Up to ${MAX_SUBTASKS} steps`);
      return;
    }

    editorSubtasks.push({
      id: createId(),
      text,
      completed: false
    });

    renderSubtaskEditor();

    requestAnimationFrame(() => {
      const inputs = elements.subtaskEditorList.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    });
  }

  function removeEditorSubtask(id) {
    editorSubtasks = editorSubtasks.filter(subtask => subtask.id !== id);
    renderSubtaskEditor();
  }

  function renderSubtaskEditor() {
    elements.subtaskEditorList.replaceChildren();

    editorSubtasks.forEach(subtask => {
      const fragment = elements.subtaskEditorTemplate.content.cloneNode(true);
      const row = fragment.querySelector('.subtask-editor-row');
      const input = fragment.querySelector('input');
      const remove = fragment.querySelector('.subtask-remove-button');

      row.dataset.id = subtask.id;
      input.value = subtask.text;

      input.addEventListener('input', event => {
        subtask.text = event.target.value;
      });

      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        if (input.value.trim()) addEditorSubtask();
      });

      remove.addEventListener('click', () => removeEditorSubtask(subtask.id));
      elements.subtaskEditorList.append(fragment);
    });

    elements.addSubtaskButton.disabled = editorSubtasks.length >= MAX_SUBTASKS;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const title = elements.title.value.trim();
    const repeat = elements.repeat.value;
    const due = elements.due.value;

    if (!title) {
      elements.titleError.textContent = 'Add a title first.';
      elements.title.focus();
      return;
    }

    if (repeat !== 'never' && !due) {
      elements.repeatError.textContent = 'Add a due date for a repeating scenario.';
      elements.due.focus();
      return;
    }

    elements.titleError.textContent = '';
    elements.repeatError.textContent = '';

    const subtasks = editorSubtasks
      .map(subtask => ({
        id: subtask.id || createId(),
        text: subtask.text.trim(),
        completed: Boolean(subtask.completed)
      }))
      .filter(subtask => subtask.text)
      .slice(0, MAX_SUBTASKS);

    const payload = {
      title,
      notes: elements.notes.value.trim(),
      priority: elements.priority.value,
      due,
      repeat,
      repeatAnchorDay: repeat === 'monthly' ? Number(due.slice(-2)) : null,
      subtasks
    };

    if (state.editingId) {
      const index = state.scenarios.findIndex(scenario => scenario.id === state.editingId);

      if (index !== -1) {
        const current = state.scenarios[index];
        state.scenarios[index] = {
          ...current,
          ...payload,
          seriesId: repeat === 'never' ? current.seriesId : (current.seriesId || current.id),
          updatedAt: Date.now()
        };
        persist();
        announce(`Updated ${title}.`);
        showToast('Saved');
      }
    } else {
      const id = createId();
      state.scenarios.unshift({
        id,
        ...payload,
        seriesId: repeat === 'never' ? '' : id,
        previousOccurrenceId: '',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      persist();
      announce(`Created ${title}.`);
      showToast('Added');
    }

    closeEditor();
    render();
  }

  function deleteEditingScenario() {
    const scenario = state.scenarios.find(item => item.id === state.editingId);
    if (!scenario) return;

    const confirmed = window.confirm(`Delete “${scenario.title}”?`);
    if (!confirmed) return;

    state.scenarios = state.scenarios.filter(item => item.id !== scenario.id);
    persist();
    closeEditor();
    render();
    announce(`Deleted ${scenario.title}.`);
    showToast('Deleted');
  }

  function toggleScenario(id) {
    const scenario = state.scenarios.find(item => item.id === id);
    if (!scenario) return;

    scenario.completed = !scenario.completed;
    scenario.updatedAt = Date.now();

    let nextOccurrence = null;
    if (scenario.completed && scenario.repeat !== 'never') {
      nextOccurrence = ensureNextOccurrence(scenario);
    }

    persist();
    render();

    if (scenario.completed && nextOccurrence) {
      const nextLabel = formatShortDate(nextOccurrence.due);
      announce(`Completed ${scenario.title}. Next occurrence is due ${nextLabel}.`);
      showToast(`Next: ${nextLabel}`);
      return;
    }

    const message = scenario.completed
      ? `Completed ${scenario.title}.`
      : `Reopened ${scenario.title}.`;

    announce(message);
    showToast(scenario.completed ? 'Completed' : 'Reopened');
  }

  function ensureNextOccurrence(scenario) {
    const existing = state.scenarios.find(item => item.previousOccurrenceId === scenario.id);
    if (existing) return existing;

    const nextDue = getNextDueDate(scenario.due, scenario.repeat, scenario.repeatAnchorDay);
    if (!nextDue) return null;

    const now = Date.now();
    const next = {
      id: createId(),
      title: scenario.title,
      notes: scenario.notes,
      priority: scenario.priority,
      due: nextDue,
      repeat: scenario.repeat,
      repeatAnchorDay: scenario.repeatAnchorDay,
      seriesId: scenario.seriesId || scenario.id,
      previousOccurrenceId: scenario.id,
      subtasks: scenario.subtasks.map(subtask => ({
        id: createId(),
        text: subtask.text,
        completed: false
      })),
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    state.scenarios.unshift(next);
    return next;
  }

  function toggleSubtask(scenarioId, subtaskId) {
    const scenario = state.scenarios.find(item => item.id === scenarioId);
    const subtask = scenario?.subtasks.find(item => item.id === subtaskId);
    if (!scenario || !subtask) return;

    subtask.completed = !subtask.completed;
    scenario.updatedAt = Date.now();
    persist();
    renderList();

    announce(
      subtask.completed
        ? `Completed step ${subtask.text}.`
        : `Reopened step ${subtask.text}.`
    );
  }

  function clearRepeatError() {
    elements.repeatError.textContent = '';
  }

  function updateNotesCount() {
    elements.notesCount.textContent = String(elements.notes.value.length);
  }

  function formatDueDate(value) {
    if (!value) return { label: '', overdue: false };

    const today = todayISO();
    if (value === today) return { label: 'Due today', overdue: false };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (value === toISODate(tomorrow)) return { label: 'Due tomorrow', overdue: false };

    const date = parseISODate(value);
    const label = `Due ${new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(date)}`;

    return { label, overdue: value < today };
  }

  function formatRepeatLabel(value) {
    if (value === 'daily') return 'Daily';
    if (value === 'weekdays') return 'Weekdays';
    if (value === 'weekly') return 'Weekly';
    if (value === 'monthly') return 'Monthly';
    return '';
  }

  function formatShortDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(parseISODate(value));
  }

  function getNextDueDate(value, repeat, anchorDay) {
    if (!value || repeat === 'never') return '';

    const date = parseISODate(value);

    if (repeat === 'daily') {
      date.setDate(date.getDate() + 1);
      return toISODate(date);
    }

    if (repeat === 'weekdays') {
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      return toISODate(date);
    }

    if (repeat === 'weekly') {
      date.setDate(date.getDate() + 7);
      return toISODate(date);
    }

    if (repeat === 'monthly') {
      const targetDay = clamp(Number(anchorDay) || date.getDate(), 1, 31);
      const nextMonth = date.getMonth() + 1;
      const lastDay = new Date(date.getFullYear(), nextMonth + 1, 0, 12).getDate();
      const nextDate = new Date(
        date.getFullYear(),
        nextMonth,
        Math.min(targetDay, lastDay),
        12
      );
      return toISODate(nextDate);
    }

    return '';
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scenarios));
    } catch (error) {
      console.warn('Could not save Scenario data.', error);
      showToast('Could not save');
    }
  }

  function loadScenarios() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      const scenarios = parsed.map(normalizeScenario).filter(Boolean);
      const cleaned = scenarios.filter(scenario => !isLegacyStarterScenario(scenario));

      if (cleaned.length !== scenarios.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }

      return cleaned;
    } catch (error) {
      console.warn('Could not read Scenario data.', error);
      return [];
    }
  }

  function isLegacyStarterScenario(scenario) {
    return LEGACY_STARTERS.some(starter =>
      starter.title === scenario.title && starter.notes === scenario.notes
    );
  }

  function normalizeScenario(value) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string') return null;

    const due = /^\d{4}-\d{2}-\d{2}$/.test(value.due || '') ? value.due : '';
    const repeat = due && REPEAT_OPTIONS.includes(value.repeat) ? value.repeat : 'never';

    return {
      id: typeof value.id === 'string' ? value.id : createId(),
      title: value.title.slice(0, 90),
      notes: typeof value.notes === 'string' ? value.notes.slice(0, 320) : '',
      priority: ['low', 'medium', 'high'].includes(value.priority) ? value.priority : 'medium',
      due,
      repeat,
      repeatAnchorDay: repeat === 'monthly'
        ? clamp(Number(value.repeatAnchorDay) || Number(due.slice(-2)), 1, 31)
        : null,
      seriesId: typeof value.seriesId === 'string' ? value.seriesId : '',
      previousOccurrenceId: typeof value.previousOccurrenceId === 'string' ? value.previousOccurrenceId : '',
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
        id: typeof subtask.id === 'string' ? subtask.id : createId(),
        text: subtask.text.trim().slice(0, 100),
        completed: Boolean(subtask.completed)
      }))
      .filter(subtask => subtask.text)
      .slice(0, MAX_SUBTASKS);
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
    return toISODate(new Date());
  }

  function parseISODate(value) {
    return new Date(`${value}T12:00:00`);
  }

  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
