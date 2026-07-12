# Forja Shared Libraries

Shared packages used across Forja frontend templates.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Packages

All four packages are published to npm at `2.x` and also consumed locally via `file:../../libs/*` dependencies by `templates/astro-blog`.

### [@forjacms/analytics](analytics/)

Privacy-first analytics tracker for Forja CMS. Tracks pageviews without cookies or PII (GDPR-friendly by design).

- **Build**: tsdown (CJS + ESM + type declarations)
- **Test**: Vitest with happy-dom

```bash
cd analytics
npm install
npm run build    # Build CJS + ESM bundles
npm test         # Run tests with coverage
npm run dev      # Watch mode
```

### [@forjacms/client](client/)

Typed TypeScript SDK for the Forja content API. Works in Node.js, browsers, and edge runtimes; optional Angular integration via the `./angular` subpath.

### [@forjacms/sections](sections/)

Framework-agnostic Web Components (Stencil) for rendering Forja page sections. Zero CSS — style via BEM class hooks.

### [@forjacms/sections-react](sections-react/)

Auto-generated React wrappers for `@forjacms/sections`, with typed props and events.
