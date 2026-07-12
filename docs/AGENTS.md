# docs — Documentation site

Docusaurus site published to `forja-docs.dorfstetter.at`. Markdown content lives
in [`docs/`](docs/) (Getting Started, Architecture, Admin Guide, API, SDK,
Templates, Deployment, Developer). Sidebar in `sidebars.ts`; site config in
`docusaurus.config.ts`. Deployed by `.github/workflows/deploy-docs.yml` — runs
on `v*` tags and `workflow_dispatch`, gated by the `github-pages` environment
(main branch + `v*` tags only).

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
  `capture-screenshots.mjs` (Playwright `launchPersistentContext` with a
  dedicated profile dir — `$PROFILE_DIR` or `os.tmpdir()/forja-docs-screenshot-profile` —
  so it does NOT touch your Chrome profile and Chrome can stay open; waits for
  a one-time login on first run) driven by `screenshot-manifest.json`. Clipping
  to `#main-content` is opt-in per manifest entry via the `clipMain` flag.
  Output lands in `static/img/screenshots/`.
- **TypeScript 7 removed `baseUrl`**, but `@docusaurus/tsconfig` still sets it —
  `docs/tsconfig.json` resets it with `"baseUrl": null` and re-anchors the
  `@site/*` paths relative to the docs dir. Don't re-add `baseUrl`.

## Conventions

- Verify every factual claim against the running app **and** the code — older docs
  drift behind UI refactors (git's last-modified date is a good staleness signal).
- Keep docs free of plan/spec scratch files.
