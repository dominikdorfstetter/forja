# Contextual Help System — Design Document

**Issue:** #51
**Date:** 2026-03-10
**Scope:** Full-stack (Rust backend + React admin)
**Delivery:** Incremental — Phase A in this PR, Phases B & C as follow-ups

## Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Delivery | Incremental — core first | Help menu + tour + backend infra first; hotspots & field help later |
| State storage | Backend-persisted | Survives device switches; stored in `user_preferences` JSON blob (same pattern as onboarding survey) |
| Tour UI | Custom MUI Popper/Backdrop | No external library; native to Catppuccin theme system |
| Help menu placement | AppBar, top right | Next to notification bell and user avatar |
| Access control | All authenticated users | Help should not be role-gated |
| Backend storage | `user_preferences` JSON blob | Follows existing onboarding survey pattern; no migration needed |

## Phase A Scope (This PR)

1. Backend: DTO + handlers for help state (stored in user_preferences, no migration)
2. Frontend: HelpStateProvider + useHelpState hook
3. Frontend: HelpMenu component in AppBar
4. Frontend: QuickTour component (5 steps, MUI Popper)
5. Frontend: Keyboard shortcuts dialog
6. i18n: all strings in all 8 locales

## Phase B Scope (Follow-up)

- Animated hotspots (pulse dots on key UI elements, first session only)

## Phase C Scope (Follow-up)

- Contextual field help (first-visit helper text on editor fields)

---

## Backend Design

### Migration: `user_onboarding` table

```sql
CREATE TABLE user_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
    hotspots_seen TEXT[] NOT NULL DEFAULT '{}',
    field_help_seen TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_onboarding_user_id ON user_onboarding(user_id);
```

- `user_id` is the Clerk user ID (VARCHAR, not FK — matches existing codebase pattern)
- One row per user, created lazily on first PATCH
- `hotspots_seen` and `field_help_seen` are string arrays for dismissed item IDs

### API Endpoints

#### `GET /api/v1/onboarding`

- Auth: any authenticated user
- Returns current user's onboarding state
- If no row exists, returns defaults (tour_completed: false, empty arrays)
- No site scoping — onboarding is per-user

#### `PATCH /api/v1/onboarding`

- Auth: any authenticated user
- Body (all fields optional):
  ```json
  {
    "tour_completed": true,
    "dismiss_hotspot": "dashboard_site_selector",
    "dismiss_field_help": "editor_slug_field"
  }
  ```
- `dismiss_hotspot` appends to `hotspots_seen` (idempotent)
- `dismiss_field_help` appends to `field_help_seen` (idempotent)
- Upserts: creates row if not exists, updates if exists
- Logs to audit service

#### `POST /api/v1/onboarding/reset`

- Auth: any authenticated user
- Resets user's onboarding state to defaults
- Logs to audit service

---

## Frontend Design

### OnboardingProvider

**File:** `admin/src/store/OnboardingContext.tsx`

```typescript
interface OnboardingState {
  tourCompleted: boolean;
  hotspotsSeen: string[];
  fieldHelpSeen: string[];
}

interface OnboardingContextValue {
  state: OnboardingState;
  isLoading: boolean;
  tourActive: boolean;
  startTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
  dismissHotspot: (id: string) => void;
  dismissFieldHelp: (id: string) => void;
  isHotspotSeen: (id: string) => boolean;
  isFieldHelpSeen: (id: string) => boolean;
}
```

- Placed in App.tsx after AuthProvider, before SiteProvider
- Uses TanStack Query for fetching + mutations
- Optimistic updates with rollback on error

### HelpMenu

**File:** `admin/src/components/help/HelpMenu.tsx`

- `(?)` IconButton in AppBar, between notification bell and user avatar
- MUI Menu dropdown with items:
  - Documentation (external link to docs site)
  - Quick tour (launches QuickTour via useOnboarding().startTour())
  - Keyboard shortcuts (opens KeyboardShortcutsDialog)
  - Feedback (external link to GitHub issues)
  - Version display at bottom
- All labels through `t()` for i18n
- MUI icons (MenuBookIcon, SchoolIcon, KeyboardIcon, FeedbackIcon)

### QuickTour

**File:** `admin/src/components/help/QuickTour.tsx`

5 tooltip-style overlay steps:

| Step | Target (`data-tour`) | Text |
|------|---------------------|------|
| 1 | `dashboard-stats` | "This is your dashboard — see your site's activity at a glance" |
| 2 | `sidebar-nav` | "Manage your content, structure, and settings from the sidebar" |
| 3 | `site-selector` | "Switch between your sites here" |
| 4 | `command-palette` | "Press Cmd+K to quickly navigate anywhere" |
| 5 | `help-menu` | "Need help? Find docs, shortcuts, and this tour here anytime" |

UI per step:
- Semi-transparent MUI Backdrop
- MUI Paper positioned via Popper, anchored to target element
- Arrow indicator pointing to target
- "Skip tour" button on every step
- "Next" / "Done" (last step) button
- Step indicator "2 of 5"
- Steps with missing targets are skipped

Behavior:
- Auto-launches on first login (tour_completed === false), only on dashboard route
- Re-launchable from Help Menu
- On complete/skip: PATCH { tour_completed: true }
- Reset: POST /reset then startTour()

### KeyboardShortcutsDialog

**File:** `admin/src/components/help/KeyboardShortcutsDialog.tsx`

- Simple MUI Dialog with two-column table (action -> shortcut)
- Lists: Cmd+K, Ctrl+S, Ctrl+Z, Ctrl+Shift+Z, etc.
- All labels through t() for i18n

### API Service Methods

```typescript
// in admin/src/services/api.ts
getOnboardingState(): Promise<OnboardingState>
updateOnboardingState(update: OnboardingUpdate): Promise<OnboardingState>
resetOnboardingState(): Promise<void>
```

### data-tour Attributes

Added to Layout.tsx on target elements:
- `data-tour="dashboard-stats"` on stat cards container
- `data-tour="sidebar-nav"` on sidebar navigation list
- `data-tour="site-selector"` on site selector TextField
- `data-tour="command-palette"` on Cmd+K chip/button
- `data-tour="help-menu"` on help menu IconButton

---

## File Changes Summary

### New files
- `backend/migrations/<next>/up.sql` — user_onboarding table
- `backend/migrations/<next>/down.sql` — drop table
- `backend/src/models/user_onboarding.rs` — model + queries
- `backend/src/dto/user_onboarding.rs` — request/response DTOs
- `backend/src/handlers/onboarding.rs` — GET/PATCH/POST handlers
- `admin/src/store/OnboardingContext.tsx` — provider + hook
- `admin/src/components/help/HelpMenu.tsx` — help menu dropdown
- `admin/src/components/help/QuickTour.tsx` — tour overlay
- `admin/src/components/help/KeyboardShortcutsDialog.tsx` — shortcuts dialog
- `admin/src/components/help/__tests__/HelpMenu.test.tsx`
- `admin/src/components/help/__tests__/QuickTour.test.tsx`

### Modified files
- `backend/src/models/mod.rs` — add user_onboarding module
- `backend/src/dto/mod.rs` — add user_onboarding module
- `backend/src/handlers/mod.rs` — add onboarding module
- `backend/src/main.rs` — mount onboarding routes
- `backend/src/openapi.rs` — register endpoints + schemas
- `admin/src/services/api.ts` — add onboarding methods
- `admin/src/types/api.ts` — add OnboardingState type
- `admin/src/test/setup.ts` — add onboarding mocks
- `admin/src/App.tsx` — add OnboardingProvider
- `admin/src/components/Layout.tsx` — add HelpMenu to AppBar, add data-tour attrs
- `admin/src/i18n/locales/*.json` (8 files) — add help/tour strings
