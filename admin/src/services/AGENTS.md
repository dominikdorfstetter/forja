# admin/src/services — API client layer

Thin functions that call the backend REST API, one module per resource
(`blogs.ts`, `pages.ts`, `cv.ts`, `projects.ts`, `media.ts`, `forms.ts`, …). This
is the only place that talks to the network; hooks and pages call these, never
`fetch` directly.

## Conventions

- One module per backend resource; export small, intention-named functions
  (`getBlogs`, `deleteBlog`, …).
- Types come from `src/generated/api-types.ts` (generated from the backend
  OpenAPI). Regenerate with `npm run generate:openapi` after backend DTO changes;
  don't hand-edit the generated file.
- Keep request/response mapping here so components stay UI-only.
- Auth (Clerk JWT) is attached centrally — service functions shouldn't manage
  tokens themselves.
