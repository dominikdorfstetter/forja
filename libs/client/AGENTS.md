# libs/client — @forjacms/client

Typed TypeScript SDK for the Forja content API. Runs in Node.js, browsers, and
edge runtimes. This is how templates (and third-party consumers) read published
content without hand-rolling fetch calls.

```bash
npm run build
npm test
```

## Conventions

- Mirror the backend's public API surface; response shapes should track the
  backend OpenAPI contract.
- The core is framework-agnostic; `src/angular/` adds an Angular adapter
  (resource + provider). Its DI tests use `createEnvironmentInjector` +
  `runInInjectionContext` rather than `TestBed`.
- Single-resource lookups that return `T | null` go through
  `http.getOrNull(path, params?)` — it owns the `404 → null, else rethrow`
  discrimination. Don't hand-roll a `try/catch` on `ForjaNotFoundError` in a
  resource method. For locale-aware endpoints pass `{ locale: params?.locale }`
  (undefined values are dropped from the query string).
- Test BOTH branches of every "not found → null" helper — the null path and the
  rethrow path. The mechanics are anchored once in `http.getOrNull`'s unit test;
  per-resource tests mock `getOrNull` and assert delegation (path + params,
  null pass-through, error propagation).
