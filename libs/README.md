# Forja Shared Libraries

Shared packages used across Forja frontend templates.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Packages

### [@forja/analytics](analytics/)

Privacy-first analytics tracker for Forja CMS. Tracks pageviews without cookies or PII (GDPR-friendly by design).

- **Build**: tsup (CJS + ESM + type declarations)
- **Test**: Vitest with happy-dom
- **Usage**: Referenced as a local dependency (`file:../../libs/analytics`) in frontend templates

```bash
cd analytics
npm install
npm run build    # Build CJS + ESM bundles
npm test         # Run tests with coverage
npm run dev      # Watch mode
```
