'use strict';

// Firebase's web config is public connection metadata, not a password.
// Replace the empty values with the config from Firebase Console > Project settings > Your apps.
window.SCENARIO_FIREBASE_CONFIG = Object.freeze({
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
});
