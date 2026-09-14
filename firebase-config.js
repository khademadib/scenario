'use strict';

// Firebase's web config is public connection metadata, not a password.
// Access to Scenario cloud data is enforced by Firebase Authentication and Firestore Security Rules.
window.SCENARIO_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyAgp6auX0tLalDv26U-04AFcD_D87vjCgA',
  authDomain: 'scenario-kdj.firebaseapp.com',
  projectId: 'scenario-kdj',
  storageBucket: 'scenario-kdj.firebasestorage.app',
  messagingSenderId: '679765109375',
  appId: '1:679765109375:web:6d9d57f602931f42036d4a'
});
