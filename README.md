# Scenario

A minimal, local-first productivity app for turning goals into focused, trackable scenarios.

**Live:** https://khademadib.github.io/scenario/

Scenario is built with plain HTML, CSS, and JavaScript. It does not require an account, a backend, or a build step; your data stays in your browser through `localStorage`.

## Why this project exists

Most task apps become another place to maintain. Scenario keeps the surface intentionally small: decide what matters, give it a priority or due date, and move it to complete when it is done.

## Features

- Create, edit, complete, reopen, and delete scenarios
- Search scenarios instantly
- Filter by all, active, due today, or completed
- Smart, newest, due-date, and priority sorting
- Browser persistence with `localStorage`
- Keyboard shortcuts: `N` for a new scenario and `/` for search
- Responsive layout for desktop and mobile
- Accessible dialog, labels, live status messages, and focus states
- Reduced-motion support
- No framework and no external runtime dependencies

## Stack

`HTML5` · `CSS3` · `JavaScript` · `GitHub Pages`

## Project structure

```text
.
├── index.html      # Semantic app shell and editor dialog
├── styles.css      # Responsive design system and components
├── app.js          # State, persistence, filters, sorting and interactions
└── README.md
```

## Run locally

Clone the repository and open `index.html` in a browser:

```bash
git clone https://github.com/khademadib/scenario.git
cd scenario
```

No build command is required. You can also serve the folder with any static web server.

## Data and privacy

Scenario stores data under the `scenario.app.v1` key in the browser's `localStorage`. It does not send scenario data to a server.

Clearing site data for the app will remove locally saved scenarios.

## Deployment

The `main` branch deploys automatically to GitHub Pages through GitHub Actions. A separate quality workflow checks the static app on changes before the project is considered healthy.

## Status

Version 1 is a complete browser-based prototype. Future iterations may explore import/export, recurring scenarios, and installable PWA support without making the core experience heavier.
