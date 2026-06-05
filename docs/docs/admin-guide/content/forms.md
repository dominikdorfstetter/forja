---
sidebar_position: 6
---

# Forms

The Forms module lets you collect structured submissions from your site — contact requests, applications, surveys, anything keyed by named fields. Forms cover the full lifecycle: build the form, render it on a public page, accept submissions with validation and GDPR consent, triage them in an admin inbox, and auto-purge them on a retention schedule. Forms are localizable end-to-end, and the admin Translations tab can call your AI provider to translate from the default locale.

Forms are gated behind the **module flag**. Enable Forms for a site under **Site Settings → Modules** before the sidebar item appears or the API responds.

## Form Listing

Navigate to **Forms** in the sidebar (visible when the Forms module is enabled). The listing shows all forms for the currently selected site.

### List View Columns

| Column | Description |
|--------|-------------|
| **Name** | Display name of the form. |
| **Slug** | URL identifier — visitors reach the form at `/forms/{slug}`. |
| **Fields** | Number of configured fields. |
| **Submissions** | Total submissions received (lifetime). |
| **Status** | Active or Inactive. Inactive forms 404 publicly. |

Click any row to open the detail/builder page.

### Header Actions

- **Manage templates** — navigate to the templates page (see [Templates](#form-templates)).
- **Create form** — open the create wizard.

## Creating a Form

The wizard has two steps:

1. **Method** — choose **Start from scratch** for an empty form, or pick a template to copy its field set as a starting point. Inactive templates are hidden from this list.
2. **Details** — set the form name and slug. The slug auto-fills from the name as URL-safe text and is the path segment visitors see at `/forms/{slug}`.

Click **Create form** and you're routed straight to the detail/builder page.

## Form Detail & Field Builder

The form detail page at `/forms/{id}` has three tabs:

### Settings Tab

| Field | What it does |
|-------|--------------|
| **Name / Slug / Description** | Public-facing chrome rendered above the form. |
| **Active** | Toggle off to 404 the public URL and reject submissions. |
| **Require consent checkbox** | When on, a consent checkbox appears in the renderer and submissions store the consent text shown at submit time. |
| **Consent text** | The label next to the consent checkbox. |
| **Bot protection** | `None` or `Mandatory`. When mandatory, the public renderer expects a token (reCAPTCHA / Turnstile etc.) before accepting the submission. The token is stored alongside the submission. |
| **Storage mode** | `Simple` (compact JSONB) or `Queryable` (GIN-indexed for admin-side search across submission data). |
| **Retention (days)** | Leave empty for unbounded retention. A positive integer enables the GDPR retention worker to soft-delete submissions older than N days, hourly. |

### Fields Tab

The field builder. Click **Add field** and pick a type (text, long text, email, number, dropdown, radio, checkbox, date, custom). Each field has:

- **Label** — the technical key (also the JSONB key in stored submissions). **Never localize this** — it would change your data shape. The Translations tab handles visitor-facing display labels.
- **Placeholder / Help text** — display-only.
- **Required** — server-enforced.
- **Validation rules** — type-aware: min/max length on text fields, regex pattern on text/custom, min/max on number, options list on dropdown/radio/checkbox.

Reorder fields by dragging the handle or using the up/down arrows (keyboard-accessible). Each row also has a delete button.

### Translations Tab

Visible only when your site has more than one active locale (configure under **Site Settings → Locales**). The tab lets you provide localized text for every locale you enabled — leave any input blank to fall back to the canonical/default-locale text.

| Localized field | Notes |
|-----------------|-------|
| Form name | Public title |
| Description | Public intro |
| Consent text | Localized GDPR copy |
| Display label | Per-field visitor-facing label (the technical `label` stays the JSONB key) |
| Placeholder | Per-field |
| Help text | Per-field |

**AI translate.** If the AI module is enabled and configured for your site, the Translations tab shows two affordances:

- **Translate from default** (header button) — translates every text in the active locale in one batch, in parallel. Source is always the canonical default-locale text.
- **✦ icon** in each input — translates just that field. Useful for retranslating a single string after you've edited the default.

Translations are saved transactionally with the rest of the form when you click **Save**.

## Submissions Inbox

Click the **Submissions** button on the form detail page to open `/forms/{id}/submissions`. The inbox shows all submissions for that form with:

- **Status filter chips** (All / New / In review / Resolved / Archived) with live counts.
- **Reference code** (monospace) — the human-friendly code visitors get back on submit. Format `XXXX-XXXX-XXXX`, 12 chars from a 28-char alphabet excluding ambiguous `I/O/0/1`.
- **Preview** — first three field values of the submission.
- **Submitted** — timestamp.

### Submission Detail Drawer

Click any row to open the drawer. It shows:

- **Status dropdown** — change the submission's status. State changes are recorded in the status history below.
- **Submitted data** — every field value, rendered as label → value.
- **Notes** — internal triage notes. Add, view timestamps and authors, delete. Notes are admin-only and never exposed to visitors.
- **Status history** — full timeline of who changed the status from what to what, and when.
- **Delete submission** — soft-deletes (the submission no longer appears in the inbox or in visitor self-service lookups).

### CSV Export

The **Export CSV** button downloads the currently-visible page as CSV. The header is the union of all field labels across the visible rows plus reference_code/status/created_at.

## Public Visitor Flow

Once the form is active, visitors interact with two pages on your Astro site:

- **`/forms/{slug}?locale=de`** — renders the form. The `locale` query parameter is optional; when set, localized values substitute for canonical text where translations exist.
- **`/forms/lookup`** — self-service: visitors paste their reference code and can view or delete their own submission. Deletion is idempotent (returns 410 on repeat) and clears stored field data immediately.

## Form Templates

Templates are reusable field presets. Navigate to **Forms → Manage templates** to manage them.

Templates carry:

- A name, description, and Material Symbols icon (purely cosmetic in the wizard list).
- The same field definitions a form has — type, validation, options.
- An active toggle. Inactive templates aren't offered in the create wizard but stay in the table for later reactivation.

Templates are **copy-on-create**. When a form is created from a template, it gets a snapshot of the fields; editing the template later doesn't propagate to forms already created from it.

## GDPR Retention Worker

A background worker ticks hourly and soft-deletes submissions older than each form's configured `retention_days`. Forms with retention unset or set to `0` never auto-delete. Soft-deleted submissions disappear from the inbox and visitor self-service lookups; the rows remain in the database for a short audit window before the trash cleanup worker removes them entirely.

## Permissions

| Role | Form CRUD | Templates | Submissions |
|------|-----------|-----------|-------------|
| **Viewer** | read | read | none |
| **Reviewer** | read | read | read |
| **Author** | create, update:own, delete:own | none | read |
| **Editor** | create, update:any, delete:any | full | read, update, delete |
| **Admin / Owner** | full | full | full |

Submissions inherit ownership from the form, so an Author can only see submissions for forms they created.

## Webhook Integration

When a submission is received, Forja fires a `form.submission.created` webhook event to any subscribed webhook endpoint. **Field data is intentionally excluded** from the payload — webhook receivers get `form_id`, `submission_id`, `reference_code`, and `created_at` and must call the admin API to read the data if they need it. This prevents visitor PII from leaking into third-party logging pipelines.

## Tips

:::tip
**Storage mode** — start with `Simple`. Switch to `Queryable` only when you actually need to search submissions by field value from the admin (it costs a GIN index plus a JSONB ops storage row per submission).
:::

:::tip
**Translations** — Field labels stay as the technical key, so storage shape doesn't change with locale. Only the rendered display label varies. This means switching locales doesn't break exports, webhooks, or self-service lookups that key on `data.<Label>`.
:::

:::warning
**Bot protection token** — Forja stores the bot token but does NOT verify it server-side in v1. Integrate your CAPTCHA provider's verification in your own webhook handler if you need verified-human-only signal.
:::
