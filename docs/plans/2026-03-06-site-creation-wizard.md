# Site Creation Wizard with Feature Modules — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace single-dialog site creation with a 4-step wizard, add module settings to gate sidebar and API endpoints.

**Architecture:** Extend `site_settings` key-value store with `module_*_enabled` flags. Add a generic `ModuleGuard<M>` Rocket request guard using marker traits for API gating. Frontend wizard uses MUI Stepper + react-hook-form + zod (following existing CreateBlogWizard pattern). Sidebar reads module state from the site context API response.

**Tech Stack:** Rust/Rocket (backend), React 19/MUI v7/Vite (frontend), TanStack Query, react-hook-form, zod

**Design doc:** `docs/plans/2026-03-06-site-creation-wizard-design.md`

---

## Task 1: Backend — Module Setting Constants and Defaults

**Files:**
- Modify: `backend/src/models/site_settings.rs`

**Step 1: Add module setting key constants after line 22**

After the existing `KEY_TEAM_FEATURES_PROMPT_DISMISSED` constant, add:

```rust
// Module enable/disable keys
pub const KEY_MODULE_BLOG_ENABLED: &str = "module_blog_enabled";
pub const KEY_MODULE_PAGES_ENABLED: &str = "module_pages_enabled";
pub const KEY_MODULE_CV_ENABLED: &str = "module_cv_enabled";
pub const KEY_MODULE_LEGAL_ENABLED: &str = "module_legal_enabled";
pub const KEY_MODULE_DOCUMENTS_ENABLED: &str = "module_documents_enabled";
```

**Step 2: Add module defaults to the `defaults()` function**

Add these entries inside `defaults()` (after the existing entries, before the closing `m`):

```rust
m.insert(KEY_MODULE_BLOG_ENABLED.into(), serde_json::json!(true));
m.insert(KEY_MODULE_PAGES_ENABLED.into(), serde_json::json!(true));
m.insert(KEY_MODULE_CV_ENABLED.into(), serde_json::json!(false));
m.insert(KEY_MODULE_LEGAL_ENABLED.into(), serde_json::json!(false));
m.insert(KEY_MODULE_DOCUMENTS_ENABLED.into(), serde_json::json!(false));
```

**Step 3: Update existing unit tests**

Update `test_defaults_contains_all_keys` — change `assert_eq!(d.len(), 11)` to `assert_eq!(d.len(), 16)` and add 5 new `assert!` lines for each module key.

Update `test_default_values` — add 5 assertions for module defaults:

```rust
assert_eq!(d[KEY_MODULE_BLOG_ENABLED], serde_json::json!(true));
assert_eq!(d[KEY_MODULE_PAGES_ENABLED], serde_json::json!(true));
assert_eq!(d[KEY_MODULE_CV_ENABLED], serde_json::json!(false));
assert_eq!(d[KEY_MODULE_LEGAL_ENABLED], serde_json::json!(false));
assert_eq!(d[KEY_MODULE_DOCUMENTS_ENABLED], serde_json::json!(false));
```

**Step 4: Run tests**

Run: `cd backend && cargo test --lib models::site_settings::tests`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add backend/src/models/site_settings.rs
git commit -m "feat(settings): add module_*_enabled setting keys and defaults"
```

---

## Task 2: Backend — SiteContextModules DTO

**Files:**
- Modify: `backend/src/dto/site.rs`

**Step 1: Add SiteContextModules struct after SiteContextSuggestions (line 173)**

```rust
/// Module enable/disable flags for the site
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(description = "Content module flags — which modules are enabled for this site")]
pub struct SiteContextModules {
    #[schema(example = true)]
    pub blog: bool,
    #[schema(example = true)]
    pub pages: bool,
    #[schema(example = false)]
    pub cv: bool,
    #[schema(example = false)]
    pub legal: bool,
    #[schema(example = false)]
    pub documents: bool,
}
```

**Step 2: Add `modules` field to SiteContextResponse (after `suggestions` field)**

```rust
pub struct SiteContextResponse {
    // ... existing fields ...
    pub suggestions: SiteContextSuggestions,
    pub modules: SiteContextModules,  // <-- add this
}
```

**Step 3: Update the serialization test `test_site_context_response_serialization`**

Add `modules` field to the test's `SiteContextResponse` construction:

```rust
modules: SiteContextModules {
    blog: true,
    pages: true,
    cv: false,
    legal: false,
    documents: false,
},
```

Add assertion: `assert!(json.contains("\"blog\":true"));`

**Step 4: Run tests**

Run: `cd backend && cargo test --lib dto::site::tests`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add backend/src/dto/site.rs
git commit -m "feat(dto): add SiteContextModules to site context response"
```

---

## Task 3: Backend — Update get_site_context Handler

**Files:**
- Modify: `backend/src/handlers/site.rs`

**Step 1: Add imports**

Add `SiteContextModules` to the existing import from `crate::dto::site`:

```rust
use crate::dto::site::{
    should_show_team_workflow_prompt, CreateSiteRequest, SiteContextFeatures,
    SiteContextModules, SiteContextResponse, SiteContextSuggestions, SiteResponse,
    UpdateSiteRequest,
};
```

Add import for module setting keys:

```rust
use crate::models::site_settings::{
    SiteSetting, KEY_MODULE_BLOG_ENABLED, KEY_MODULE_CV_ENABLED,
    KEY_MODULE_DOCUMENTS_ENABLED, KEY_MODULE_LEGAL_ENABLED, KEY_MODULE_PAGES_ENABLED,
};
```

(Remove the existing standalone `use crate::models::site_settings::SiteSetting;` import.)

**Step 2: Add module extraction in `get_site_context` handler**

After the existing settings extraction block (after line 369, before the `Ok(Json(...))` return), add:

```rust
let module_blog = settings
    .get(KEY_MODULE_BLOG_ENABLED)
    .and_then(|v| v.as_bool())
    .unwrap_or(true);
let module_pages = settings
    .get(KEY_MODULE_PAGES_ENABLED)
    .and_then(|v| v.as_bool())
    .unwrap_or(true);
let module_cv = settings
    .get(KEY_MODULE_CV_ENABLED)
    .and_then(|v| v.as_bool())
    .unwrap_or(false);
let module_legal = settings
    .get(KEY_MODULE_LEGAL_ENABLED)
    .and_then(|v| v.as_bool())
    .unwrap_or(false);
let module_documents = settings
    .get(KEY_MODULE_DOCUMENTS_ENABLED)
    .and_then(|v| v.as_bool())
    .unwrap_or(false);
```

**Step 3: Add `modules` field to the response construction**

In the `Ok(Json(SiteContextResponse { ... }))` block, add after `suggestions`:

```rust
modules: SiteContextModules {
    blog: module_blog,
    pages: module_pages,
    cv: module_cv,
    legal: module_legal,
    documents: module_documents,
},
```

**Step 4: Run backend compile check**

Run: `cd backend && cargo check`

Expected: Compiles without errors.

**Step 5: Commit**

```bash
git add backend/src/handlers/site.rs
git commit -m "feat(handler): include modules in site context response"
```

---

## Task 4: Backend — ModuleGuard Request Guard

**Files:**
- Create: `backend/src/guards/module_guard.rs`
- Modify: `backend/src/guards/mod.rs`

**Step 1: Create the module guard file**

Create `backend/src/guards/module_guard.rs`:

```rust
//! Module guard
//!
//! Generic request guard that checks whether a content module is enabled
//! for the site identified by the `site_id` route parameter.

use std::marker::PhantomData;

use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::site_settings::SiteSetting;
use crate::AppState;

/// Marker trait for content modules.
/// Each module defines its setting key, display name, and default state.
pub trait ModuleMarker: Send + Sync + 'static {
    const SETTING_KEY: &'static str;
    const MODULE_NAME: &'static str;
    const DEFAULT_ENABLED: bool;
}

// ── Module markers ──────────────────────────────────────────────────

pub struct BlogModule;
impl ModuleMarker for BlogModule {
    const SETTING_KEY: &'static str = "module_blog_enabled";
    const MODULE_NAME: &'static str = "blog";
    const DEFAULT_ENABLED: bool = true;
}

pub struct PagesModule;
impl ModuleMarker for PagesModule {
    const SETTING_KEY: &'static str = "module_pages_enabled";
    const MODULE_NAME: &'static str = "pages";
    const DEFAULT_ENABLED: bool = true;
}

pub struct CvModule;
impl ModuleMarker for CvModule {
    const SETTING_KEY: &'static str = "module_cv_enabled";
    const MODULE_NAME: &'static str = "cv";
    const DEFAULT_ENABLED: bool = false;
}

pub struct LegalModule;
impl ModuleMarker for LegalModule {
    const SETTING_KEY: &'static str = "module_legal_enabled";
    const MODULE_NAME: &'static str = "legal";
    const DEFAULT_ENABLED: bool = false;
}

pub struct DocumentsModule;
impl ModuleMarker for DocumentsModule {
    const SETTING_KEY: &'static str = "module_documents_enabled";
    const MODULE_NAME: &'static str = "documents";
    const DEFAULT_ENABLED: bool = false;
}

// ── Guard struct ────────────────────────────────────────────────────

/// Request guard that rejects requests when the content module is disabled.
///
/// Use as a handler parameter for routes with `site_id` in the path:
/// ```ignore
/// fn list_blogs(state: &State<AppState>, site_id: Uuid, _module: ModuleGuard<BlogModule>) { ... }
/// ```
///
/// For routes that resolve `site_id` from an entity, call `ModuleGuard::check()` instead:
/// ```ignore
/// ModuleGuard::<BlogModule>::check(&state.db, resolved_site_id).await?;
/// ```
pub struct ModuleGuard<M: ModuleMarker> {
    _marker: PhantomData<M>,
}

impl<M: ModuleMarker> ModuleGuard<M> {
    /// Check whether the module is enabled for the given site.
    /// Use this for handlers that don't have `site_id` in the route path.
    pub async fn check(pool: &PgPool, site_id: Uuid) -> Result<(), ApiError> {
        let value = SiteSetting::get_value(pool, site_id, M::SETTING_KEY).await?;
        let enabled = value.as_bool().unwrap_or(M::DEFAULT_ENABLED);
        if !enabled {
            return Err(ApiError::Forbidden(format!(
                "The '{}' module is not enabled for this site",
                M::MODULE_NAME
            )));
        }
        Ok(())
    }
}

/// Extract `site_id` UUID from the request URI path.
/// Looks for `/sites/<uuid>/...` pattern.
fn extract_site_id_from_path(path: &str) -> Option<Uuid> {
    let segments: Vec<&str> = path.split('/').collect();
    for (i, seg) in segments.iter().enumerate() {
        if *seg == "sites" {
            if let Some(next) = segments.get(i + 1) {
                return Uuid::parse_str(next).ok();
            }
        }
    }
    None
}

#[rocket::async_trait]
impl<'r, M: ModuleMarker> FromRequest<'r> for ModuleGuard<M> {
    type Error = ApiError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let path = request.uri().path().as_str();
        let site_id = match extract_site_id_from_path(path) {
            Some(id) => id,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    ApiError::Internal(
                        "ModuleGuard requires site_id in route path".to_string(),
                    ),
                ));
            }
        };

        let state = match request.rocket().state::<AppState>() {
            Some(s) => s,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    ApiError::Internal("Application state not found".to_string()),
                ));
            }
        };

        match Self::check(&state.db, site_id).await {
            Ok(()) => Outcome::Success(ModuleGuard {
                _marker: PhantomData,
            }),
            Err(e) => Outcome::Error((Status::Forbidden, e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_site_id_from_path() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        let path = format!("/api/v1/sites/{}/blogs", uuid);
        let result = extract_site_id_from_path(&path);
        assert_eq!(result, Some(Uuid::parse_str(uuid).unwrap()));
    }

    #[test]
    fn test_extract_site_id_no_sites_segment() {
        let result = extract_site_id_from_path("/api/v1/blogs/some-id");
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_site_id_invalid_uuid() {
        let result = extract_site_id_from_path("/api/v1/sites/not-a-uuid/blogs");
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_site_id_sites_at_end() {
        let result = extract_site_id_from_path("/api/v1/sites");
        assert!(result.is_none());
    }

    #[test]
    fn test_module_markers() {
        assert_eq!(BlogModule::SETTING_KEY, "module_blog_enabled");
        assert_eq!(BlogModule::MODULE_NAME, "blog");
        assert!(BlogModule::DEFAULT_ENABLED);

        assert_eq!(CvModule::SETTING_KEY, "module_cv_enabled");
        assert_eq!(CvModule::MODULE_NAME, "cv");
        assert!(!CvModule::DEFAULT_ENABLED);

        assert_eq!(DocumentsModule::SETTING_KEY, "module_documents_enabled");
        assert!(!DocumentsModule::DEFAULT_ENABLED);
    }
}
```

**Step 2: Register the module in `guards/mod.rs`**

Add this line to `backend/src/guards/mod.rs`:

```rust
pub mod module_guard;
```

**Step 3: Run tests**

Run: `cd backend && cargo test --lib guards::module_guard::tests`

Expected: All 5 tests pass.

**Step 4: Commit**

```bash
git add backend/src/guards/module_guard.rs backend/src/guards/mod.rs
git commit -m "feat(guard): add ModuleGuard<M> request guard with marker traits"
```

---

## Task 5: Backend — Add Module Guards to Content Handlers

This task adds `ModuleGuard` to all content handler files. The pattern is:

**For handlers with `site_id` in the route path:** Add `_module: ModuleGuard<XxxModule>` parameter.

**For handlers that resolve `site_id` from an entity:** Add `ModuleGuard::<XxxModule>::check(&state.db, site_id).await?;` after site_id resolution.

### 5a: Blog handlers

**File:** `backend/src/handlers/blog.rs`

**Step 1: Add import**

```rust
use crate::guards::module_guard::{BlogModule, ModuleGuard};
```

**Step 2: Add `_module: ModuleGuard<BlogModule>` parameter to handlers with `site_id` in path**

These handlers have `site_id` as a path parameter:
- `list_blogs` — add `_module: ModuleGuard<BlogModule>` after the last parameter
- `list_published_blogs` — same
- `bulk_blogs` — same
- `rss_feed` — same

**Step 3: Add `ModuleGuard::<BlogModule>::check()` to handlers that resolve site_id from entities**

For `get_blog`, `update_blog`, `delete_blog`, `review_blog`:
After the line that resolves the `site_id` (usually via `Content::find_site_ids()`), add:

```rust
ModuleGuard::<BlogModule>::check(&state.db, site_id).await?;
```

For `create_blog` which gets `site_ids` from the body, add the check after the site_ids are extracted.

**Step 4: Run compile check**

Run: `cd backend && cargo check`

**Step 5: Commit**

```bash
git add backend/src/handlers/blog.rs
git commit -m "feat(blog): add ModuleGuard<BlogModule> to all blog handlers"
```

### 5b: Page handlers

**File:** `backend/src/handlers/page.rs`

Same pattern as 5a but with `PagesModule`:

```rust
use crate::guards::module_guard::{ModuleGuard, PagesModule};
```

Handlers with `site_id` in path: `list_pages`, `bulk_pages` — add `_module: ModuleGuard<PagesModule>`

Handlers resolving site_id: `get_page`, `create_page`, `update_page`, `delete_page`, `review_page` — add `ModuleGuard::<PagesModule>::check(&state.db, site_id).await?;`

**Commit:**

```bash
git add backend/src/handlers/page.rs
git commit -m "feat(page): add ModuleGuard<PagesModule> to all page handlers"
```

### 5c: CV handlers

**File:** `backend/src/handlers/cv.rs`

```rust
use crate::guards::module_guard::{CvModule, ModuleGuard};
```

Handlers with `site_id`: `list_skills`, `list_cv_entries` — add `_module: ModuleGuard<CvModule>`

Handlers resolving site_id: `get_skill`, `create_skill`, `update_skill`, `delete_skill`, `get_cv_entry`, `create_cv_entry`, `update_cv_entry`, `delete_cv_entry`

For CV handlers that don't have site_id easily available (some pass `None` to audit), you'll need to look up the entity's site_id from the model. If site_id is not stored on the entity, use the body's site_id for create, and skip the check for public get endpoints (they're read-only).

**Commit:**

```bash
git add backend/src/handlers/cv.rs
git commit -m "feat(cv): add ModuleGuard<CvModule> to all CV handlers"
```

### 5d: Legal handlers

**File:** `backend/src/handlers/legal.rs`

```rust
use crate::guards::module_guard::{LegalModule, ModuleGuard};
```

Handlers with `site_id`: `list_legal_documents`, `get_cookie_consent`, `create_legal_document`, `get_legal_document_by_slug` — add `_module: ModuleGuard<LegalModule>`

Handlers resolving site_id (via `LegalDocument::resolve_site_id()`): `update_legal_document`, `delete_legal_document`, `create_legal_group`, `update_legal_group`, `delete_legal_group`, `create_legal_item`, `update_legal_item`, `delete_legal_item`

For public GET endpoints without site_id (`get_legal_document`, `get_legal_groups`, `get_legal_items`): resolve site_id from the entity and add the check.

**Commit:**

```bash
git add backend/src/handlers/legal.rs
git commit -m "feat(legal): add ModuleGuard<LegalModule> to all legal handlers"
```

### 5e: Document handlers

**File:** `backend/src/handlers/document.rs`

```rust
use crate::guards::module_guard::{DocumentsModule, ModuleGuard};
```

Handlers with `site_id`: `list_document_folders`, `create_document_folder`, `list_documents`, `create_document` — add `_module: ModuleGuard<DocumentsModule>`

Handlers resolving site_id: `update_document_folder`, `delete_document_folder`, `get_document`, `update_document`, `delete_document`, `create_document_localization`, `update_document_localization`, `delete_document_localization`

Blog-document junction handlers (`list_blog_documents`, `assign_blog_document`, `unassign_blog_document`): These cross modules — guard with `DocumentsModule` since they're about document management.

**Commit:**

```bash
git add backend/src/handlers/document.rs
git commit -m "feat(document): add ModuleGuard<DocumentsModule> to all document handlers"
```

### 5f: Run full backend test suite

Run: `cd backend && cargo fmt && cargo clippy -- -D warnings && cargo test --lib`

Expected: All pass. Fix any issues before proceeding.

**Commit (if fmt/clippy changes):**

```bash
git add -u backend/src/
git commit -m "style(backend): format and clippy fixes for module guards"
```

---

## Task 6: Backend — OpenAPI Registration

**File:** `backend/src/openapi.rs`

**Step 1: Add SiteContextModules to schemas**

Find the existing site DTO schema registrations (around line 309-311) and add:

```rust
crate::dto::site::SiteContextModules,
```

**Step 2: Run compile check**

Run: `cd backend && cargo check`

**Step 3: Commit**

```bash
git add backend/src/openapi.rs
git commit -m "docs(openapi): register SiteContextModules schema"
```

---

## Task 7: Frontend — Types and API Service

**Files:**
- Modify: `admin/src/types/api.ts`
- Modify: `admin/src/services/api.ts`
- Modify: `admin/src/test/setup.ts`

**Step 1: Add SiteContext types to `types/api.ts`**

After the `UpdateSiteRequest` interface (around line 279), add:

```typescript
// Site Context (progressive disclosure)
export interface SiteContextFeatures {
  editorial_workflow: boolean;
  scheduling: boolean;
  versioning: boolean;
  analytics: boolean;
}

export interface SiteContextModules {
  blog: boolean;
  pages: boolean;
  cv: boolean;
  legal: boolean;
  documents: boolean;
}

export interface SiteContextSuggestions {
  show_team_workflow_prompt: boolean;
}

export interface SiteContextResponse {
  member_count: number;
  current_user_role: string;
  features: SiteContextFeatures;
  suggestions: SiteContextSuggestions;
  modules: SiteContextModules;
}
```

**Step 2: Add `getSiteContext` method to `api.ts`**

After the `deleteSite` method (around line 260), add:

```typescript
getSiteContext(siteId: string): Promise<SiteContextResponse> {
  return this.request<SiteContextResponse>(`/sites/${siteId}/context`);
},
```

**Step 3: Add mock to `admin/src/test/setup.ts`**

Find the `apiService` mock object and add:

```typescript
getSiteContext: vi.fn(),
```

**Step 4: Run typecheck**

Run: `cd admin && npm run typecheck`

Expected: No errors.

**Step 5: Commit**

```bash
git add admin/src/types/api.ts admin/src/services/api.ts admin/src/test/setup.ts
git commit -m "feat(api): add SiteContext types and getSiteContext method"
```

---

## Task 8: Frontend — Site Context Hook

**Files:**
- Create: `admin/src/hooks/useSiteContextData.ts`

**Step 1: Create the hook**

This hook fetches the site context API response for the selected site. It's separate from the existing `useSiteContext()` (which manages site selection state).

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { SiteContextResponse } from '@/types/api';

const DEFAULT_MODULES = {
  blog: true,
  pages: true,
  cv: false,
  legal: false,
  documents: false,
};

const DEFAULT_CONTEXT: SiteContextResponse = {
  member_count: 0,
  current_user_role: 'viewer',
  features: {
    editorial_workflow: false,
    scheduling: true,
    versioning: true,
    analytics: false,
  },
  suggestions: { show_team_workflow_prompt: false },
  modules: DEFAULT_MODULES,
};

export function useSiteContextData() {
  const { selectedSiteId } = useSiteContext();

  const query = useQuery({
    queryKey: ['siteContext', selectedSiteId],
    queryFn: () => apiService.getSiteContext(selectedSiteId),
    enabled: !!selectedSiteId,
    staleTime: 30_000,
  });

  return {
    ...query,
    context: query.data ?? DEFAULT_CONTEXT,
    modules: query.data?.modules ?? DEFAULT_MODULES,
  };
}
```

**Step 2: Run typecheck**

Run: `cd admin && npm run typecheck`

**Step 3: Commit**

```bash
git add admin/src/hooks/useSiteContextData.ts
git commit -m "feat(hook): add useSiteContextData hook for site context API"
```

---

## Task 9: Frontend — Site Creation Wizard

**Files:**
- Create: `admin/src/components/sites/SiteCreationWizard.tsx`
- Modify: `admin/src/pages/Sites.tsx`

This is the largest task. Follow the existing `CreateBlogWizard.tsx` pattern (MUI Stepper, react-hook-form, zod).

**Step 1: Create the wizard component**

Create `admin/src/components/sites/SiteCreationWizard.tsx` with:

- 4 steps: Basics, Content Modules, Team & Workflow, Languages
- Stepper navigation (Next/Back/Create)
- react-hook-form with zod schema
- Step validation via `trigger(STEP_FIELDS[step])`

**Form schema fields:**

```typescript
const wizardSchema = z.object({
  // Step 1: Basics
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  description: z.string().max(1000).optional(),
  // Step 2: Content Modules
  modules: z.object({
    blog: z.boolean(),
    pages: z.boolean(),
    cv: z.boolean(),
    legal: z.boolean(),
    documents: z.boolean(),
  }),
  // Step 3: Team & Workflow
  workflowMode: z.enum(['solo', 'team']),
  // Step 4: Languages
  locales: z.array(z.object({
    locale_id: z.string(),
    is_default: z.boolean(),
    url_prefix: z.string().optional(),
  })).min(1, 'At least one language is required'),
});
```

**Step field mapping:**

```typescript
const STEP_FIELDS = [
  ['name', 'slug', 'description'],
  ['modules'],
  ['workflowMode'],
  ['locales'],
] as const;
```

**Submit handler:**

1. Call `apiService.createSite({ name, slug, description, locales })`
2. Call `apiService.updateSiteSettings(siteId, { settings })` to set:
   - `module_blog_enabled`, `module_pages_enabled`, etc. from form values
   - `editorial_workflow_enabled: true` if `workflowMode === 'team'`
3. Invalidate queries, show success snackbar, navigate to new site

**Step 2: Replace SiteFormDialog for creation in Sites.tsx**

In `admin/src/pages/Sites.tsx`:
- Keep `SiteFormDialog` for editing (when `editingSite` is set)
- Replace the create trigger to open `SiteCreationWizard` instead
- Add `wizardOpen` state: `const [wizardOpen, setWizardOpen] = useState(false);`
- Wire the "Create Site" button to `setWizardOpen(true)`

**Step 3: Run typecheck and lint**

Run: `cd admin && npm run typecheck && npm run lint`

**Step 4: Commit**

```bash
git add admin/src/components/sites/SiteCreationWizard.tsx admin/src/pages/Sites.tsx
git commit -m "feat(wizard): add 4-step site creation wizard"
```

---

## Task 10: Frontend — Sidebar Module Gating

**Files:**
- Modify: `admin/src/components/Layout.tsx`

**Step 1: Import the hook**

```typescript
import { useSiteContextData } from '@/hooks/useSiteContextData';
```

**Step 2: Get modules from hook**

Inside the Layout component, add:

```typescript
const { modules } = useSiteContextData();
```

**Step 3: Conditionally render content menu items**

Find the sidebar menu items for Blog, Pages, CV, Legal/Documents and wrap them:

```typescript
{modules.blog && (
  <ListItemButton component={Link} to="/blogs">
    {/* ... existing Blog menu item ... */}
  </ListItemButton>
)}
{modules.pages && (
  <ListItemButton component={Link} to="/pages">
    {/* ... existing Pages menu item ... */}
  </ListItemButton>
)}
{modules.cv && (
  <ListItemButton component={Link} to="/cv">
    {/* ... existing CV menu item ... */}
  </ListItemButton>
)}
{modules.legal && (
  /* Legal nav item if there's a dedicated one */
)}
{modules.documents && (
  <ListItemButton component={Link} to="/documents">
    {/* ... existing Documents menu item ... */}
  </ListItemButton>
)}
```

Items that are always visible (Dashboard, My Drafts, Navigation, Taxonomy, Social Links, Redirects, Webhooks, Activity, Members, Settings) remain unchanged.

**Step 4: Run typecheck**

Run: `cd admin && npm run typecheck`

**Step 5: Commit**

```bash
git add admin/src/components/Layout.tsx
git commit -m "feat(sidebar): gate menu items by enabled modules"
```

---

## Task 11: Frontend — Settings > Modules Page

**Files:**
- Create: `admin/src/components/settings/ModulesSettings.tsx`
- Modify: `admin/src/pages/Settings.tsx`

**Step 1: Create ModulesSettings component**

Create `admin/src/components/settings/ModulesSettings.tsx`:

```typescript
// Module toggle switches for enabling/disabling content modules.
// Each toggle calls updateSiteSettings to flip the corresponding key.
```

Component structure:
- List of module cards, each with: name, description, Switch toggle
- Uses `useSiteContextData()` for current state
- Uses `useMutation` to call `apiService.updateSiteSettings()` on toggle
- Invalidates `['siteContext', siteId]` and `['siteSettings', siteId]` on success
- Shows info alert: "Disabling a module hides it from the UI but does not delete existing data."

Module definitions (display data):

```typescript
const MODULES = [
  { key: 'module_blog_enabled', name: 'Blog', description: 'Write and publish blog posts', field: 'blog' as const },
  { key: 'module_pages_enabled', name: 'Pages', description: 'Build static pages with sections', field: 'pages' as const },
  { key: 'module_cv_enabled', name: 'CV / Resume', description: 'Structured resume and portfolio data', field: 'cv' as const },
  { key: 'module_legal_enabled', name: 'Legal Docs', description: 'Privacy policies, terms of service', field: 'legal' as const },
  { key: 'module_documents_enabled', name: 'Documents', description: 'File attachments with versioning', field: 'documents' as const },
] as const;
```

**Step 2: Add Modules tab to Settings.tsx**

In `admin/src/pages/Settings.tsx`, add a new tab definition in the tabs array (around line 820):

```typescript
{
  key: 'modules',
  icon: <ExtensionIcon />,
  label: 'Modules',
  content: <ModulesSettings />,
}
```

Show this tab only when `isAdmin && selectedSiteId` (same condition as Site Settings tab).

**Step 3: Run typecheck and lint**

Run: `cd admin && npm run typecheck && npm run lint`

**Step 4: Commit**

```bash
git add admin/src/components/settings/ModulesSettings.tsx admin/src/pages/Settings.tsx
git commit -m "feat(settings): add Modules tab for toggling content modules"
```

---

## Task 12: Frontend — Wizard Tests

**Files:**
- Create: `admin/src/components/sites/__tests__/SiteCreationWizard.test.tsx`

**Step 1: Write tests**

Follow `write-admin-tests` skill patterns:

```typescript
import { renderWithProviders } from '@/test/test-utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { apiService } from '@/services/api';
import { SiteCreationWizard } from '../SiteCreationWizard';
```

Test cases:
1. Renders step 1 (Basics) on open
2. Validates required fields before advancing
3. Navigates between steps with Next/Back
4. Shows module checkboxes in step 2 with blog/pages checked by default
5. Shows Solo/Team radio in step 3 with Solo as default
6. Shows locale picker in step 4
7. Calls createSite + updateSiteSettings on submit
8. Closes dialog on successful creation

**Step 2: Run tests**

Run: `cd admin && npm test -- --run src/components/sites/__tests__/SiteCreationWizard.test.tsx`

Expected: Tests pass (or fail initially for TDD, then implement fixes).

**Step 3: Commit**

```bash
git add admin/src/components/sites/__tests__/SiteCreationWizard.test.tsx
git commit -m "test(wizard): add site creation wizard tests"
```

---

## Task 13: Verification Gate

**REQUIRED SUB-SKILL:** Apply `superpowers:verification-before-completion`

**Step 1: Run full backend checks**

```bash
cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test --lib
```

**Step 2: Run full frontend checks**

```bash
cd admin && npm run typecheck && npm run lint && npm test
```

**Step 3: Review changes against issue acceptance criteria**

```
[ ] Site creation uses a step-by-step wizard
[ ] Users can select which content modules to enable
[ ] "Solo" vs "Small team" choice configures workflow features
[ ] Language selection works in wizard
[ ] Modules can be enabled/disabled later in Settings > Modules
[ ] Sidebar only shows navigation for enabled modules
[ ] Disabled modules hide UI but preserve existing data
[ ] API returns appropriate response for disabled module endpoints
[ ] Module state is included in the site context endpoint
```

**Step 4: Final commit if needed**

```bash
git add -u
git commit -m "fix: address verification findings"
```
