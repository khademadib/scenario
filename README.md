# Scenario

A small task tracker that runs entirely in the browser.

**Live demo:** https://khademadib.github.io/scenario/

I built Scenario to practice working with plain HTML, CSS, and JavaScript without hiding the logic behind a framework. Tasks are saved with `localStorage`, so there is no account or backend.

## What it does

- Add, edit, complete, reopen, and delete scenarios
- Set a priority and due date
- Search and filter the list
- Sort by default order, newest, due date, or priority
- Save data in the browser
- Keyboard shortcuts: `N` for a new scenario and `/` for search
- Responsive layout for desktop and mobile

## Files

```text
index.html   page structure and dialog
styles.css  layout and visual design
app.js      state, storage, filters, sorting, and interactions
```

## Run it locally

```bash
git clone https://github.com/khademadib/scenario.git
cd scenario
```

Then open `index.html` in a browser. There is no build step.

## Notes

Scenario stores its data under `scenario.app.v1` in `localStorage`. Clearing the site's browser data will clear the saved scenarios too.

The `main` branch is deployed to GitHub Pages with GitHub Actions. A small quality workflow also checks the static files on pushes and pull requests.

## Next

Things I may add later:

- [ ] Import/export
- [ ] Recurring scenarios
- [ ] Installable PWA support
