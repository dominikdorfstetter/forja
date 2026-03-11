# Contextual Help System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a contextual help system with a help menu, re-launchable quick tour, and keyboard shortcuts dialog to the admin dashboard.

**Architecture:** Help state (tour completion, dismissed hotspots/field help) is stored in the existing `user_preferences` JSON blob — following the exact same pattern as the onboarding survey. Dedicated DTOs and endpoints provide clean API separation. Frontend uses a `HelpStateContext` with TanStack Query for fetching and mutations. Tour UI is built with MUI Popper/Backdrop (no external library).

**Tech Stack:** Rust/Rocket (backend), React 19, MUI v7, TanStack Query, i18next

**Design revision:** The original design proposed a dedicated `user_onboarding` table. During implementation planning, we discovered that the existing onboarding survey already stores state in the `user_preferences` JSON blob via dedicated DTOs. Following this pattern eliminates the need for a migration and reduces backend work by ~80%.

---

## Group 1: Backend — Help State Endpoints

### Task 1.1: Add help state keys to user_preferences model

**Files:**
- Modify: `backend/src/models/user_preferences.rs`

**Step 1: Add key constants**

Add below the existing onboarding key constants (after line 20):

```rust
// Help system keys (stored in the same preferences JSON blob)
pub const KEY_HELP_TOUR_COMPLETED: &str = "help_tour_completed";
pub const KEY_HELP_HOTSPOTS_SEEN: &str = "help_hotspots_seen";
pub const KEY_HELP_FIELD_HELP_SEEN: &str = "help_field_help_seen";
```

**Step 2: Commit**

```bash
git add backend/src/models/user_preferences.rs
git commit -m "feat(help): add help state keys to user_preferences model"
```

---

### Task 1.2: Create help_state DTO

**Files:**
- Create: `backend/src/dto/help_state.rs`
- Modify: `backend/src/dto/mod.rs`

**Step 1: Create the DTO file**

```rust
//! Help state DTOs
//!
//! Request/response types for the contextual help system.
//! Data is stored in the user_preferences JSON blob but exposed
//! through dedicated DTOs for clean API separation.

use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::models::user_preferences::{
    KEY_HELP_FIELD_HELP_SEEN, KEY_HELP_HOTSPOTS_SEEN, KEY_HELP_TOUR_COMPLETED,
};

/// Response with the user's help system state
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Help system state for the authenticated user")]
pub struct HelpStateResponse {
    /// Whether the quick tour has been completed
    #[schema(example = false)]
    pub tour_completed: bool,

    /// IDs of hotspots the user has dismissed
    #[schema(example = json!(["dashboard_site_selector", "editor_slash_commands"]))]
    pub hotspots_seen: Vec<String>,

    /// IDs of field help tooltips the user has dismissed
    #[schema(example = json!(["editor_slug_field"]))]
    pub field_help_seen: Vec<String>,
}

impl HelpStateResponse {
    /// Build from the effective preferences JSON blob.
    pub fn from_json(json: &serde_json::Value) -> Self {
        Self {
            tour_completed: json
                .get(KEY_HELP_TOUR_COMPLETED)
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            hotspots_seen: json
                .get(KEY_HELP_HOTSPOTS_SEEN)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            field_help_seen: json
                .get(KEY_HELP_FIELD_HELP_SEEN)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
        }
    }
}

/// Request to update help system state (all fields optional)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Update help system state")]
pub struct UpdateHelpStateRequest {
    /// Mark the tour as completed
    #[schema(example = true)]
    pub tour_completed: Option<bool>,

    /// Dismiss a single hotspot by ID (appended to hotspots_seen)
    #[validate(length(max = 100))]
    #[schema(example = "dashboard_site_selector")]
    pub dismiss_hotspot: Option<String>,

    /// Dismiss a single field help tooltip by ID (appended to field_help_seen)
    #[validate(length(max = 100))]
    #[schema(example = "editor_slug_field")]
    pub dismiss_field_help: Option<String>,
}

impl UpdateHelpStateRequest {
    /// Convert to a JSON object for merging into user_preferences.
    ///
    /// For array fields (hotspots_seen, field_help_seen), the caller must
    /// pass the current arrays so that the new item can be appended.
    pub fn to_json(
        &self,
        current_hotspots: &[String],
        current_field_help: &[String],
    ) -> serde_json::Value {
        let mut map = serde_json::Map::new();

        if let Some(v) = self.tour_completed {
            map.insert(KEY_HELP_TOUR_COMPLETED.to_string(), serde_json::json!(v));
        }

        if let Some(ref id) = self.dismiss_hotspot {
            let mut hotspots: Vec<String> = current_hotspots.to_vec();
            if !hotspots.contains(id) {
                hotspots.push(id.clone());
            }
            map.insert(
                KEY_HELP_HOTSPOTS_SEEN.to_string(),
                serde_json::json!(hotspots),
            );
        }

        if let Some(ref id) = self.dismiss_field_help {
            let mut field_help: Vec<String> = current_field_help.to_vec();
            if !field_help.contains(id) {
                field_help.push(id.clone());
            }
            map.insert(
                KEY_HELP_FIELD_HELP_SEEN.to_string(),
                serde_json::json!(field_help),
            );
        }

        serde_json::Value::Object(map)
    }

    /// Build a JSON object that resets all help state to defaults.
    pub fn reset_json() -> serde_json::Value {
        serde_json::json!({
            KEY_HELP_TOUR_COMPLETED: false,
            KEY_HELP_HOTSPOTS_SEEN: [],
            KEY_HELP_FIELD_HELP_SEEN: [],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_json_defaults() {
        let json = serde_json::json!({});
        let resp = HelpStateResponse::from_json(&json);
        assert!(!resp.tour_completed);
        assert!(resp.hotspots_seen.is_empty());
        assert!(resp.field_help_seen.is_empty());
    }

    #[test]
    fn test_from_json_populated() {
        let json = serde_json::json!({
            "help_tour_completed": true,
            "help_hotspots_seen": ["dashboard_site_selector", "editor_slash"],
            "help_field_help_seen": ["editor_slug_field"]
        });
        let resp = HelpStateResponse::from_json(&json);
        assert!(resp.tour_completed);
        assert_eq!(resp.hotspots_seen, vec!["dashboard_site_selector", "editor_slash"]);
        assert_eq!(resp.field_help_seen, vec!["editor_slug_field"]);
    }

    #[test]
    fn test_to_json_tour_completed() {
        let req = UpdateHelpStateRequest {
            tour_completed: Some(true),
            dismiss_hotspot: None,
            dismiss_field_help: None,
        };
        let json = req.to_json(&[], &[]);
        assert_eq!(json["help_tour_completed"], true);
    }

    #[test]
    fn test_to_json_dismiss_hotspot_appends() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: Some("new_hotspot".to_string()),
            dismiss_field_help: None,
        };
        let current = vec!["existing".to_string()];
        let json = req.to_json(&current, &[]);
        let arr = json["help_hotspots_seen"].as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0], "existing");
        assert_eq!(arr[1], "new_hotspot");
    }

    #[test]
    fn test_to_json_dismiss_hotspot_idempotent() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: Some("existing".to_string()),
            dismiss_field_help: None,
        };
        let current = vec!["existing".to_string()];
        let json = req.to_json(&current, &[]);
        let arr = json["help_hotspots_seen"].as_array().unwrap();
        assert_eq!(arr.len(), 1);
    }

    #[test]
    fn test_to_json_dismiss_field_help() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: None,
            dismiss_field_help: Some("slug_field".to_string()),
        };
        let json = req.to_json(&[], &[]);
        let arr = json["help_field_help_seen"].as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0], "slug_field");
    }

    #[test]
    fn test_reset_json() {
        let json = UpdateHelpStateRequest::reset_json();
        assert_eq!(json["help_tour_completed"], false);
        assert!(json["help_hotspots_seen"].as_array().unwrap().is_empty());
        assert!(json["help_field_help_seen"].as_array().unwrap().is_empty());
    }

    #[test]
    fn test_to_json_empty_request() {
        let req = UpdateHelpStateRequest {
            tour_completed: None,
            dismiss_hotspot: None,
            dismiss_field_help: None,
        };
        let json = req.to_json(&[], &[]);
        assert!(json.as_object().unwrap().is_empty());
    }

    #[test]
    fn test_response_serialization() {
        let resp = HelpStateResponse {
            tour_completed: true,
            hotspots_seen: vec!["a".to_string()],
            field_help_seen: vec![],
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"tour_completed\":true"));
        assert!(json.contains("\"hotspots_seen\":[\"a\"]"));
        assert!(json.contains("\"field_help_seen\":[]"));
    }
}
```

**Step 2: Register the module in dto/mod.rs**

Add after line 27 (`pub mod onboarding;`):

```rust
pub mod help_state;
```

**Step 3: Run tests**

```bash
cd backend && cargo test --lib dto::help_state::tests
```

Expected: all 8 tests pass.

**Step 4: Commit**

```bash
git add backend/src/dto/help_state.rs backend/src/dto/mod.rs
git commit -m "feat(help): add help state DTOs"
```

---

### Task 1.3: Add help state handlers to auth.rs

**Files:**
- Modify: `backend/src/handlers/auth.rs`

**Step 1: Add import**

Add to the imports at the top of `auth.rs`:

```rust
use crate::dto::help_state::{HelpStateResponse, UpdateHelpStateRequest};
```

**Step 2: Add get_help_state handler**

Add after the `complete_onboarding` function (after line ~444):

```rust
/// Get the current user's help system state.
///
/// Returns tour completion status and dismissed hotspots/field help.
/// Only available for Clerk-authenticated users.
#[utoipa::path(
    tag = "Auth",
    operation_id = "get_help_state",
    description = "Return the help system state for the authenticated user",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Help state", body = HelpStateResponse),
        (status = 400, description = "Only available for Clerk-authenticated users"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
#[get("/auth/help-state")]
pub async fn get_help_state(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Json<HelpStateResponse>, crate::errors::ApiError> {
    let clerk_user_id = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => clerk_user_id,
        AuthSource::ApiKey => {
            return Err(crate::errors::ApiError::BadRequest(
                "Help state is only available for Clerk-authenticated users".to_string(),
            ));
        }
    };

    let effective = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
    Ok(Json(HelpStateResponse::from_json(&effective)))
}

/// Update the user's help system state.
///
/// Supports marking tour complete, dismissing hotspots, and dismissing field help.
/// Only available for Clerk-authenticated users.
#[utoipa::path(
    tag = "Auth",
    operation_id = "update_help_state",
    description = "Update the help system state for the authenticated user",
    security(("bearer_auth" = [])),
    request_body = UpdateHelpStateRequest,
    responses(
        (status = 200, description = "Updated help state", body = HelpStateResponse),
        (status = 400, description = "Validation error or not a Clerk user"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
#[patch("/auth/help-state", data = "<body>")]
pub async fn update_help_state(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
    body: Json<UpdateHelpStateRequest>,
) -> Result<Json<HelpStateResponse>, crate::errors::ApiError> {
    let clerk_user_id = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => clerk_user_id,
        AuthSource::ApiKey => {
            return Err(crate::errors::ApiError::BadRequest(
                "Help state is only available for Clerk-authenticated users".to_string(),
            ));
        }
    };

    body.validate()?;

    // Read current state to support array appending
    let current_prefs = UserPreferences::get_effective(&state.db, clerk_user_id).await?;
    let current_state = HelpStateResponse::from_json(&current_prefs);

    let partial = body.into_inner().to_json(
        &current_state.hotspots_seen,
        &current_state.field_help_seen,
    );
    let effective = UserPreferences::upsert(&state.db, clerk_user_id, partial).await?;
    Ok(Json(HelpStateResponse::from_json(&effective)))
}

/// Reset the user's help system state.
///
/// Resets tour completion and clears all dismissed hotspots and field help.
/// Only available for Clerk-authenticated users.
#[utoipa::path(
    tag = "Auth",
    operation_id = "reset_help_state",
    description = "Reset the help system state to defaults",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Reset help state", body = HelpStateResponse),
        (status = 400, description = "Only available for Clerk-authenticated users"),
        (status = 401, description = "Missing or invalid credentials")
    )
)]
#[post("/auth/help-state/reset")]
pub async fn reset_help_state(
    auth: AuthenticatedKey,
    state: &rocket::State<AppState>,
) -> Result<Json<HelpStateResponse>, crate::errors::ApiError> {
    let clerk_user_id = match &auth.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => clerk_user_id,
        AuthSource::ApiKey => {
            return Err(crate::errors::ApiError::BadRequest(
                "Help state is only available for Clerk-authenticated users".to_string(),
            ));
        }
    };

    let partial = UpdateHelpStateRequest::reset_json();
    let effective = UserPreferences::upsert(&state.db, clerk_user_id, partial).await?;
    Ok(Json(HelpStateResponse::from_json(&effective)))
}
```

**Step 3: Add handlers to the routes() function**

Find the `routes!` macro at the bottom of `auth.rs` and add the three new handlers:

```rust
    routes![
        get_me,
        get_profile,
        get_preferences,
        update_preferences,
        get_onboarding,
        complete_onboarding,
        get_help_state,
        update_help_state,
        reset_help_state,
        export_user_data,
        delete_account
    ]
```

**Step 4: Commit**

```bash
git add backend/src/handlers/auth.rs
git commit -m "feat(help): add help state handler endpoints"
```

---

### Task 1.4: Register in openapi.rs

**Files:**
- Modify: `backend/src/openapi.rs`

**Step 1: Add paths**

In the `paths(...)` section, after `complete_onboarding` (around line 59), add:

```rust
        crate::handlers::auth::get_help_state,
        crate::handlers::auth::update_help_state,
        crate::handlers::auth::reset_help_state,
```

**Step 2: Add schemas**

In the `components(schemas(...))` section, after the Onboarding DTOs (around line 292), add:

```rust
        // Help State DTOs
        crate::dto::help_state::HelpStateResponse,
        crate::dto::help_state::UpdateHelpStateRequest,
```

**Step 3: Run backend checks**

```bash
cd backend && cargo fmt && cargo clippy -- -D warnings && cargo test --lib
```

Expected: all pass.

**Step 4: Commit**

```bash
git add backend/src/openapi.rs
git commit -m "feat(help): register help state endpoints in OpenAPI spec"
```

---

## Group 2: Frontend — Types & API Service

### Task 2.1: Add HelpState types

**Files:**
- Modify: `admin/src/types/api.ts`

**Step 1: Add types**

Add near the end of the file (before any closing comments):

```typescript
// Help system state
export interface HelpStateResponse {
  tour_completed: boolean;
  hotspots_seen: string[];
  field_help_seen: string[];
}

export interface UpdateHelpStateRequest {
  tour_completed?: boolean;
  dismiss_hotspot?: string;
  dismiss_field_help?: string;
}
```

---

### Task 2.2: Add API service methods

**Files:**
- Modify: `admin/src/services/api.ts`

**Step 1: Import the new types**

Add `HelpStateResponse` and `UpdateHelpStateRequest` to the imports from `@/types/api`.

**Step 2: Add methods**

After the existing onboarding methods (around line 257), add:

```typescript
  // Help state
  async getHelpState(): Promise<HelpStateResponse> {
    return apiRequest<HelpStateResponse>('GET', '/auth/help-state');
  }

  async updateHelpState(data: UpdateHelpStateRequest): Promise<HelpStateResponse> {
    return apiRequest<HelpStateResponse>('PATCH', '/auth/help-state', data);
  }

  async resetHelpState(): Promise<HelpStateResponse> {
    return apiRequest<HelpStateResponse>('POST', '/auth/help-state/reset');
  }
```

---

### Task 2.3: Add test setup mocks

**Files:**
- Modify: `admin/src/test/setup.ts`

**Step 1: Add mock methods**

In the `apiService` mock object, after the Onboarding section (around line 122), add:

```typescript
    // Help state
    getHelpState: vi.fn(),
    updateHelpState: vi.fn(),
    resetHelpState: vi.fn(),
```

**Step 2: Commit Group 2**

```bash
git add admin/src/types/api.ts admin/src/services/api.ts admin/src/test/setup.ts
git commit -m "feat(help): add help state types, API methods, and test mocks"
```

---

## Group 3: Frontend — HelpStateContext

### Task 3.1: Write the HelpStateContext

**Files:**
- Create: `admin/src/store/HelpStateContext.tsx`

**Step 1: Create the context**

```typescript
import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import apiService from '@/services/api';
import type { HelpStateResponse, UpdateHelpStateRequest } from '@/types/api';

function getDefaultHelpState(): HelpStateResponse {
  return {
    tour_completed: false,
    hotspots_seen: [],
    field_help_seen: [],
  };
}

interface HelpStateContextValue {
  state: HelpStateResponse;
  isLoading: boolean;
  tourActive: boolean;
  startTour: () => void;
  completeTour: () => Promise<void>;
  resetTour: () => Promise<void>;
  dismissHotspot: (id: string) => Promise<void>;
  dismissFieldHelp: (id: string) => Promise<void>;
  isHotspotSeen: (id: string) => boolean;
  isFieldHelpSeen: (id: string) => boolean;
}

const HelpStateContext = createContext<HelpStateContextValue | null>(null);

export function HelpStateProvider({ children }: { children: ReactNode }) {
  const { clerkUserId } = useAuth();
  const queryClient = useQueryClient();
  const [tourActive, setTourActive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['helpState'],
    queryFn: () => apiService.getHelpState(),
    enabled: !!clerkUserId,
    staleTime: 1000 * 60 * 10,
  });

  const mutation = useMutation({
    mutationFn: (req: UpdateHelpStateRequest) => apiService.updateHelpState(req),
    onSuccess: (updated) => {
      queryClient.setQueryData(['helpState'], updated);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiService.resetHelpState(),
    onSuccess: (updated) => {
      queryClient.setQueryData(['helpState'], updated);
    },
  });

  const helpState = data ?? getDefaultHelpState();

  const startTour = useCallback(() => {
    setTourActive(true);
  }, []);

  const completeTour = useCallback(async () => {
    setTourActive(false);
    const previous = queryClient.getQueryData<HelpStateResponse>(['helpState']);
    if (previous) {
      queryClient.setQueryData(['helpState'], { ...previous, tour_completed: true });
    }
    try {
      await mutation.mutateAsync({ tour_completed: true });
    } catch {
      if (previous) {
        queryClient.setQueryData(['helpState'], previous);
      }
    }
  }, [mutation, queryClient]);

  const resetTour = useCallback(async () => {
    try {
      await resetMutation.mutateAsync();
      setTourActive(true);
    } catch {
      // Silently fail — tour will re-fetch on next load
    }
  }, [resetMutation]);

  const dismissHotspot = useCallback(async (id: string) => {
    const previous = queryClient.getQueryData<HelpStateResponse>(['helpState']);
    if (previous && !previous.hotspots_seen.includes(id)) {
      queryClient.setQueryData(['helpState'], {
        ...previous,
        hotspots_seen: [...previous.hotspots_seen, id],
      });
    }
    try {
      await mutation.mutateAsync({ dismiss_hotspot: id });
    } catch {
      if (previous) {
        queryClient.setQueryData(['helpState'], previous);
      }
    }
  }, [mutation, queryClient]);

  const dismissFieldHelp = useCallback(async (id: string) => {
    const previous = queryClient.getQueryData<HelpStateResponse>(['helpState']);
    if (previous && !previous.field_help_seen.includes(id)) {
      queryClient.setQueryData(['helpState'], {
        ...previous,
        field_help_seen: [...previous.field_help_seen, id],
      });
    }
    try {
      await mutation.mutateAsync({ dismiss_field_help: id });
    } catch {
      if (previous) {
        queryClient.setQueryData(['helpState'], previous);
      }
    }
  }, [mutation, queryClient]);

  const isHotspotSeen = useCallback(
    (id: string) => helpState.hotspots_seen.includes(id),
    [helpState.hotspots_seen],
  );

  const isFieldHelpSeen = useCallback(
    (id: string) => helpState.field_help_seen.includes(id),
    [helpState.field_help_seen],
  );

  const value: HelpStateContextValue = {
    state: helpState,
    isLoading,
    tourActive,
    startTour,
    completeTour,
    resetTour,
    dismissHotspot,
    dismissFieldHelp,
    isHotspotSeen,
    isFieldHelpSeen,
  };

  return (
    <HelpStateContext.Provider value={value}>
      {children}
    </HelpStateContext.Provider>
  );
}

export function useHelpState(): HelpStateContextValue {
  const ctx = useContext(HelpStateContext);
  if (!ctx) throw new Error('useHelpState must be used within HelpStateProvider');
  return ctx;
}
```

---

### Task 3.2: Add HelpStateContext mock to test setup

**Files:**
- Modify: `admin/src/test/setup.ts`

**Step 1: Add mock**

After the `UserPreferencesContext` mock (around line 41), add:

```typescript
// Mock HelpStateContext (used by help system components)
vi.mock('@/store/HelpStateContext', () => ({
  useHelpState: () => ({
    state: { tour_completed: false, hotspots_seen: [], field_help_seen: [] },
    isLoading: false,
    tourActive: false,
    startTour: vi.fn(),
    completeTour: vi.fn(),
    resetTour: vi.fn(),
    dismissHotspot: vi.fn(),
    dismissFieldHelp: vi.fn(),
    isHotspotSeen: () => false,
    isFieldHelpSeen: () => false,
  }),
}));
```

---

### Task 3.3: Wire HelpStateProvider into App.tsx

**Files:**
- Modify: `admin/src/App.tsx`

**Step 1: Add import**

```typescript
import { HelpStateProvider } from '@/store/HelpStateContext';
```

**Step 2: Wrap between UserPreferencesProvider and SiteProvider**

Change the provider nesting from:

```tsx
<UserPreferencesProvider>
<SiteProvider>
```

To:

```tsx
<UserPreferencesProvider>
<HelpStateProvider>
<SiteProvider>
```

And the corresponding closing tags:

```tsx
</SiteProvider>
</HelpStateProvider>
</UserPreferencesProvider>
```

**Step 3: Commit Group 3**

```bash
git add admin/src/store/HelpStateContext.tsx admin/src/test/setup.ts admin/src/App.tsx
git commit -m "feat(help): add HelpStateContext with TanStack Query"
```

---

## Group 4: Frontend — i18n Strings

### Task 4.1: Add English help system strings

**Files:**
- Modify: `admin/src/i18n/locales/en.json`

**Step 1: Add help system keys**

Add a new top-level `help` section:

```json
"help": {
  "menu": {
    "title": "Help & Resources",
    "documentation": "Documentation",
    "quickTour": "Quick tour",
    "keyboardShortcuts": "Keyboard shortcuts",
    "feedback": "Feedback",
    "version": "Forja v{{version}}"
  },
  "tour": {
    "skip": "Skip tour",
    "next": "Next",
    "done": "Done",
    "stepOf": "{{current}} of {{total}}",
    "step1": "This is your dashboard — see your site's activity at a glance",
    "step2": "Manage your content, structure, and settings from the sidebar",
    "step3": "Switch between your sites here",
    "step4": "Press {{shortcut}} to quickly navigate anywhere",
    "step5": "Need help? Find docs, shortcuts, and this tour here anytime"
  },
  "shortcuts": {
    "title": "Keyboard shortcuts",
    "commandPalette": "Open command palette",
    "save": "Save",
    "undo": "Undo",
    "redo": "Redo",
    "bold": "Bold",
    "italic": "Italic",
    "underline": "Underline"
  }
}
```

### Task 4.2: Add strings for other 7 locales

**Files:**
- Modify: `admin/src/i18n/locales/de.json`
- Modify: `admin/src/i18n/locales/fr.json`
- Modify: `admin/src/i18n/locales/es.json`
- Modify: `admin/src/i18n/locales/it.json`
- Modify: `admin/src/i18n/locales/pt.json`
- Modify: `admin/src/i18n/locales/nl.json`
- Modify: `admin/src/i18n/locales/pl.json`

Add the equivalent `help` section to each locale file with translated strings. The i18n interpolation keys (`{{version}}`, `{{shortcut}}`, `{{current}}`, `{{total}}`) must remain identical.

**Step 3: Commit Group 4**

```bash
git add admin/src/i18n/locales/*.json
git commit -m "feat(help): add i18n strings for help system in all 8 locales"
```

---

## Group 5: Frontend — Help Menu

### Task 5.1: Write failing test for HelpMenu

**Files:**
- Create: `admin/src/components/help/__tests__/HelpMenu.test.tsx`

**Step 1: Write the test**

```typescript
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import HelpMenu from '../HelpMenu';

// Mock useHelpState to control tour behavior
const mockStartTour = vi.fn();
vi.mock('@/store/HelpStateContext', () => ({
  useHelpState: () => ({
    state: { tour_completed: false, hotspots_seen: [], field_help_seen: [] },
    isLoading: false,
    tourActive: false,
    startTour: mockStartTour,
    completeTour: vi.fn(),
    resetTour: vi.fn(),
    dismissHotspot: vi.fn(),
    dismissFieldHelp: vi.fn(),
    isHotspotSeen: () => false,
    isFieldHelpSeen: () => false,
  }),
}));

describe('HelpMenu', () => {
  it('renders the help button', () => {
    renderWithProviders(<HelpMenu />);
    expect(screen.getByLabelText('help.menu.title')).toBeInTheDocument();
  });

  it('opens menu on click', () => {
    renderWithProviders(<HelpMenu />);
    fireEvent.click(screen.getByLabelText('help.menu.title'));
    expect(screen.getByText('help.menu.documentation')).toBeInTheDocument();
    expect(screen.getByText('help.menu.quickTour')).toBeInTheDocument();
    expect(screen.getByText('help.menu.keyboardShortcuts')).toBeInTheDocument();
    expect(screen.getByText('help.menu.feedback')).toBeInTheDocument();
  });

  it('calls startTour when quick tour is clicked', () => {
    renderWithProviders(<HelpMenu />);
    fireEvent.click(screen.getByLabelText('help.menu.title'));
    fireEvent.click(screen.getByText('help.menu.quickTour'));
    expect(mockStartTour).toHaveBeenCalled();
  });

  it('opens keyboard shortcuts dialog', () => {
    renderWithProviders(<HelpMenu />);
    fireEvent.click(screen.getByLabelText('help.menu.title'));
    fireEvent.click(screen.getByText('help.menu.keyboardShortcuts'));
    expect(screen.getByText('help.shortcuts.title')).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd admin && npm test -- --run src/components/help/__tests__/HelpMenu.test.tsx
```

Expected: FAIL (HelpMenu module not found)

---

### Task 5.2: Implement HelpMenu

**Files:**
- Create: `admin/src/components/help/HelpMenu.tsx`

**Step 1: Write the component**

```typescript
import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { useTranslation } from 'react-i18next';
import { useHelpState } from '@/store/HelpStateContext';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';

const DOCS_URL = 'https://forja-cms.github.io/forja';
const FEEDBACK_URL = 'https://github.com/dominikdorfstetter/forja/issues';
const APP_VERSION = '1.0.5';

export default function HelpMenu() {
  const { t } = useTranslation();
  const { startTour } = useHelpState();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTour = () => {
    handleClose();
    startTour();
  };

  const handleShortcuts = () => {
    handleClose();
    setShortcutsOpen(true);
  };

  return (
    <>
      <Tooltip title={t('help.menu.title')}>
        <IconButton
          color="inherit"
          aria-label={t('help.menu.title')}
          onClick={handleOpen}
          data-tour="help-menu"
        >
          <HelpOutlineIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        sx={{ mt: 1, '& .MuiMenuItem-root': { gap: 0.5 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          component="a"
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
        >
          <ListItemIcon><MenuBookIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.documentation')}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleTour}>
          <ListItemIcon><SchoolIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.quickTour')}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleShortcuts}>
          <ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.keyboardShortcuts')}</ListItemText>
        </MenuItem>

        <MenuItem
          component="a"
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
        >
          <ListItemIcon><FeedbackIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.feedback')}</ListItemText>
        </MenuItem>

        <Divider />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, py: 0.5, display: 'block' }}
        >
          {t('help.menu.version', { version: APP_VERSION })}
        </Typography>
      </Menu>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}
```

**Step 3: Run tests**

```bash
cd admin && npm test -- --run src/components/help/__tests__/HelpMenu.test.tsx
```

Expected: PASS (once KeyboardShortcutsDialog is also created — see Task 5.3)

---

### Task 5.3: Implement KeyboardShortcutsDialog

**Files:**
- Create: `admin/src/components/help/KeyboardShortcutsDialog.tsx`

**Step 1: Write the component**

```typescript
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  { action: 'help.shortcuts.commandPalette', keys: [mod, 'K'] },
  { action: 'help.shortcuts.save', keys: [mod, 'S'] },
  { action: 'help.shortcuts.undo', keys: [mod, 'Z'] },
  { action: 'help.shortcuts.redo', keys: [mod, 'Shift', 'Z'] },
  { action: 'help.shortcuts.bold', keys: [mod, 'B'] },
  { action: 'help.shortcuts.italic', keys: [mod, 'I'] },
  { action: 'help.shortcuts.underline', keys: [mod, 'U'] },
] as const;

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('help.shortcuts.title')}
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableBody>
            {SHORTCUTS.map((shortcut) => (
              <TableRow key={shortcut.action}>
                <TableCell sx={{ border: 0, py: 1 }}>
                  {t(shortcut.action)}
                </TableCell>
                <TableCell align="right" sx={{ border: 0, py: 1 }}>
                  {shortcut.keys.map((key) => (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 0.5, fontFamily: 'monospace', minWidth: 28 }}
                    />
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run HelpMenu tests again**

```bash
cd admin && npm test -- --run src/components/help/__tests__/HelpMenu.test.tsx
```

Expected: PASS

**Step 3: Commit Group 5**

```bash
git add admin/src/components/help/HelpMenu.tsx admin/src/components/help/KeyboardShortcutsDialog.tsx admin/src/components/help/__tests__/HelpMenu.test.tsx
git commit -m "feat(help): add HelpMenu and KeyboardShortcutsDialog components"
```

---

## Group 6: Frontend — Quick Tour

### Task 6.1: Write failing test for QuickTour

**Files:**
- Create: `admin/src/components/help/__tests__/QuickTour.test.tsx`

**Step 1: Write the test**

```typescript
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import QuickTour from '../QuickTour';

const mockCompleteTour = vi.fn();

describe('QuickTour', () => {
  const defaultProps = {
    active: true,
    onComplete: mockCompleteTour,
  };

  beforeEach(() => {
    mockCompleteTour.mockClear();
    // Create mock tour target elements
    const container = document.createElement('div');
    container.setAttribute('data-tour', 'dashboard-stats');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('[data-tour]').forEach((el) => el.remove());
  });

  it('renders first step when active', () => {
    renderWithProviders(<QuickTour {...defaultProps} />);
    expect(screen.getByText('help.tour.step1')).toBeInTheDocument();
    expect(screen.getByText('help.tour.skip')).toBeInTheDocument();
  });

  it('does not render when inactive', () => {
    renderWithProviders(<QuickTour active={false} onComplete={mockCompleteTour} />);
    expect(screen.queryByText('help.tour.step1')).not.toBeInTheDocument();
  });

  it('shows step indicator', () => {
    renderWithProviders(<QuickTour {...defaultProps} />);
    // Step indicator uses interpolation: "1 of 5" (or however many targets exist)
    expect(screen.getByText(/1.*of/i)).toBeInTheDocument();
  });

  it('calls onComplete when skip is clicked', () => {
    renderWithProviders(<QuickTour {...defaultProps} />);
    fireEvent.click(screen.getByText('help.tour.skip'));
    expect(mockCompleteTour).toHaveBeenCalled();
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd admin && npm test -- --run src/components/help/__tests__/QuickTour.test.tsx
```

Expected: FAIL (QuickTour module not found)

---

### Task 6.2: Implement QuickTour

**Files:**
- Create: `admin/src/components/help/QuickTour.tsx`

**Step 1: Write the component**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { Backdrop, Paper, Typography, Button, Stack, Box, Popper } from '@mui/material';
import { useTranslation } from 'react-i18next';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

const TOUR_STEPS = [
  { target: 'dashboard-stats', textKey: 'help.tour.step1' },
  { target: 'sidebar-nav', textKey: 'help.tour.step2' },
  { target: 'site-selector', textKey: 'help.tour.step3' },
  { target: 'command-palette', textKey: 'help.tour.step4' },
  { target: 'help-menu', textKey: 'help.tour.step5' },
] as const;

interface QuickTourProps {
  active: boolean;
  onComplete: () => void;
}

export default function QuickTour({ active, onComplete }: QuickTourProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const popperRef = useRef<HTMLDivElement>(null);

  // Find available steps (skip any whose target doesn't exist in the DOM)
  const availableSteps = TOUR_STEPS.filter(
    (step) => document.querySelector(`[data-tour="${step.target}"]`) !== null,
  );

  const updateAnchor = useCallback(() => {
    if (!active || availableSteps.length === 0) {
      setAnchorEl(null);
      return;
    }
    const step = availableSteps[currentStep];
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    setAnchorEl(el);
  }, [active, currentStep, availableSteps]);

  useEffect(() => {
    updateAnchor();
  }, [updateAnchor]);

  // Reset step when tour becomes active
  useEffect(() => {
    if (active) setCurrentStep(0);
  }, [active]);

  if (!active || availableSteps.length === 0) return null;

  const step = availableSteps[currentStep];
  const isLastStep = currentStep === availableSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return (
    <>
      <Backdrop
        open
        sx={{
          zIndex: (theme) => theme.zIndex.tooltip - 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
        onClick={onComplete}
      />

      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
        modifiers={[
          { name: 'offset', options: { offset: [0, 12] } },
          { name: 'preventOverflow', options: { padding: 16 } },
        ]}
      >
        <Paper
          ref={popperRef}
          elevation={8}
          sx={{
            p: 2.5,
            maxWidth: 340,
            borderRadius: 2,
            position: 'relative',
            // Arrow
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 12,
              height: 12,
              bgcolor: 'background.paper',
              boxShadow: '-2px -2px 4px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {t('help.tour.stepOf', { current: currentStep + 1, total: availableSteps.length })}
          </Typography>

          <Typography variant="body2" sx={{ mb: 2 }}>
            {step ? t(step.textKey, { shortcut: shortcutLabel }) : ''}
          </Typography>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" onClick={onComplete} color="inherit">
              {t('help.tour.skip')}
            </Button>
            <Box>
              <Button size="small" variant="contained" onClick={handleNext}>
                {isLastStep ? t('help.tour.done') : t('help.tour.next')}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Popper>
    </>
  );
}
```

**Step 2: Run tests**

```bash
cd admin && npm test -- --run src/components/help/__tests__/QuickTour.test.tsx
```

Expected: PASS

---

### Task 6.3: Add data-tour attributes to Layout

**Files:**
- Modify: `admin/src/components/Layout.tsx`

**Step 1: Add data-tour attributes to existing elements**

These are added to existing elements — NOT new elements:

1. **Site selector** — find the site selector TextField (it already has `data-testid="layout.btn.site-selector"`) and add `data-tour="site-selector"`
2. **Command palette button** — find the search IconButton (it already has `data-testid="layout.btn.search"`) and add `data-tour="command-palette"`
3. **Sidebar nav** — find the main `<List>` element that holds the navigation items, add `data-tour="sidebar-nav"`
4. **Dashboard stats** — this attribute will be added in the DashboardPage component, not in Layout. Add `data-tour="dashboard-stats"` to the stat cards container in `admin/src/pages/DashboardHome.tsx`.

---

### Task 6.4: Add HelpMenu and QuickTour to Layout

**Files:**
- Modify: `admin/src/components/Layout.tsx`

**Step 1: Import components**

```typescript
import HelpMenu from '@/components/help/HelpMenu';
import QuickTour from '@/components/help/QuickTour';
import { useHelpState } from '@/store/HelpStateContext';
```

**Step 2: Add HelpMenu to AppBar**

In the Toolbar section, between `<NotificationBell />` and the user avatar `<Box>`, add:

```tsx
<HelpMenu />
```

**Step 3: Add QuickTour at component root**

At the end of the Layout return, before the closing fragment, add:

```tsx
<QuickTour active={tourActive} onComplete={completeTour} />
```

Where `tourActive` and `completeTour` come from `useHelpState()` destructured at the top of the component.

**Step 4: Auto-launch tour on first visit**

Add a `useEffect` in Layout that auto-starts the tour on the dashboard route if tour_completed is false:

```typescript
const location = useLocation();
const { state: helpState, tourActive, completeTour, startTour } = useHelpState();

useEffect(() => {
  if (
    location.pathname === '/dashboard' &&
    !helpState.tour_completed &&
    !tourActive &&
    !helpState.isLoading
  ) {
    // Small delay to let the page render first
    const timer = setTimeout(startTour, 500);
    return () => clearTimeout(timer);
  }
}, [location.pathname, helpState.tour_completed]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 5: Run all help tests**

```bash
cd admin && npm test -- --run src/components/help/
```

Expected: all tests pass.

**Step 6: Commit Group 6**

```bash
git add admin/src/components/help/QuickTour.tsx admin/src/components/help/__tests__/QuickTour.test.tsx admin/src/components/Layout.tsx admin/src/pages/DashboardHome.tsx
git commit -m "feat(help): add QuickTour component and wire into Layout"
```

---

## Group 7: Verification

### Task 7.1: Run full frontend checks

```bash
cd admin && npm run typecheck && npm run lint && npm test
```

Fix any failures before proceeding.

### Task 7.2: Run full backend checks

```bash
cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test --lib
```

Fix any failures before proceeding.

### Task 7.3: Final commit (if any fixes were needed)

```bash
git add <fixed files>
git commit -m "fix(help): address lint and type check issues"
```

---

## File Changes Summary

### New files (6)
- `backend/src/dto/help_state.rs` — Help state DTOs with tests
- `admin/src/store/HelpStateContext.tsx` — Context provider + hook
- `admin/src/components/help/HelpMenu.tsx` — Help menu dropdown
- `admin/src/components/help/QuickTour.tsx` — Tour overlay
- `admin/src/components/help/KeyboardShortcutsDialog.tsx` — Shortcuts dialog
- `admin/src/components/help/__tests__/HelpMenu.test.tsx` — HelpMenu tests
- `admin/src/components/help/__tests__/QuickTour.test.tsx` — QuickTour tests

### Modified files (9)
- `backend/src/models/user_preferences.rs` — 3 new key constants
- `backend/src/dto/mod.rs` — add help_state module
- `backend/src/handlers/auth.rs` — 3 new handler functions + routes
- `backend/src/openapi.rs` — register new endpoints + schemas
- `admin/src/types/api.ts` — HelpState types
- `admin/src/services/api.ts` — 3 new API methods
- `admin/src/test/setup.ts` — HelpState mocks
- `admin/src/App.tsx` — HelpStateProvider
- `admin/src/components/Layout.tsx` — HelpMenu, QuickTour, data-tour attrs
- `admin/src/pages/DashboardHome.tsx` — data-tour="dashboard-stats"
- `admin/src/i18n/locales/*.json` (8 files) — help system strings
