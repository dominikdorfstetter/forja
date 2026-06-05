---
sidebar_position: 7
---

# Collections (Custom Types)

Collections let you define your **own content types** — a named type with typed, translatable fields — entirely from the admin UI, with **no code change, no migration, and no deploy**. A "Recipe", an "Event", a "Team Member", an internal "Lead" record: you describe the shape once and Forja gives you create/edit/publish, version history, audit, webhooks, and a public API for it, exactly like the built-in content types.

What sets Collections apart from a generic content modeler is that the **data-protection contract is part of the schema**. Every field declares whether it is personal data, why it is collected, its legal basis, and its retention — and Forja enforces that contract: encryption-at-rest, public-API stripping, role-based redaction, auto-purge on expiry, inclusion in subject erasure, and an auto-generated **Records of Processing (GDPR Art. 30)** export. Define a collection and your RoPA falls out of it.

Collections are gated behind the **module flag**. Enable **Collections** for a site under **Site Settings → Modules** before the sidebar item appears or the API responds.

## Defining a type

Navigate to **Collections** in the sidebar, then **New collection**. A collection has:

| Setting | Meaning |
|---|---|
| **Name** | Human-friendly label (e.g. "Recipe"). |
| **Key** | URL/API identifier (e.g. `recipe`). Must not collide with a built-in type (`blog`, `page`, …). |
| **Retention (days)** | Entries older than this are auto-purged. Leave empty to keep forever. |
| **Routing** | **Page** — entries get a public URL and render on your site. **Data only** — served via API only (internal/CRM-style data), never routed. |
| **Publicly readable** | Off by default. When off, the type is invisible to the public API entirely. |

Limits per site: up to 100 types, 100 fields per type, 100 options per enum field.

## Fields

Add fields with the **Add field** button. Each field has a key, a label, and a type:

| Field type | Stores |
|---|---|
| **text** | Single-line text |
| **richtext** | Formatted body text |
| **number** | Numeric value (with optional min/max) |
| **boolean** | True/false |
| **date** | A calendar date |
| **enum** | One of a fixed option list |
| **media** | A reference to a media asset |

Per-field toggles:

- **Required** — must be present before an entry can be published.
- **Translatable** — the value is per-locale (otherwise it is shared across all locales).
- **Title field** — exactly one field is the entry's title (used as the heading and list label). Its value is stored on the content record, not in the value tables.
- **Personal data (PII)** — see below.

### Personal data & compliance

Flag a field as **Personal data (PII)** and you must also declare its **legal basis** (GDPR Art. 6) and may record a **data category** and **processing purpose**. Forja then enforces the contract automatically:

- **Encrypted at rest** — PII values are stored as AES-256-GCM ciphertext, never plaintext.
- **Stripped from the public API** — PII never leaves the building on a public response.
- **Role-based redaction** — non-admin editors see PII fields as redacted.
- **Auto-purge** — entries past the type's retention window are deleted by a scheduled job.
- **Erasure** — an admin can erase a single entry's PII, which removes the values and writes an audit record.
- **RoPA** — every PII field appears in the site's Art. 30 export with its category, purpose, legal basis, and retention.

A collection cannot be saved with a PII field that has no legal basis.

## Entries

Open a collection to see its entries (loading, empty, and error states; filter by status). **New entry** opens the schema-driven form: each field renders the right control, translatable fields get per-locale tabs, and PII fields are badged. Entries flow through the same lifecycle as built-in content — draft → published, version history, audit, webhooks.

**Publishing** requires every required field to be filled **in the default locale** (other locales fall back to it). Programmatic ingestion is supported too: an API key with Write permission can create and update entries (headless use cases) — PII encryption, validation, the size cap, and RoPA inclusion all apply identically.

## Evolving a schema safely

You can change a type after entries exist, without corrupting data:

- **Rename a field** — stored values migrate to the new key.
- **Retype a field** — allowed only when every existing value can be converted; otherwise rejected.
- **Make a field required** — rejected if any existing entry lacks a value.
- **Remove a field** — the field is *soft-deprecated*: hidden from new entries, but its stored values stay readable.

## Records of Processing (Art. 30)

**Site Settings → RoPA** (or `GET /sites/{id}/ropa`) generates the GDPR Article 30 register for the site: every collection that processes personal data, each PII field's category / purpose / legal basis, the retention window, and a live record count — the artifact a CIO hands straight to their DPO.

## Consuming collections publicly

Page-type, publicly-readable collections are served on the **Consumer API** and can be rendered by your site:

- `GET /sites/{site_id}/collections/{type_key}/published` — paginated published entries
- `GET /sites/{site_id}/collections/{type_key}/by-slug/{slug}` — a single entry
- `GET /sites/{site_id}/collections/{type_key}/schema` — the public (PII-free) field schema

All three return **404 unless the type is publicly readable**, and PII fields are always omitted.

### SDK

The [`@forjacms/client`](../../sdk/overview) SDK exposes one generic resource — no per-type codegen:

```ts
const recipes = await forja.collections('recipe').published({ page: 1 });
const one = await forja.collections('recipe').bySlug('spaghetti');
const schema = await forja.collections('recipe').schema();
```

### Astro template

The reference Astro template renders page-type collections generically. List the collection keys to publish in `CMS_PAGE_COLLECTIONS` (comma-separated); the template fetches each schema + published entries, generates routes at `/{type_key}/{slug}`, and renders entries from their schema — no per-type code. Built-in routes (blog, legal, …) resolve first on any path collision.
