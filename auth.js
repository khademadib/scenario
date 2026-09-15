import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const STORAGE_KEY = 'scenario.app.v1';
const GUEST_CACHE_KEY = 'scenario.guest.v1';
const SESSION_UID_KEY = 'scenario.session.uid.v1';
const USER_CACHE_PREFIX = 'scenario.user.cache.v1:';
const SYNC_META_PREFIX = 'scenario.sync.meta.v1:';
const MAX_SCENARIOS = 1000;
const MAX_SUBTASKS = 12;
const LOCAL_POLL_MS = 1200;

const config = window.SCENARIO_FIREBASE_CONFIG || {};
const elements = {
  sidebarStatus: document.querySelector('#account-status'),
  sidebarCopy: document.querySelector('#account-sidebar-copy'),
  openButton: document.querySelector('#account-button'),
  dialog: document.querySelector('#account-dialog'),
  closeButton: document.querySelector('#account-dialog-close'),
  guestView: document.querySelector('#account-guest-view'),
  userView: document.querySelector('#account-user-view'),
  setupView: document.querySelector('#account-setup-view'),
  signInButton: document.querySelector('#google-sign-in-button'),
  signOutButton: document.querySelector('#sign-out-button'),
  importGuestButton: document.querySelector('#import-guest-button'),
  importGuestWrap: document.querySelector('#import-guest-wrap'),
  userInitial: document.querySelector('#account-user-initial'),
  userName: document.querySelector('#account-user-name'),
  userEmail: document.querySelector('#account-user-email'),
  syncState: document.querySelector('#sync-state'),
  syncDetail: document.querySelector('#sync-detail'),
  toast: document.querySelector('#toast'),
  liveRegion: document.querySelector('#live-region')
};

let auth = null;
let db = null;
let currentUser = null;
let unsubscribeCloud = null;
let pollTimer = null;
let cloudCache = new Map();
let localSnapshot = '';
let syncRunning = false;
let syncQueued = false;
let toastTimer = null;
let suppressReload = false;

initialize();

async function initialize() {
  bindUi();

  if (!isConfigured(config)) {
    setSetupState();
    return;
  }

  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    await setPersistence(auth, browserLocalPersistence);
    await getRedirectResult(auth).catch(() => null);

    onAuthStateChanged(auth, handleAuthState);
  } catch (error) {
    console.warn('Could not initialize Scenario cloud sync.', error);
    setStatus('error', 'Cloud unavailable');
    setSetupState('Firebase could not initialize. Check the project config.');
  }
}

function bindUi() {
  elements.openButton?.addEventListener('click', () => elements.dialog?.showModal());
  elements.closeButton?.addEventListener('click', closeDialog);
  elements.dialog?.addEventListener('click', event => {
    if (event.target === elements.dialog) closeDialog();
  });

  elements.signInButton?.addEventListener('click', beginGoogleSignIn);
  elements.signOutButton?.addEventListener('click', handleSignOut);
  elements.importGuestButton?.addEventListener('click', importGuestScenarios);

  window.addEventListener('online', () => {
    if (currentUser) {
      setStatus('syncing', 'Syncing');
      queueSync();
    }
  });

  window.addEventListener('offline', () => {
    if (currentUser) setStatus('offline', 'Offline');
  });
}

function isConfigured(value) {
  return ['apiKey', 'authDomain', 'projectId', 'appId'].every(key =>
    typeof value[key] === 'string' && value[key].trim().length > 0
  );
}

function setSetupState(message = 'Firebase project setup is still required before Google sign-in can go live.') {
  elements.guestView.hidden = true;
  elements.userView.hidden = true;
  elements.setupView.hidden = false;
  const copy = elements.setupView.querySelector('p');
  if (copy) copy.textContent = message;
  elements.sidebarCopy.textContent = 'Guest mode is active. Cloud sync is not configured yet.';
  elements.openButton.textContent = 'Account';
  setStatus('guest', 'Guest');
}

async function handleAuthState(user) {
  stopCloudWatch();
  currentUser = user;

  if (!user) {
    const previousUid = localStorage.getItem(SESSION_UID_KEY);
    if (previousUid) restoreGuestWorkspace();
    else captureGuestWorkspace();

    showGuestUi();
    return;
  }

  const activeUid = localStorage.getItem(SESSION_UID_KEY);
  if (activeUid !== user.uid) {
    captureGuestWorkspace();
    switchToUserWorkspace(user.uid);
    localStorage.setItem(SESSION_UID_KEY, user.uid);
    window.location.reload();
    return;
  }

  showUserUi(user);
  startCloudWatch(user);
}

function showGuestUi() {
  elements.setupView.hidden = true;
  elements.userView.hidden = true;
  elements.guestView.hidden = false;
  elements.sidebarCopy.textContent = 'Stored on this device. Sign in only if you want cloud sync.';
  elements.openButton.textContent = 'Sign in';
  setStatus('guest', 'Guest');
}

function showUserUi(user) {
  elements.setupView.hidden = true;
  elements.guestView.hidden = true;
  elements.userView.hidden = false;

  const label = user.displayName || 'Scenario user';
  elements.userName.textContent = label;
  elements.userEmail.textContent = user.email || '';
  elements.userInitial.textContent = label.trim().charAt(0).toUpperCase() || 'S';
  elements.sidebarCopy.textContent = 'Your scenarios are cached locally and synced to your account.';
  elements.openButton.textContent = 'Account';

  const guestCount = readScenarioArray(localStorage.getItem(GUEST_CACHE_KEY)).length;
  elements.importGuestWrap.hidden = guestCount === 0;
  elements.importGuestButton.textContent = guestCount === 1
    ? 'Import 1 guest scenario'
    : `Import ${guestCount} guest scenarios`;

  setStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? 'Syncing' : 'Offline');
}

async function beginGoogleSignIn() {
  if (!auth) return;

  captureGuestWorkspace();
  elements.signInButton.disabled = true;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }

    if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
      console.warn('Google sign-in failed.', error);
      showToast('Sign-in failed');
    }
  } finally {
    elements.signInButton.disabled = false;
  }
}

async function handleSignOut() {
  if (!auth || !currentUser) return;

  saveUserWorkspace(currentUser.uid);
  localStorage.removeItem(SESSION_UID_KEY);
  restoreGuestWorkspace();

  try {
    await signOut(auth);
  } finally {
    window.location.reload();
  }
}

function captureGuestWorkspace() {
  const current = localStorage.getItem(STORAGE_KEY) || '[]';
  const sessionUid = localStorage.getItem(SESSION_UID_KEY);
  if (!sessionUid) localStorage.setItem(GUEST_CACHE_KEY, current);
}

function restoreGuestWorkspace() {
  const guest = localStorage.getItem(GUEST_CACHE_KEY) || '[]';
  localStorage.setItem(STORAGE_KEY, guest);
  localStorage.removeItem(SESSION_UID_KEY);
}

function switchToUserWorkspace(uid) {
  const cached = localStorage.getItem(userCacheKey(uid)) || '[]';
  localStorage.setItem(STORAGE_KEY, cached);
}

function saveUserWorkspace(uid) {
  const current = localStorage.getItem(STORAGE_KEY) || '[]';
  localStorage.setItem(userCacheKey(uid), current);
}

function startCloudWatch(user) {
  const ref = collection(db, 'users', user.uid, 'scenarios');
  localSnapshot = localStorage.getItem(STORAGE_KEY) || '[]';
  saveUserWorkspace(user.uid);

  unsubscribeCloud = onSnapshot(ref, snapshot => {
    cloudCache = new Map();
    snapshot.forEach(item => {
      const record = item.data();
      if (record && typeof record.scenarioId === 'string') {
        cloudCache.set(record.scenarioId, record);
      }
    });

    queueSync();
  }, error => {
    console.warn('Scenario cloud listener failed.', error);
    setStatus(navigator.onLine ? 'error' : 'offline', navigator.onLine ? 'Sync error' : 'Offline');
  });

  pollTimer = window.setInterval(() => {
    const next = localStorage.getItem(STORAGE_KEY) || '[]';
    if (next === localSnapshot) return;

    localSnapshot = next;
    saveUserWorkspace(user.uid);
    queueSync();
  }, LOCAL_POLL_MS);
}

function stopCloudWatch() {
  if (unsubscribeCloud) unsubscribeCloud();
  unsubscribeCloud = null;
  cloudCache = new Map();

  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = null;
}

function queueSync() {
  if (!currentUser || !navigator.onLine) {
    if (currentUser) setStatus('offline', 'Offline');
    return;
  }

  if (syncRunning) {
    syncQueued = true;
    return;
  }

  window.clearTimeout(queueSync.timer);
  queueSync.timer = window.setTimeout(syncNow, 180);
}

async function syncNow() {
  if (!currentUser || !navigator.onLine || syncRunning) return;

  syncRunning = true;
  syncQueued = false;
  setStatus('syncing', 'Syncing');

  try {
    const local = readScenarioArray(localStorage.getItem(STORAGE_KEY));
    const localMap = new Map(local.map(item => [item.id, item]));
    const meta = readSyncMeta(currentUser.uid);
    const operations = [];
    const merged = new Map();
    const ids = new Set([
      ...localMap.keys(),
      ...cloudCache.keys(),
      ...Object.keys(meta)
    ]);

    const now = Date.now();

    ids.forEach(id => {
      const localScenario = localMap.get(id) || null;
      const cloudRecord = cloudCache.get(id) || null;
      const previous = meta[id] || null;

      if (!localScenario && !cloudRecord) return;

      if (!localScenario && cloudRecord) {
        if (cloudRecord.deleted) {
          meta[id] = { deleted: true, updatedAt: toTime(cloudRecord.updatedAt) };
          return;
        }

        if (previous && previous.deleted === false) {
          const tombstone = makeTombstone(currentUser.uid, id, now);
          operations.push(tombstone);
          meta[id] = { deleted: true, updatedAt: now };
          return;
        }

        const pulled = sanitizeScenario(cloudRecord.scenario);
        if (pulled) {
          merged.set(id, pulled);
          meta[id] = { deleted: false, updatedAt: pulled.updatedAt };
        }
        return;
      }

      if (localScenario && !cloudRecord) {
        merged.set(id, localScenario);
        operations.push(makeLiveRecord(currentUser.uid, localScenario));
        meta[id] = { deleted: false, updatedAt: localScenario.updatedAt };
        return;
      }

      const cloudTime = toTime(cloudRecord.updatedAt);
      const localTime = localScenario.updatedAt;

      if (cloudRecord.deleted) {
        if (localTime > cloudTime) {
          merged.set(id, localScenario);
          operations.push(makeLiveRecord(currentUser.uid, localScenario));
          meta[id] = { deleted: false, updatedAt: localTime };
        } else {
          meta[id] = { deleted: true, updatedAt: cloudTime };
        }
        return;
      }

      const cloudScenario = sanitizeScenario(cloudRecord.scenario);
      if (!cloudScenario) {
        merged.set(id, localScenario);
        operations.push(makeLiveRecord(currentUser.uid, localScenario));
        meta[id] = { deleted: false, updatedAt: localTime };
        return;
      }

      if (cloudTime > localTime) {
        merged.set(id, cloudScenario);
        meta[id] = { deleted: false, updatedAt: cloudTime };
      } else {
        merged.set(id, localScenario);
        meta[id] = { deleted: false, updatedAt: localTime };
        if (localTime > cloudTime) operations.push(makeLiveRecord(currentUser.uid, localScenario));
      }
    });

    await commitOperations(currentUser.uid, operations);
    writeSyncMeta(currentUser.uid, meta);

    const next = [...merged.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_SCENARIOS);
    const serialized = JSON.stringify(next);
    const currentSerialized = localStorage.getItem(STORAGE_KEY) || '[]';

    if (serialized !== currentSerialized) {
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem(userCacheKey(currentUser.uid), serialized);
      localSnapshot = serialized;

      if (!suppressReload) {
        suppressReload = true;
        showToast('Cloud changes received');
        window.setTimeout(() => window.location.reload(), 280);
        return;
      }
    }

    saveUserWorkspace(currentUser.uid);
    setStatus('synced', 'Synced');
    elements.syncDetail.textContent = `Last synced ${formatTime(new Date())}`;
  } catch (error) {
    console.warn('Scenario sync failed.', error);
    setStatus(navigator.onLine ? 'error' : 'offline', navigator.onLine ? 'Sync error' : 'Offline');
    elements.syncDetail.textContent = 'Your local copy is still available.';
  } finally {
    syncRunning = false;
    if (syncQueued) queueSync();
  }
}

async function commitOperations(uid, records) {
  if (!records.length) return;

  for (let start = 0; start < records.length; start += 400) {
    const batch = writeBatch(db);
    records.slice(start, start + 400).forEach(record => {
      const ref = doc(db, 'users', uid, 'scenarios', safeDocumentId(record.scenarioId));
      batch.set(ref, record);
    });
    await batch.commit();
  }
}

async function importGuestScenarios() {
  if (!currentUser) return;

  const guest = readScenarioArray(localStorage.getItem(GUEST_CACHE_KEY));
  if (!guest.length) return;

  const current = readScenarioArray(localStorage.getItem(STORAGE_KEY));
  const merged = new Map(current.map(item => [item.id, item]));

  guest.forEach(item => {
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) merged.set(item.id, item);
  });

  const serialized = JSON.stringify([...merged.values()].slice(0, MAX_SCENARIOS));
  localStorage.setItem(STORAGE_KEY, serialized);
  localStorage.setItem(userCacheKey(currentUser.uid), serialized);
  localStorage.setItem(GUEST_CACHE_KEY, '[]');
  localSnapshot = serialized;
  elements.importGuestWrap.hidden = true;
  showToast('Guest scenarios added');
  queueSync();
  window.setTimeout(() => window.location.reload(), 220);
}

function makeLiveRecord(uid, scenario) {
  return {
    ownerId: uid,
    scenarioId: scenario.id,
    deleted: false,
    updatedAt: scenario.updatedAt,
    scenario
  };
}

function makeTombstone(uid, id, updatedAt) {
  return {
    ownerId: uid,
    scenarioId: id,
    deleted: true,
    updatedAt,
    scenario: null
  };
}

function readScenarioArray(serialized) {
  try {
    const parsed = JSON.parse(serialized || '[]');
    if (!Array.isArray(parsed)) return [];

    const unique = new Map();
    parsed.slice(0, MAX_SCENARIOS).forEach(value => {
      const scenario = sanitizeScenario(value);
      if (!scenario) return;
      const existing = unique.get(scenario.id);
      if (!existing || scenario.updatedAt >= existing.updatedAt) unique.set(scenario.id, scenario);
    });

    return [...unique.values()];
  } catch {
    return [];
  }
}

function sanitizeScenario(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  if (typeof value.title !== 'string' || !value.title.trim()) return null;

  const due = /^\d{4}-\d{2}-\d{2}$/.test(value.due || '') ? value.due : '';
  const repeatOptions = ['never', 'daily', 'weekdays', 'weekly', 'monthly'];
  const repeat = due && repeatOptions.includes(value.repeat) ? value.repeat : 'never';

  return {
    id: value.id.slice(0, 220),
    title: value.title.trim().slice(0, 90),
    notes: typeof value.notes === 'string' ? value.notes.slice(0, 320) : '',
    priority: ['low', 'medium', 'high'].includes(value.priority) ? value.priority : 'medium',
    due,
    repeat,
    repeatAnchorDay: repeat === 'monthly'
      ? clamp(Number(value.repeatAnchorDay) || Number(due.slice(-2)), 1, 31)
      : null,
    seriesId: typeof value.seriesId === 'string' ? value.seriesId.slice(0, 220) : '',
    previousOccurrenceId: typeof value.previousOccurrenceId === 'string' ? value.previousOccurrenceId.slice(0, 220) : '',
    subtasks: sanitizeSubtasks(value.subtasks),
    completed: Boolean(value.completed),
    createdAt: positiveTime(value.createdAt),
    updatedAt: positiveTime(value.updatedAt)
  };
}

function sanitizeSubtasks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(item => item && typeof item === 'object' && typeof item.text === 'string')
    .map(item => ({
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 220) : createLocalId(),
      text: item.text.trim().slice(0, 100),
      completed: Boolean(item.completed)
    }))
    .filter(item => item.text)
    .slice(0, MAX_SUBTASKS);
}

function readSyncMeta(uid) {
  try {
    const value = JSON.parse(localStorage.getItem(syncMetaKey(uid)) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeSyncMeta(uid, value) {
  try {
    localStorage.setItem(syncMetaKey(uid), JSON.stringify(value));
  } catch (error) {
    console.warn('Could not save Scenario sync metadata.', error);
  }
}

function setStatus(state, label) {
  elements.sidebarStatus.dataset.state = state;
  elements.sidebarStatus.textContent = label;
  elements.syncState.textContent = label;
}

function showToast(message) {
  if (!elements.toast) return;
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 1800);

  if (elements.liveRegion) {
    elements.liveRegion.textContent = '';
    requestAnimationFrame(() => { elements.liveRegion.textContent = message; });
  }
}

function closeDialog() {
  if (elements.dialog?.open) elements.dialog.close();
}

function userCacheKey(uid) {
  return `${USER_CACHE_PREFIX}${config.projectId}:${uid}`;
}

function syncMetaKey(uid) {
  return `${SYNC_META_PREFIX}${config.projectId}:${uid}`;
}

function safeDocumentId(id) {
  return encodeURIComponent(id).slice(0, 900) || createLocalId();
}

function positiveTime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : Date.now();
}

function toTime(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createLocalId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}
