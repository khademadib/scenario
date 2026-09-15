# Scenario

A small local-first task tracker that runs in the browser, works offline, and can optionally sync through a Google account.

**Live demo:** https://khademadib.github.io/scenario/

Scenario is built with plain HTML, CSS, and JavaScript. Guest mode stores scenarios in `localStorage`; v2 adds optional Firebase Authentication and Cloud Firestore sync without making an account mandatory.

## What it does

- Add, edit, complete, reopen, and delete scenarios
- Break larger scenarios into checkable steps
- Track step progress directly inside each scenario
- Set a priority and due date
- Repeat scenarios daily, on weekdays, weekly, or monthly
- Export and import JSON backups
- Install as a PWA and reopen offline after the app shell is cached
- Use Scenario without an account
- Optionally sign in with Google and sync scenarios across devices
- Keep separate guest and signed-in local caches on the same browser
- Resolve normal multi-device edits by keeping the newer `updatedAt` version
- Preserve deletions through cloud tombstones so an older device does not simply restore a deleted scenario

## Files

```text
index.html            page structure and dialogs
styles.css            main layout and visual design
subtasks.css          checklist/step styles
recurrence.css        recurring-scenario styles
data.css              backup/import interface styles
auth.css              account and cloud-sync interface styles
app.js                local app state and interactions
data.js               backup export/import
pwa.js                service-worker registration and install prompt
sw.js                 offline app-shell cache
manifest.webmanifest  install metadata and app icons
firebase-config.js    Firebase web connection metadata
auth.js               Google sign-in and Firestore synchronization
firestore.rules       per-user Firestore access rules
firebase.json         Firebase rules deployment configuration
icons/                 install and home-screen icons
```

## Guest mode and cloud sync

Guest mode remains the default. No account is required.

When someone signs in, Scenario switches to a local cache belonging to that Firebase user and syncs it with `users/{uid}/scenarios` in Cloud Firestore. Guest scenarios are kept separately and can be explicitly imported into the signed-in account. Signing out restores the guest workspace instead of leaving account data visible as guest data.

Scenario still uses `localStorage` while signed in, so the interface remains usable offline. Cloud changes are reconciled when connectivity returns. A Firestore listener receives remote changes; local changes are detected from the local cache and written back to Firestore.

## Firebase setup

To activate cloud sync for a deployment:

1. Create a Firebase project and register a Web app.
2. Copy the Firebase web configuration into `firebase-config.js`.
3. In Firebase Authentication, enable the Google provider.
4. Add the deployment domain to Authentication's authorized domains.
5. Create a Cloud Firestore database.
6. Publish the included `firestore.rules` before allowing real users to sync.

Firebase web config values identify the project but are not passwords. Access control belongs in Firebase Authentication and Firestore Security Rules.

The browser-module imports in `auth.js` are pinned to Firebase JS SDK `12.19.0` so the static GitHub Pages app does not need a bundler.

## Security model

Cloud documents are stored under each Firebase user's UID. `firestore.rules` requires the authenticated UID to match the user path, binds each record to its Firestore document ID, validates the main Scenario record shape, and blocks hard deletes.

Deleted scenarios are represented by small tombstone records rather than immediately deleting the Firestore document. This lets another device learn that the scenario was deleted instead of treating its old local copy as new data.

## PWA and offline use

`manifest.webmanifest` makes Scenario installable on supported browsers. `sw.js` caches the app shell. Scenario data remains local-first, so offline edits continue to work and can sync after reconnecting when a user is signed in.

## v2 validation

Before release, v2 was tested end-to-end on GitHub Pages for Google sign-in, Firestore write/read access, guest import, cross-browser restore, edit propagation, and deletion propagation.
