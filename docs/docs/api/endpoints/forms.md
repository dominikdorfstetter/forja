---
sidebar_position: 14
---

# Forms

The Forms module exposes three endpoint clusters: **admin CRUD** for forms + templates, **public** for visitor rendering + submission, and **management** for triaging submissions. All admin endpoints sit behind `ModuleGuard<FormsModule>` — they 404 if the site has the Forms module disabled.

## Endpoints

### Forms (admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/forms?page&page_size&search&sort_by&sort_dir` | `form:read` | List forms for a site (paginated) |
| POST | `/sites/{site_id}/forms` | `form:create` | Create a form (optionally from a template) |
| GET | `/forms/{id}` | `form:read` | Get a form with fields + localizations |
| GET | `/sites/{site_id}/forms/by-slug/{slug}` | `form:read` | Look up a form by slug |
| PUT | `/forms/{id}` | `form:update:own` / `form:update:any` | Update a form (optionally replacing fields and/or localizations atomically) |
| DELETE | `/forms/{id}` | `form:delete:own` / `form:delete:any` | Soft-delete a form |

### Form templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/form-templates` | `form_template:read` | List templates for a site |
| POST | `/sites/{site_id}/form-templates` | `form_template:create` | Create a template |
| GET | `/form-templates/{id}` | `form_template:read` | Get a template |
| PUT | `/form-templates/{id}` | `form_template:update` | Update a template |
| DELETE | `/form-templates/{id}` | `form_template:delete` | Delete a template |

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/forms/{slug}?locale=` | Fetch a form definition for rendering. Inactive forms 404. Locale param accepts a UUID or code (`de`, `en`, etc.) — when set and matching a localization, localized text substitutes for the canonical values. |
| GET | `/public/forms/{slug}/altcha-challenge` | Issue a fresh, single-use, HMAC-signed ALTCHA challenge for a self-hosted-ALTCHA site. Returns 409 when the site is not in ALTCHA mode. |
| POST | `/public/forms/{slug}/submit` | Submit a form. Returns the visitor's reference code. IP-rate-limited. |
| POST | `/public/submissions/lookup` | Privacy-preserving self-service lookup. Returns status + created_at only. |
| GET | `/public/submissions/{reference_code}` | Visitor's full view of their own submission. |
| DELETE | `/public/submissions/{reference_code}` | Idempotent self-service delete. Returns 410 on a repeat call where the submission was previously deleted. |

The public endpoints resolve the site from the `X-Site-Domain` header rather than the URL path. Set it on the `ForjaClient` config via `siteDomain`.

### Submission management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/forms/{form_id}/submissions?page&page_size&status` | `form_submission:read` | List submissions for a form, optionally filtered by status |
| GET | `/forms/{form_id}/submissions/status-counts` | `form_submission:read` | Counts by status (new / in_review / resolved / archived) |
| GET | `/submissions/{id}` | `form_submission:read` | Get a submission with notes + status history |
| PUT | `/submissions/{id}/status` | `form_submission:update` | Change status (state-machine enforced server-side) |
| DELETE | `/submissions/{id}` | `form_submission:delete` | Soft-delete a submission |
| POST | `/submissions/{id}/notes` | `form_submission:update` | Add a triage note |
| DELETE | `/submissions/{id}/notes/{note_id}` | `form_submission:update` | Delete a note |

## Permission scopes

Two new permission resources:

- **`form`** — Author+ can create/update:own/delete:own; Editor+ unlocks update:any/delete:any.
- **`form_template`** — Editor+ for all operations.
- **`form_submission`** — Reviewer+ for read; Author can update/delete their own forms' submissions; Editor+ unlocks :any.

Templates are editor-only because they're a shared site resource (used by multiple form-creators).

## Localization

Two related schemas:

- `FormLocalizationInput` / `FormLocalizationResponse` — per-locale `name`, `description`, `consent_text`. Keyed by `(form_id, locale_id)`.
- `FormFieldLocalizationInput` / `FormFieldLocalizationResponse` — per-locale `display_label`, `placeholder`, `help_text`. Keyed by `(form_field_id, locale_id)`. The field `label` stays canonical (it's the technical key used as the submission JSONB key).

Admin write endpoints accept localizations atomically as part of the `CreateFormRequest` / `UpdateFormRequest` body — sending `localizations` on `UpdateFormRequest` performs a wipe-and-rewrite inside the same transaction as the field replace. Omit the field to leave existing localizations untouched.

On the public `GET /public/forms/{slug}?locale=` endpoint, the backend substitutes localized values into the response before serializing. `PublicFormFieldResponse.display_label` carries the localized label (defaulting to `label`), while `label` remains the technical key.

## Validation

Submission validation runs server-side on every POST to `/public/forms/{slug}/submit`. Rules supported:

- `required` — non-empty / non-null / non-empty-array
- `min_length` / `max_length` — string length bounds
- `pattern` — ECMAScript-flavored regex (Rust `regex` crate; no lookbehind/lookahead)
- `min` / `max` — numeric bounds
- email format validation on `field_type: email`
- ISO date format validation on `field_type: date`
- Option membership on `select` / `radio` / `checkbox`

The `validateSubmission` helper in `libs/client/src/resources/forms.ts` mirrors these rules client-side for instant UX feedback. Server validation is always the source of truth.

## Bot protection

When a form has `bot_protection: "mandatory"`, submitters must include a `bot_protection_token` in the submit payload, and Forja **verifies it server-side before persisting**. Verification is per-site and supports two modes (configured at `PUT /sites/{site_id}/bot-protection`):

- **`altcha` (default)** — self-hosted [ALTCHA](https://altcha.org/) proof-of-work. The server issues an HMAC-signed challenge at `GET /public/forms/{slug}/altcha-challenge`; the visitor's browser solves it (e.g. via the open-source `<altcha-widget>`); the solved payload is submitted as `bot_protection_token` and verified **in-process, with no outbound call** (GDPR-clean — no third-party request, no cookies). Each solved challenge is single-use: replaying the same payload within its validity window is rejected (`BOT_PROTECTION_INVALID`). Enabling ALTCHA is zero-config — the HMAC key is auto-generated and stored encrypted; it is never returned by the API. Rotate it explicitly with `regenerate_key: true`.
- **`remote`** — a third-party captcha vendor. The admin configures the vendor's `verify_url` + secret; Forja POSTs the token there and reads `{ success }` (Cloudflare Turnstile / hCaptcha / reCAPTCHA / Friendly Captcha all share this shape).

Error codes on submit: `BOT_PROTECTION_MISSING` (no token, 400), `BOT_PROTECTION_INVALID` (failed/expired/replayed payload, 400), `BOT_PROTECTION_NOT_CONFIGURED` (Mandatory form but no verifier set up, 503), `BOT_PROTECTION_PROVIDER_ERROR` (remote vendor unreachable, 503). Verification fails closed.

## Reference codes

`POST /public/forms/{slug}/submit` returns a `reference_code` formatted as `XXXX-XXXX-XXXX` — 12 chars from a 28-char alphabet excluding ambiguous `I/O/0/1`. Codes are generated from the kernel CSPRNG (`rand` 0.10 with `OsRng`), have ~57 bits of entropy, and are UNIQUE-constrained per row with a 3-retry insert loop.

## Privacy & webhooks

When a submission lands, Forja queues a `form.submission.created` webhook event for any subscribed webhook endpoint. **Field data is intentionally excluded from the payload** — receivers get `form_id`, `submission_id`, `reference_code`, and `created_at` and must call the admin submission endpoint to read field values if they need them. The integration test in `forms_webhook_notification_test.rs` reads the queued payload back and asserts the visitor's submitted email never appears in it.

## Storage modes

A form's `storage_mode` controls how submission `data` is indexed:

- **`simple`** (default) — submissions stored as compact JSONB without a search index. Adequate for inbox triage and CSV export.
- **`queryable`** — a GIN index with `jsonb_path_ops` is created so admin-side searches across submission data are efficient. Use this when you actually need to query submissions by field value from the admin.

## GDPR retention

Each form has an optional `retention_days` integer. A background worker (`forms_retention_cleanup`) ticks hourly and soft-deletes submissions older than the configured retention. `NULL` or `0` opts out of auto-deletion.

## Module flag

All endpoints are gated behind `ModuleGuard<FormsModule>`. The site setting `module_forms_enabled` must be `true` (toggle under **Site Settings → Modules**) for the endpoints to respond. Disabled sites get 404 to avoid leaking module status.
