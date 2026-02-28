---
title: Database Schema
sidebar_position: 4
description: PostgreSQL schema design, multi-tenancy, and localization patterns.
---

# Database Schema

OpenYapper uses **PostgreSQL 16** as its primary data store. Database access is handled through **SQLx** with compile-time checked queries. Migrations are managed by SQLx's built-in migration runner.

## Required Extensions

The following PostgreSQL extensions are enabled in the first migration:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation (uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "citext";      -- Case-insensitive text type
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram indexing for fuzzy search
```

## Custom ENUM Types

The schema uses PostgreSQL enums for type-safe status fields:

| Enum | Values |
|------|--------|
| `environment_type` | development, staging, production |
| `text_direction` | ltr, rtl |
| `user_role` | owner, admin, editor, author, viewer |
| `content_status` | draft, in_review, scheduled, published, archived |
| `translation_status` | pending, in_progress, review, approved, outdated |
| `storage_provider` | local, cloudinary, s3, gcs, azure |
| `block_type` | paragraph, heading, image, list, code, quote, embed, divider, table |
| `cv_entry_type` | work, education, volunteer, certification, project |
| `page_type` | static, landing, contact, blog_index, custom |
| `legal_doc_type` | cookie_consent, privacy_policy, terms_of_service, imprint, disclaimer |
| `media_variant_type` | original, thumbnail, small, medium, large, webp, avif |
| `skill_category` | programming, framework, database, devops, language, soft_skill, tool, other |
| `section_type` | hero, features, cta, gallery, testimonials, pricing, faq, contact, custom |
| `audit_action` | create, read, update, delete, publish, unpublish, archive, login, logout, password_change, permission_grant, permission_revoke |
| `api_key_permission` | master, admin, write, read |
| `api_key_status` | active, blocked, expired, revoked |

## Multi-Tenancy

All content in OpenYapper is scoped to a **site**. The `sites` table is the root of the tenant hierarchy, and nearly every content table has a `site_id` foreign key with `ON DELETE CASCADE`.

```
sites
├── blogs
├── pages
│   └── page_sections
├── media
│   └── media_variants
├── navigation_menus
│   └── navigation_items
├── legal_documents
│   └── legal_groups
│       └── legal_items
├── cv_entries
│   └── skills
├── social_links
├── tags
├── categories
├── api_keys
├── webhooks
├── redirects
├── notifications
├── audit_logs
├── site_members
├── site_locales
└── site_settings
```

This design means:
- A single deployment serves multiple independent sites.
- Deleting a site cascades and removes all its content.
- API keys can be scoped to a specific site or granted cross-site access.

## Tables by Domain

### Core Infrastructure

| Table | Purpose |
|-------|---------|
| `sites` | Tenant root -- name, domain, description, default locale |
| `locales` | Global locale registry (en, de, fr, etc.) |
| `site_locales` | Which locales are enabled for a given site |
| `environments` | Environment definitions per site (dev, staging, prod) |
| `users` | User records (synced from Clerk) |
| `site_members` | Maps Clerk users to sites with a role |
| `system_admins` | Clerk user IDs with system-wide admin access |

### Content

| Table | Purpose |
|-------|---------|
| `blogs` | Blog post metadata (slug, status, author, featured image) |
| `blog_localizations` | Localized blog content (title, body, excerpt per locale) |
| `pages` | Page metadata (slug, type, status) |
| `page_sections` | Ordered sections within a page |
| `section_localizations` | Localized section content |
| `documents` | Uploadable document files |
| `content_templates` | Reusable content templates |

### Portfolio

| Table | Purpose |
|-------|---------|
| `cv_entries` | CV / resume entries (work, education, certifications) |
| `skills` | Technical and soft skills with proficiency levels |

### Legal

| Table | Purpose |
|-------|---------|
| `legal_documents` | Legal document containers (privacy policy, imprint, etc.) |
| `legal_groups` | Sections within a legal document |
| `legal_items` | Individual clauses or paragraphs within a group |

### Media

| Table | Purpose |
|-------|---------|
| `media` | Uploaded media files (images, documents, videos) |
| `media_variants` | Generated variants (thumbnail, small, medium, large, webp, avif) |
| `media_folders` | Folder hierarchy for organizing media |

### Navigation

| Table | Purpose |
|-------|---------|
| `navigation_menus` | Named menus per site (primary, footer, sidebar) |
| `navigation_items` | Menu items with parent-child hierarchy |
| `navigation_item_localizations` | Localized titles for menu items |

### Taxonomy

| Table | Purpose |
|-------|---------|
| `tags` | Tags scoped to a site |
| `categories` | Categories scoped to a site |
| `content_tags` | Many-to-many: content to tags |
| `content_categories` | Many-to-many: content to categories |

### Social

| Table | Purpose |
|-------|---------|
| `social_links` | Social media profile links per site |

### Operations

| Table | Purpose |
|-------|---------|
| `api_keys` | API key records (hashed key, permission, rate limits) |
| `audit_logs` | Action audit trail (who did what, when) |
| `webhooks` | Registered webhook endpoints per site |
| `webhook_deliveries` | Delivery attempts and status for each webhook event |
| `notifications` | In-app notifications for site members |
| `redirects` | URL redirect rules (301/302) per site |

## Localization Pattern

OpenYapper uses a **content + localization table** pattern for multilingual content. The base table holds language-independent fields (slug, status, timestamps), while a companion `*_localizations` table holds the translated fields (title, body, excerpt).

```
blogs                          blog_localizations
+--------+---------+           +--------+---------+--------+-------+
| id     | site_id |           | id     | blog_id | locale | title |
| slug   | status  | 1 ───> * | body   | excerpt |        |       |
| ...    | ...     |           | ...    | ...     |        |       |
+--------+---------+           +--------+---------+--------+-------+
```

This pattern is used for:
- Blogs (`blog_localizations`)
- Page sections (`section_localizations`)
- Navigation items (`navigation_item_localizations`)

## Helper Functions

A shared trigger function automatically updates the `updated_at` column on row modification:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';
```

This trigger is attached to all tables that have an `updated_at` column.

## Migrations

Migrations are SQL files in `backend/migrations/`, named with a timestamp prefix. They are run automatically on application startup via `sqlx::migrate!("./migrations")`.

```
backend/migrations/
├── 20240101000000_extensions_and_enums.sql
├── 20240101000001_core_infrastructure.sql
├── 20240101000002_media.sql
├── 20240101000003_content.sql
├── 20240101000004_blogs.sql
├── 20240101000005_cv.sql
├── 20240101000006_pages.sql
├── 20240101000007_legal.sql
├── 20240101000008_social_navigation.sql
├── 20240101000009_taxonomy.sql
├── 20240101000010_audit.sql
├── 20240101000011_api_keys.sql
├── ...
└── 20240101000026_content_templates.sql
```

To create a new migration:

```bash
sqlx migrate add <description>
```

Migrations are applied in order and tracked in the `_sqlx_migrations` table. They are forward-only -- there are no down migrations.

## Indexing Strategy

Key indexes include:
- **Primary keys**: All tables use `UUID` primary keys generated by `uuid_generate_v4()`.
- **Foreign keys**: All `site_id` columns are indexed for fast tenant-scoped queries.
- **Unique constraints**: Slugs are unique per site (e.g., `UNIQUE(site_id, slug)`).
- **Trigram indexes**: Used on text fields for fuzzy search via `pg_trgm`.
- **Composite indexes**: Common query patterns like `(site_id, status)` and `(site_id, locale)` have dedicated indexes.
