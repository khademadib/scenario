# Scenario

A small task tracker that runs entirely in the browser.

**Live demo:** https://khademadib.github.io/scenario/

I built Scenario to practice working with plain HTML, CSS, and JavaScript without hiding the logic behind a framework. Tasks are saved with `localStorage`, so there is no account or backend.

## What it does

- Add, edit, complete, reopen, and delete scenarios
- Break larger scenarios into checkable steps
- Track step progress directly inside each scenario
- Set a priority and due date
- Search titles, notes, and steps
- Filter the list and sort by default order, newest, due date, or priority
- Export a JSON backup of all local Scenario data
- Import a backup by merging it with the current list or replacing the current list
- Save everything in the browser
- Keyboard shortcuts: `N` for a new scenario and `/` for search
- Responsive layout for desktop and mobile

## Files

```text
index.html     page structure and dialogs
styles.css     main layout and visual design
subtasks.css   checklist/step styles
data.css       backup/import interface styles
data.js        backup export, validation, merge/replace import
app.js         state, storage, filters, sorting, steps, and interactions
```

## Run it locally

```bash
git clone https://github.com/khademadib/scenario.git
cd scenario
```

Then open `index.html` in a browser. There is no build step.

## Data and backups

Scenario stores its live data under `scenario.app.v1` in `localStorage`. Existing v1 scenarios are still supported; scenarios created before steps were added simply start with an empty step list.

The Data dialog can export a versioned JSON backup. Importing a backup lets you either merge it with the current list or replace the current list. Imported data is normalized before it is saved, and oversized or unsupported backup files are rejected.

Clearing the site's browser data will still clear the live local copy, so keeping an exported backup is useful until cloud sync exists.

The `main` branch is deployed to GitHub Pages with GitHub Actions. A small quality workflow also checks the static files on pushes and pull requests.

## Next

Things I may add later:

- [ ] Recurring scenarios
- [ ] Optional Google sign-in and cloud sync
- [ ] Installable PWA support
