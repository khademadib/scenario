# Scenario

A small task tracker that runs entirely in the browser.

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
- Save everything in the browser
- Keyboard shortcuts: `N` for a new scenario and `/` for search
- Responsive layout for desktop and mobile

## Files

```text
index.html       page structure and dialogs
styles.css       main layout and visual design
subtasks.css     checklist/step styles
recurrence.css   recurring-scenario styles
data.css         backup/import interface styles
data.js          backup export, validation, merge/replace import
app.js           state, storage, filters, sorting, recurrence, steps, and interactions
```

## Run it locally

```bash
git clone https://github.com/khademadib/scenario.git
cd scenario
```

Then open `index.html` in a browser. There is no build step.

## Recurring scenarios

A repeating scenario needs a due date. Repeat can be set to daily, weekdays, weekly, or monthly.

When a repeating scenario is completed, Scenario keeps the completed occurrence and creates the next one automatically. The next occurrence keeps the title, notes, priority, repeat schedule, and step text, while each step starts unchecked again.

Monthly scenarios remember the intended day of the month and use the last valid day when a month is shorter. For example, a scenario anchored to the 31st can fall on February 28/29 and return to the 31st in a later month.

## Data and backups

Scenario stores its live data under `scenario.app.v1` in `localStorage`. Existing v1 scenarios are still supported; older scenarios simply load with repeat set to `Never`.

The Data dialog can export a versioned JSON backup. Importing a backup lets you either merge it with the current list or replace the current list. Imported data is normalized before it is saved, including repeat metadata, and oversized or unsupported backup files are rejected.

Clearing the site's browser data will still clear the live local copy, so keeping an exported backup is useful until cloud sync exists.

The `main` branch is deployed to GitHub Pages with GitHub Actions. A small quality workflow also checks the JavaScript and parses the HTML on pushes and pull requests.

## Next

Things I may add later:

- [ ] Installable PWA support
- [ ] Optional Google sign-in and cloud sync
- [ ] More recurrence options if they become useful
