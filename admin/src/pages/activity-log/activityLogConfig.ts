import { v5 as uuidv5 } from 'uuid';
import type { AuditAction, ClerkUser } from '@/types/api';

/**
 * Same namespace the backend uses (RFC 4122 DNS namespace) to derive
 * deterministic UUIDs from Clerk user IDs.
 */
const CLERK_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export type PillTone = 'success' | 'info' | 'warn' | 'err' | 'neutral';

/** Action → visual tone for the ActionPill. Grouped so the reader can
 * scan a long log and tell constructive (green) from destructive (red)
 * and workflow-signal (orange) actions at a glance. */
export const ACTION_TONE: Record<AuditAction, PillTone> = {
  Create: 'success',
  Read: 'neutral',
  Update: 'info',
  Delete: 'err',
  Publish: 'success',
  Unpublish: 'warn',
  Archive: 'warn',
  Restore: 'info',
  Login: 'neutral',
  Logout: 'neutral',
  SubmitReview: 'info',
  Approve: 'success',
  RequestChanges: 'warn',
  SettingsUpdate: 'info',
  PermissionDenied: 'err',
  OwnershipTransfer: 'warn',
  Export: 'neutral',
};

export const ENTITY_DETAIL_ROUTES: Record<string, string> = {
  blog: '/blogs',
  page: '/pages',
  site: '/sites',
  legal_document: '/legal',
};

export const ENTITY_TYPES = [
  'blog',
  'page',
  'media',
  'document',
  'navigation_item',
  'navigation_menu',
  'legal_document',
  'cv_entry',
  'skill',
  'social_link',
  'tag',
  'category',
  'site',
  'site_settings',
  'project',
  'api_key',
  'member',
];

export const ACTION_TYPES: AuditAction[] = [
  'Create',
  'Update',
  'Delete',
  'Publish',
  'Unpublish',
  'Archive',
  'Restore',
  'SubmitReview',
  'Approve',
  'RequestChanges',
  'SettingsUpdate',
];

/** Map the TypeScript PascalCase action to the DB enum string that the
 * backend compares against (sqlx lowercases, then snake-cases the two
 * multi-word variants). */
export const ACTION_DB_NAME: Record<AuditAction, string> = {
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
  Publish: 'publish',
  Unpublish: 'unpublish',
  Archive: 'archive',
  Restore: 'restore',
  Login: 'login',
  Logout: 'logout',
  SubmitReview: 'submit_review',
  Approve: 'approve',
  RequestChanges: 'request_changes',
  SettingsUpdate: 'settings_update',
  PermissionDenied: 'permission_denied',
  OwnershipTransfer: 'ownership_transfer',
  Export: 'export',
};

export type Timeframe = 'all' | '24h' | '7d' | '30d';

const DAY_MS = 24 * 60 * 60 * 1000;

const TIMEFRAME_MS: Record<Exclude<Timeframe, 'all'>, number> = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
};

/** Map the selected preset to an ISO-8601 `from_date`. `all` omits it. */
export function timeframeFrom(tf: Timeframe, now: Date = new Date()): string | undefined {
  if (tf === 'all') return undefined;
  return new Date(now.getTime() - TIMEFRAME_MS[tf]).toISOString();
}

export interface ActivityLogFilters {
  action: string;
  entity: string;
  timeframe: Timeframe;
}

/** True when any toolbar filter narrows the log (drives the empty-state copy). */
export function hasActiveFilters({ action, entity, timeframe }: ActivityLogFilters): boolean {
  return Boolean(action || entity || timeframe !== 'all');
}

/** Index Clerk users by the internal UUID the audit log stores in `user_id`. */
export function buildUserNameMap(users: ClerkUser[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const user of users ?? []) {
    map.set(uuidv5(user.id, CLERK_UUID_NAMESPACE), user.name || user.email || user.id);
  }
  return map;
}
