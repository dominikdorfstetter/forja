---
sidebar_position: 10
---

# Error Codes

Forja uses a structured error code system. Every error path in the backend has a unique, stable identifier that maps to a user-facing localized message on the frontend.

Error codes are a product feature. They enable precise error handling, clear user messaging, and targeted regression tests.

---

## Format

```
<DOMAIN>_<CAUSE>
```

- `DOMAIN` — the feature area or resource (uppercase, no spaces)
- `CAUSE` — what went wrong (uppercase, descriptive, specific)

There is **no `ERR_` prefix** — the code is the bare screaming-snake-case string exactly as it appears in the `code` field of a `ProblemDetails` response. The frontend resolver also keys regex fallbacks off this shape (e.g. any `*_NOT_FOUND` code gets a generic "not found" message), so the convention is load-bearing, not cosmetic.

**Examples** (real codes — see the [registry](#error-code-registry) for the full list):

| Code | Meaning |
|---|---|
| `AUTH_API_KEY_INVALID` | The provided API key is invalid |
| `WORKFLOW_REVIEW_REQUIRED` | Editorial workflow requires content to be submitted for review before publishing |
| `MEDIA_UPLOAD_TOO_LARGE` | Uploaded file exceeds the maximum allowed size |
| `SITE_EXPORT_FORBIDDEN` | Only the site owner, a site admin, or a system admin may export a site archive |
| `ENTITY_NOT_FOUND` | The requested entity instance does not exist (an `entity_type` field identifies which domain) |

**Rules:**

- Once a code is shipped, it does not change. Clients and tests depend on it.
- Use specific causes — a dedicated code beats overloading the generic `RESOURCE_NOT_FOUND` / `BAD_REQUEST` fallbacks.
- Do not add suffixes like `_ERROR` or `_FAILURE` — the name already implies an error context.
- For genuinely cross-domain resources, prefer a single `ENTITY_*` code plus the `entity_type` tag over one near-identical code per domain (this is why `ENTITY_NOT_FOUND` / `ENTITY_SLUG_TAKEN` exist instead of `BLOG_NOT_FOUND`, `PAGE_NOT_FOUND`, …).

---

## Backend to Frontend Flow

Error codes travel from the Rust backend to the React frontend through a defined pipeline:

**Step 1 — Backend: attach the code to an `ApiError`**

`ApiError` is **not** one variant per failure. It is a small enum keyed by HTTP status (`NotFound`, `BadRequest`, `Forbidden`, `Conflict`, `Gone`, `Locked`, `Internal`, …), each wrapping an `ErrorMeta`. A specific machine code is attached with the `.with_code()` builder; for the cross-domain `ENTITY_*` codes, `.with_entity_type()` adds the domain tag:

```rust
// backend/src/axum_app/handlers/site.rs
return Err(ApiError::forbidden(
    "Only the site owner, a site admin, or a system admin may export this site",
)
.with_code(codes::SITE_EXPORT_FORBIDDEN));

// An ENTITY_* code carries which domain it was raised for:
return Err(ApiError::not_found("CV entry not found")
    .with_code(codes::ENTITY_NOT_FOUND)
    .with_entity_type("cv"));
```

The code constant lives in `backend/src/errors/codes.rs` and is registered in the `ALL` array (one `ErrorCodeDef { code, domain, http_status, description }` row). If `.with_code()` is omitted, `ApiError::code()` falls back to a status-derived generic (`RESOURCE_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, …).

**Step 2 — Backend: `ProblemDetails` response (RFC 7807)**

`ApiError::to_problem_details()` serializes the error. The bare machine code is in the **`code`** field; the RFC 7807 **`type`** field is a *URI* derived from it (`https://forja.dev/errors/<code lowercased>`) — `type` is **not** the bare code:

```json
{
  "type": "https://forja.dev/errors/site_export_forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Only the site owner, a site admin, or a system admin may export this site",
  "code": "SITE_EXPORT_FORBIDDEN",
  "entity_type": "cv"
}
```

`entity_type` is present only for `ENTITY_*` codes; `errors` (an array of `FieldError`) is present only for field-level validation failures.

**Step 3 — Frontend: centralized resolution**

The frontend does **not** hand-roll `if (code === …)` per call site. Every error flows through `resolveError()` (`admin/src/utils/errorResolver.ts`), which detects a `ProblemDetails` and delegates to `resolveErrorCode(code, entity_type)` (`admin/src/utils/errorCodes.ts`). Resolution is tried in order:

1. **`ENTITY_TYPE_OVERRIDES`** — `` `${code}:${entity_type}` `` (e.g. `ENTITY_SLUG_TAKEN:blog`).
2. **`ERROR_CODE_MAP`** — exact code → i18n keys.
3. **`PATTERN_FALLBACKS`** — regex on the code (`/_NOT_FOUND$/`, `/^AUTH_/`, `/^VALIDATION_/`, …) so new backend codes get a sane message with no frontend change.
4. **`null`** — the resolver falls back to the server-supplied `title` / `detail`.

Call sites consume the resolved result through hooks, not by reading `.code` directly: `useErrorSnackbar()` for toast-style errors and `useFormErrorHandler(setError)` for mapping field errors onto a React Hook Form.

**Step 4 — Frontend: i18n message**

A resolved code maps to keys under the **`errorCodes`** namespace (not `errors.<domain>.<cause>`) in `admin/src/i18n/locales/en.json` — a `message` and an optional `action` hint:

```json
{
  "errorCodes": {
    "AUTH_TOKEN_INVALID": { "message": "Session expired", "action": "Please sign in again." },
    "patterns": {
      "notFound": { "message": "Not found", "action": "It may have been moved or deleted." }
    }
  }
}
```

The same keys must be added to **all 11** locale files (`ar, de-AT, de, en, es, fr, it, nl, pl, pt, uk`). A code with no entry still resolves via a `patterns.*` fallback or the server `detail`, so adding an `errorCodes.<CODE>` entry is only needed when you want a tailored, localized message.

---

## Adding a New Error Code

Follow this four-step process when introducing a new failure path:

**Step 1 — Define the code**

Choose a code following `<DOMAIN>_<CAUSE>` (no `ERR_` prefix). Document it in the issue's Error Cases table before writing any code. Before adding a domain-specific code, check whether an existing `ENTITY_*` code plus an `entity_type` tag already covers it.

**Step 2 — Register the code and raise it (backend)**

In `backend/src/errors/codes.rs`, add the constant **and** a matching row in the `ALL` array:

```rust
pub const WIDGET_LIMIT_REACHED: &str = "WIDGET_LIMIT_REACHED";

// inside `pub const ALL: &[ErrorCodeDef] = &[ … ]`
ErrorCodeDef { code: WIDGET_LIMIT_REACHED, domain: "widget", http_status: 409,
               description: "The site has reached its widget quota" },
```

Then raise it from the handler with the status constructor that matches `http_status`, plus `.with_code()`:

```rust
return Err(ApiError::conflict("Widget quota reached for this site")
    .with_code(codes::WIDGET_LIMIT_REACHED));
```

Do **not** add a new `ApiError` enum variant — the enum is intentionally status-keyed, not per-failure.

**Step 3 — Add the i18n message (frontend, optional)**

This is only needed when you want a tailored, localized user message — otherwise the resolver already falls back to a `errorCodes.patterns.*` match or the server `detail`. To add one, register the code in `ERROR_CODE_MAP` in `admin/src/utils/errorCodes.ts` and add the keys under the `errorCodes` namespace in **all 11** locale files:

```json
{
  "errorCodes": {
    "WIDGET_LIMIT_REACHED": {
      "message": "Widget limit reached",
      "action": "Remove an existing widget or upgrade your plan."
    }
  }
}
```

**Step 4 — Verify, don't wire**

No per-component wiring is required: `useErrorSnackbar()` / `useFormErrorHandler()` already route every error through `resolveError()`. Just confirm the failing call surfaces through one of those hooks (most mutations already do). Regenerate the [registry table](#error-code-registry) from `codes.rs`.

---

## Error Code Registry

The canonical source of all error codes is the `ALL` array in `backend/src/errors/codes.rs` — every code is one `ErrorCodeDef { code, domain, http_status, description }` entry, and that array is what the public `GET /api/v1/error-codes` catalog endpoint (`ErrorCodeCatalogResponse`) and the test suite assert against. The table below is **generated from that array**: each row's `Code` is the wire value sent in the `type` field of a `ProblemDetails` response (not the Rust constant name — for a few `forms` codes the two differ, e.g. the `FORM_BOT_PROTECTION_MISSING` constant is sent as `BOT_PROTECTION_MISSING`).

To add or change a code, edit `codes.rs` and regenerate this table — do not hand-edit rows here, and never reuse or repurpose a shipped code (clients and tests depend on the exact string).

> The `i18n Key` / `Added In` columns from the original placeholder were dropped: no `errors.*` namespace exists in the locale files, and the version a code shipped in is not tracked anywhere — populating either would mean inventing data. `git log -S'"THE_CODE"' -- backend/src/errors/codes.rs` recovers the introducing commit if you need provenance for a specific code.

| Code | Domain | HTTP | Description |
|---|---|---|---|
| `ENTITY_NOT_FOUND` | entity | 404 | The requested entity instance does not exist (entity_type identifies which domain) |
| `ENTITY_SLUG_TAKEN` | entity | 409 | An entity with this slug already exists (entity_type identifies which domain) |
| `ENTITY_LOCALIZATION_EXISTS` | entity | 400 | A localization for this locale already exists on the entity (entity_type identifies which domain) |
| `ENTITY_LOCALIZATION_NOT_FOUND` | entity | 404 | No localization found for the requested entity and locale (entity_type identifies which domain) |
| `SITE_CREATE_REQUIRES_ADMIN` | site | 403 | Admin API key required to create sites |
| `SITE_CREATE_INVALID_LOCALES` | site | 400 | Exactly one locale must be marked as default when creating a site |
| `SITE_CREATE_SCOPED_KEY` | site | 403 | Site-scoped API keys cannot create new sites |
| `SITE_RESTORE_EXPIRED` | site | 410 | The 30-day grace window for restoring a soft-deleted site has lapsed |
| `SITE_EXPORT_FORBIDDEN` | site | 403 | Only the site owner, a site admin, or a system admin may export a site archive |
| `SITE_EXPORT_JOB_NOT_FOUND` | site | 404 | The site export job does not exist for this site, or its artifact has expired and been purged |
| `SITE_EXPORT_ALREADY_RUNNING` | site | 409 | An export job for this site is already queued or running; wait for it to finish before requesting another |
| `SITE_EXPORT_FAILED` | site | 500 | The export worker failed to build or store the site archive |
| `BLOG_SAMPLE_EXISTS` | blog | 400 | Sample content already exists for this site |
| `BLOG_NO_DEFAULT_LOCALE` | blog | 400 | No default locale configured for this site |
| `BLOG_BULK_STATUS_REQUIRED` | blog | 400 | The status field is required for UpdateStatus bulk action |
| `PAGE_BULK_STATUS_REQUIRED` | page | 400 | The status field is required for UpdateStatus bulk action |
| `CONTENT_INVALID_STATUS` | content | 400 | Invalid status transition for this content item |
| `CONTENT_PUBLISH_DATE_INVALID` | content | 400 | publish_end must be after publish_start |
| `CONTENT_UNKNOWN_ENTITY_TYPE` | content | 400 | Unknown content entity type |
| `CONTENT_NO_DEFAULT_ENVIRONMENT` | content | 400 | No default environment configured |
| `CONTENT_SLUG_GENERATION_FAILED` | content | 400 | Could not generate a unique slug - too many copies |
| `CONTENT_ROUTE_GENERATION_FAILED` | content | 400 | Could not generate a unique route - too many copies |
| `CONTENT_REVIEW_INVALID_STATUS` | content | 400 | Content must be in InReview status to perform a review action |
| `DOCUMENT_PASSWORD_REQUIRED` | document | 401 | This document is password-protected and requires a password to access |
| `DOCUMENT_PASSWORD_INCORRECT` | document | 403 | The provided password is incorrect |
| `DOCUMENT_ACCESS_RATE_LIMITED` | document | 429 | Too many failed password attempts — try again later |
| `DOCUMENT_ENCRYPTION_FAILED` | document | 500 | Failed to encrypt the document |
| `DOCUMENT_DECRYPTION_FAILED` | document | 500 | Failed to decrypt the document — wrong password or corrupted data |
| `DOCUMENT_NOT_UPLOADABLE` | document | 400 | Only uploaded documents (not URL-based) can be password-protected |
| `DOCUMENT_EXPIRED` | document | 410 | The private document's access window has expired and it is no longer downloadable |
| `DOCUMENT_LOCKED` | document | 423 | The document is locked after 3 failed password attempts and must be unlocked by an admin |
| `DOCUMENT_NOT_LOCKED` | document | 409 | Unlock requested on a document that is not currently locked |
| `DOCUMENT_INVALID_TTL` | document | 400 | expires_at must be in the future and at most one year ahead |
| `MEDIA_UPLOAD_TOO_LARGE` | media | 400 | Uploaded file exceeds the maximum allowed size |
| `MEDIA_UPLOAD_INVALID_TYPE` | media | 400 | The uploaded file type is not allowed |
| `MEDIA_UPLOAD_EMPTY` | media | 400 | The uploaded file is empty or no file data was received |
| `MEDIA_UPLOAD_NO_DATA` | media | 400 | No file data received in the upload request |
| `MEDIA_UPLOAD_READ_FAILED` | media | 500 | Failed to read the uploaded file data |
| `MEDIA_TAG_INVALID` | media | 400 | Invalid tag format |
| `MEDIA_TOO_MANY_TAGS` | media | 400 | Too many tags on media file |
| `STORAGE_QUOTA_EXCEEDED` | storage | 413 | Upload would exceed the per-site storage quota |
| `TRASH_ALREADY_RESTORED` | trash | 400 | The item is not in the trash (already restored or never deleted) |
| `TRASH_NOT_DELETED` | trash | 400 | The item is not soft-deleted and cannot be permanently removed from trash |
| `AUTH_MISSING_CREDENTIALS` | auth | 401 | No Authorization Bearer token or X-API-Key header provided |
| `AUTH_TOKEN_INVALID` | auth | 401 | The provided authentication token is invalid or expired |
| `AUTH_TOKEN_AUDIENCE` | auth | 401 | The JWT `aud` claim does not match the configured expected audience |
| `AUTH_TOKEN_ISSUER` | auth | 401 | The JWT `iss` claim does not match the configured expected issuer |
| `AUTH_INSUFFICIENT_ROLE` | auth | 403 | Your role does not have sufficient permissions for this action |
| `AUTH_SITE_ACCESS_DENIED` | auth | 403 | You do not have access to the requested site |
| `AUTH_API_KEY_INVALID` | auth | 401 | The provided API key is invalid |
| `AUTH_API_KEY_SITE_DENIED` | auth | 403 | The API key does not have access to the requested site |
| `AUTH_ACCOUNT_SOLE_OWNER` | auth | 409 | Cannot delete account while being the sole owner of a site |
| `AUTH_CLERK_NOT_CONFIGURED` | auth | 500 | Clerk authentication service is not configured |
| `AUTH_RATE_LIMITED` | auth | 429 | Too many failed authentication attempts — wait before retrying |
| `API_KEY_PERMISSION_EXCEEDED` | api_key | 403 | Your role cannot create API keys with the requested permission level |
| `API_KEY_INVALID_STATUS` | api_key | 422 | Invalid API key status value |
| `API_KEY_INVALID_PERMISSION` | api_key | 422 | Invalid API key permission value |
| `API_KEY_SITE_FILTER_REQUIRED` | api_key | 403 | Site admins must specify a site_id filter when listing API keys |
| `LOCALE_CODE_TAKEN` | locale | 409 | A locale with this code already exists |
| `LOCALE_DELETE_IN_USE` | locale | 409 | Cannot delete locale that is assigned to one or more sites |
| `SITE_LOCALE_LAST_LANGUAGE` | site_locale | 409 | Cannot remove the last language from a site |
| `MEMBER_ALREADY_EXISTS` | site_membership | 409 | The user is already a member of this site |
| `MEMBER_ROLE_OWNER_REQUIRED` | site_membership | 403 | Only the site owner can assign Admin or Owner roles |
| `MEMBER_CANNOT_REMOVE_OWNER` | site_membership | 403 | Cannot remove the site owner - transfer ownership first |
| `MEMBER_REQUIRES_CLERK_AUTH` | site_membership | 400 | This operation requires Clerk JWT authentication |
| `SITE_OWNER_CANNOT_LEAVE` | site_membership | 403 | Site owners must transfer ownership before leaving |
| `LEGAL_PUBLISH_MISSING_TITLE` | legal | 400 | Legal document must have a title before publishing |
| `LEGAL_PUBLISH_MISSING_BODY` | legal | 400 | Legal document must have content before publishing |
| `LEGAL_VERSION_SOURCE_DELETED` | legal | 404 | Cannot create a version from a deleted document |
| `CV_BULK_STATUS_REQUIRED` | cv | 400 | The status field is required for UpdateStatus bulk action on CV entries |
| `PROJECT_BULK_STATUS_REQUIRED` | project | 400 | The status field is required for UpdateStatus bulk action on projects |
| `REDIRECT_SAME_PATH` | redirect | 400 | Source and destination redirect paths must be different |
| `WEBHOOK_TEST_FAILED` | webhook | 500 | The webhook test delivery failed |
| `WEBHOOK_URL_SSRF` | webhook | 400 | The webhook URL targets a private or internal network address |
| `WEBHOOK_INVALID_DEBOUNCE` | webhook | 422 | Debounce value must be between 0 and 300 seconds |
| `WEBHOOK_INVALID_STATS_WINDOW` | webhook | 400 | Stats time window must be one of: 1h, 24h, 7d, 30d |
| `NOTIFICATION_ACCESS_DENIED` | notification | 403 | You can only access your own notifications |
| `NOTIFICATION_REQUIRES_CLERK` | notification | 403 | Notification endpoints require Clerk JWT authentication |
| `ENVIRONMENT_NO_DEFAULT` | environment | 404 | No default environment is configured |
| `ANALYTICS_NOT_ENABLED` | analytics | 403 | Analytics is not enabled for this site |
| `AI_NOT_CONFIGURED` | ai | 400 | AI is not configured for this site |
| `AI_PROVIDER_UNAVAILABLE` | ai | 503 | The AI provider is unavailable or returned an error |
| `AI_RESPONSE_PARSE_FAILED` | ai | 500 | Failed to parse the AI provider response |
| `AI_TRANSLATE_INVALID` | ai | 400 | Invalid translation request content or missing fields |
| `AI_URL_SSRF` | ai | 400 | The AI base URL targets a private or internal network address |
| `AI_VISION_MISSING_IMAGE` | ai | 400 | image_url is required for vision actions (auto_tag, alt_text) |
| `AI_SECTION_CONTEXT_INSUFFICIENT` | ai | 400 | section_context with section_type is required for section_content action |
| `AI_SECTION_TYPE_UNKNOWN` | ai | 400 | Unknown page-section type — must be one of the SectionType enum values |
| `AI_CONTEXT_INSUFFICIENT` | ai | 400 | Content is too short for the AI to produce a useful suggestion (e.g. blog body shorter than the minimum word count for tag generation) |
| `CLERK_NOT_CONFIGURED` | clerk | 500 | Clerk service is not configured |
| `CLERK_USER_NOT_FOUND` | clerk | 404 | The requested Clerk user does not exist |
| `CLERK_API_FAILED` | clerk | 500 | Clerk API request failed |
| `CLERK_INVALID_IDENTIFIER` | clerk | 400 | Invalid user identifier format |
| `CLERK_INVALID_ROLE` | clerk | 422 | Invalid role value |
| `WORKFLOW_REVIEW_REQUIRED` | workflow | 403 | Editorial workflow requires content to be submitted for review before publishing |
| `WORKFLOW_INVALID_STATUS` | workflow | 403 | Reviewers can only transition content that is InReview |
| `WORKFLOW_NO_PERMISSION` | workflow | 403 | You do not have permission to change content status |
| `MODULE_NOT_ENABLED` | module | 403 | The requested module is not enabled for this site |
| `ONBOARDING_REQUIRES_CLERK` | onboarding | 400 | Onboarding progress requires Clerk authentication |
| `FORM_DUPLICATE_FIELD_LABELS` | forms | 400 | Form definition contains duplicate field labels |
| `FORM_TEMPLATE_NAME_EXISTS` | forms | 409 | Another form template on this site already uses this name |
| `BOT_PROTECTION_MISSING` | forms | 400 | Form requires a bot_protection_token but none was provided |
| `BOT_PROTECTION_INVALID` | forms | 400 | Captcha provider reported the supplied token did not pass verification |
| `BOT_PROTECTION_NOT_CONFIGURED` | forms | 503 | Form is Mandatory-protected but the site has no captcha verifier configured |
| `BOT_PROTECTION_PROVIDER_ERROR` | forms | 503 | Captcha provider was unreachable or returned an unexpected response |
| `FORM_VALIDATION_FAILED` | forms | 400 | One or more submission fields failed validation |
| `FORM_CONSENT_REQUIRED` | forms | 400 | Form requires consent but consent_given was false |
| `SUBMISSION_DELETED` | forms | 410 | Submission has been deleted (idempotent self-service signal) |
| `INVALID_REFERENCE_CODE` | forms | 404 | Reference code does not match any submission |
| `INVALID_STATUS_TRANSITION` | forms | 400 | Requested submission status transition is not allowed |
| `VALIDATION_REQUIRED_FIELD` | validation | 422 | A required field is missing |
| `VALIDATION_INVALID_FORMAT` | validation | 422 | A field has an invalid format |
| `VALIDATION_OUT_OF_RANGE` | validation | 422 | A field value is outside the allowed range |
| `RATE_LIMIT_EXCEEDED` | system | 429 | Too many requests - rate limit exceeded |
| `SERVICE_UNAVAILABLE` | system | 503 | A required service is temporarily unavailable |
| `INTERNAL_ERROR` | system | 500 | An unexpected internal error occurred |
| `DATABASE_ERROR` | system | 500 | A database error occurred |
| `STORAGE_ERROR` | system | 500 | A storage backend error occurred |
| `RESOURCE_NOT_FOUND` | system | 404 | The requested resource was not found (generic) |
| `BAD_REQUEST` | system | 400 | The request was malformed or invalid (generic) |
| `VALIDATION_ERROR` | system | 422 | One or more fields failed validation (generic) |
| `UNAUTHORIZED` | system | 401 | Authentication is required (generic) |
| `FORBIDDEN` | system | 403 | You do not have permission for this action (generic) |
| `CONFLICT` | system | 409 | The request conflicts with existing data (generic) |
| `PAYLOAD_TOO_LARGE` | system | 413 | The request payload exceeds the allowed limit (generic) |
