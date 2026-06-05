# libs/analytics — @forjacms/analytics

Privacy-first pageview tracker for Forja sites. No cookies, no IP storage, no PII —
GDPR-compliant by design. Built with tsdown (CJS + ESM + type declarations),
tested with Vitest + happy-dom.

```bash
npm run build   # CJS + ESM bundles + .d.ts
npm test        # Vitest with coverage
npm run dev     # watch mode
```

Keep the no-PII guarantee intact: anything that could identify a visitor (raw IP,
cookies, fingerprints) must not be collected or persisted here.
