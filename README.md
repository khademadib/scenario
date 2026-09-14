# Scenario

A small local-first task tracker that runs in the browser and can be installed as a web app.

**Live demo:** https://khademadib.github.io/scenario/

I built Scenario to practice working with plain HTML, CSS, and JavaScript without hiding the logic behind a framework. Tasks are saved with `localStorage`, so there is no account or backend.

## What it does

- Add, edit, complete, reopen, and delete scenarios
- Break larger scenarios into checkable steps
- Track step progress directly inside each scenario
- Set a priority and due date
- Repeat scenarios daily, on weekdays, weekly, or monthly
- Create the next occurrence when a repeating scenario is completed
- Reset step completion for each new occurrence
- Search titles, notes, and steps
- Filter the list and sort by default order, newest, due date, or priority
- Export a JSON backup of all local Scenario data
- Import a backup by merging it with the current list or replacing the current list
- Install Scenario as a PWA on supported browsers
- Open the app offline after its files have been cached
- Save everything in the browser
- Keyboard shortcuts: `N` for a new scenario and `/` for search
- Responsive layout for desktop and mobile

## Files

```text
index.html         page structure and dialogs
styles.css         main layout and visual design
subtasks.css       checklist/step styles
recurrence.css     recurring-scenario styles
data.css           backup/import interface styles
data.js            backup export, validation, merge/replace import
app.js             state, storage, filters, sorting, recurrence, steps, and interactions
pwa.js             service-worker registration and optional install prompt
sw.js              offline app-shell cache
manifest.webmanifest  install metadata and app icons
icons/             install and home-screen icons
```

## Run it locally

```bash
git clone https://github.com/khademadib/scenario.git
cd scenario
```

For the basic app, opening `index.html` still works. Service workers require a secure origin, so PWA/offline behavior should be tested through GitHub Pages or a local development server rather than a `file://` URL.

## Recurring scenarios

A repeating scenario needs a due date. Repeat can be set to daily, weekdays, weekly, or monthly.

When a repeating scenario is completed, Scenario keeps the completed occurrence and creates the next one automatically. The next occurrence keeps the title, notes, priority, repeat schedule, and step text, while each step starts unchecked again.

Monthly scenarios remember the intended day of the month and use the last valid day when a month is shorter. For example, a scenario anchored to the 31st can fall on February 28/29 and return to the 31st in a later month.

## Data and backups

Scenario stores its live data under `scenario.app.v1` in `localStorage`. Existing v1 scenarios are still supported; older scenarios simply load with repeat set to `Never`.

The Data dialog can export a versioned JSON backup. Importing a backup lets you either merge it with the current list or replace the current list. Imported data is normalized before it is saved, including repeat metadata, and oversized or unsupported backup files are rejected.

Clearing the site's browser data will still clear the live local copy, so keeping an exported backup is useful until cloud sync exists.

## PWA and offline use

`manifest.webmanifest` makes Scenario installable on supported browsers. `sw.js` caches the app shell after a successful visit, which lets the interface load without a network connection. Scenario data itself remains local in `localStorage`, so offline edits continue to use the same browser data.

The custom **Install** button only appears when the browser exposes its install prompt. Other browsers can still offer installation through their own browser UI.

The `main` branch is deployed to GitHub Pages with GitHub Actions. The quality workflow checks the JavaScript, parses the HTML, and validates the web app manifest on pushes and pull requests.

## Next

Things I may add later:

- [ ] Optional Google sign-in and cloud sync
- [ ] Better sync/conflict handling for multiple devices
- [ ] More recurrence options if they become useful
