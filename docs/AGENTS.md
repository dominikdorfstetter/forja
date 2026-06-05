# docs — Documentation site

Docusaurus site published to `forja-docs.dorfstetter.at`. Markdown content lives
in [`docs/`](docs/) (Getting Started, Architecture, Admin Guide, API, SDK,
Deployment, Developer). Sidebar in `sidebars.ts`; site config in
`docusaurus.config.ts`.

## Commands

```bash
npm install
npm start     # local dev server with hot reload
npm run build # production build — also the link/image checker (see gotcha below)
npm run serve # serve the built site
```

## Gotchas

- **The build fails on a missing markdown image** (`![](...)`), not only on broken
  links. Every embedded screenshot path must resolve to a real file or the build
  throws. `onBrokenLinks: 'throw'` separately validates internal links.
- `build/` and `.docusaurus/` are git-ignored — never commit them.
- Screenshots use a committed capture pipeline: [`scripts/`](scripts/) holds
  `capture-screenshots.mjs` (Playwright, reuses your Chrome profile, clips to
  `#main-content`) driven by `screenshot-manifest.json`. Output lands in
  `static/img/screenshots/`. Run with Chrome closed.

## Conventions

- Verify every factual claim against the running app **and** the code — older docs
  drift behind UI refactors (git's last-modified date is a good staleness signal).
- Keep docs free of plan/spec scratch files.
