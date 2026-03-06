# Site Creation Wizard with Feature Selection

**Issue:** #48
**Date:** 2026-03-06
**Status:** Approved
**Scope:** Full-stack (backend + frontend)

## Summary

Replace the single-dialog site creation flow with a 4-step wizard that lets users choose which content modules to enable. Modules can be toggled later from Settings. The sidebar and API endpoints are gated by module state.

## Data Model

Extend the existing `site_settings` key-value store with `module_*_enabled` keys. No new tables.

### Module Setting Keys

| Key | Default | Description |
|-----|---------|-------------|
| `module_blog_enabled` | `true` | Blog posts |
| `module_pages_enabled` | `true` | Static pages with sections |
| `module_cv_enabled` | `false` | Structured resume data |
| `module_legal_enabled` | `false` | Privacy policy, terms |
| `module_documents_enabled` | `false` | File attachments and versioning |

### Always-Visible (Not Gatable)

Dashboard, My Drafts, Navigation, Taxonomy, Social Links, Redirects, Webhooks, Activity, Members, Settings.

### Existing Feature Flags (Unchanged)

`editorial_workflow_enabled`, `scheduling_enabled`, `versioning_enabled`, `analytics_enabled` remain as-is. The wizard's "Small team" choice sets `editorial_workflow_enabled = true`.

## Backend: Module Guard

Generic Rocket request guard using marker traits:

```rust
pub trait ModuleMarker: Send + Sync + 'static {
    const SETTING_KEY: &'static str;
    const MODULE_NAME: &'static str;
}

pub struct BlogModule;
impl ModuleMarker for BlogModule {
    const SETTING_KEY: &'static str = "module_blog_enabled";
    const MODULE_NAME: &'static str = "blog";
}

pub struct ModuleGuard<M: ModuleMarker>(PhantomData<M>);
```

The guard extracts `site_id` from the route, queries `site_settings`, and returns HTTP 403 with `{"error": "module_disabled", "message": "The '<module>' module is not enabled for this site"}` if the module is disabled.

### Modules with Guards

| Module | Marker | Handlers affected |
|--------|--------|-------------------|
| Blog | `BlogModule` | `handlers/blog.rs` |
| Pages | `PagesModule` | `handlers/page.rs` |
| CV | `CvModule` | `handlers/cv.rs` |
| Legal | `LegalModule` | `handlers/legal.rs` |
| Documents | `DocumentsModule` | `handlers/document.rs` |

## Backend: Site Context Extension

Extend `SiteContextResponse` to include module state:

```rust
pub struct SiteContextModules {
    pub blog: bool,
    pub pages: bool,
    pub cv: bool,
    pub legal: bool,
    pub documents: bool,
}
```

Added to `SiteContextResponse.modules`. Frontend reads this to gate sidebar items without extra API calls.

## Frontend: Site Creation Wizard

4-step MUI Stepper dialog following existing wizard patterns (CreateBlogWizard, CreatePageWizard):

### Step 1: Basics
- Site name (required)
- Slug (required, validated)
- Description (optional)

### Step 2: Content Modules
- Checkboxes for: Blog, Pages, CV/Resume, Legal Docs, Documents
- Blog and Pages checked by default
- Helper text: "You can enable more modules later in Settings."

### Step 3: Team & Workflow
- Radio group: "Solo" / "Small team"
- "Small team" description mentions editorial workflow, review/approval
- Solo is default

### Step 4: Languages
- Primary language selector (from available locales)
- Checkbox to enable multiple languages
- Additional language multi-select (shown when multi-lang enabled)

### Wizard Submit Payload

The wizard calls `createSite` with the existing fields, then calls `updateSiteSettings` to set module flags and workflow preference based on wizard selections.

## Frontend: Sidebar Gating

`Layout.tsx` reads `siteContext.modules` and conditionally renders menu items:

- Blog menu item: visible when `modules.blog` is true
- Pages menu item: visible when `modules.pages` is true
- CV menu item: visible when `modules.cv` is true
- Legal shows inline in Settings (already there), but the dedicated nav item: gated by `modules.legal`
- Documents menu item: visible when `modules.documents` is true

## Frontend: Settings > Modules Page

New section/tab under Settings with toggle switches for each module. Each toggle calls `updateSiteSettings` to flip the corresponding `module_*_enabled` key. Shows module name, description, and current state. Includes a note that disabling a module hides UI but preserves data.

## Module Defaults from Wizard Choices

| Wizard selections | Modules enabled |
|---|---|
| Default (no changes) | blog, pages |
| User checks CV | + cv |
| User checks Legal | + legal |
| User checks Documents | + documents |
| "Small team" selected | editorial_workflow_enabled = true |

## Data Preservation

Disabling a module flips `module_*_enabled` to false. No data is deleted. Re-enabling restores full access to existing content.

## Files to Change

### Backend
- `models/site_settings.rs` — Add MODULE_* constants and defaults
- `dto/site.rs` — Add `SiteContextModules` struct, extend `SiteContextResponse`
- `handlers/site.rs` — Update `get_site_context` to include modules
- New `guards/module_guard.rs` — `ModuleGuard<M>` + marker traits
- `guards/mod.rs` — Register module_guard module
- `handlers/blog.rs` — Add `ModuleGuard<BlogModule>` to all handlers
- `handlers/page.rs` — Add `ModuleGuard<PagesModule>` to all handlers
- `handlers/cv.rs` — Add `ModuleGuard<CvModule>` to all handlers
- `handlers/legal.rs` — Add `ModuleGuard<LegalModule>` to all handlers
- `handlers/document.rs` — Add `ModuleGuard<DocumentsModule>` to all handlers
- `openapi.rs` — Register new DTOs

### Frontend
- `types/api.ts` — Add `SiteContextModules`, extend context types
- New `components/sites/SiteCreationWizard.tsx` — 4-step wizard
- `components/sites/SiteCreationWizard.schema.ts` — Zod validation
- `pages/Sites.tsx` — Replace SiteFormDialog with wizard for creation
- `components/Layout.tsx` — Gate sidebar items by modules
- `pages/Settings.tsx` — Add Modules tab/section
- New `components/settings/ModulesSettings.tsx` — Module toggles UI
- `services/api.ts` — Add site context fetch method if not present
- `store/SiteContext.tsx` — Extend to fetch and expose module state

## Dependencies

- #36 (Site context API) — already implemented on this branch
- #37 (Adaptive admin UI) — modules drive sidebar visibility

## Follow-up Issues (Post-Implementation)

- Refactor existing feature flags to use Rocket request guard pattern
- #49 (Onboarding survey) — survey answers pre-configure wizard module selection
