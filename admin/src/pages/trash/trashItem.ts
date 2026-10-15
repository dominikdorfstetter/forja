/** Retention window of the soft-delete Trash (backend `trash_service.rs`). */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrashItem {
  id: string;
  entity_type: string;
  title?: string | null;
  slug?: string | null;
  deleted_at?: string | null;
}

/** A restore / permanent-delete target as the trash endpoints address it. */
export interface TrashTarget {
  id: string;
  entityType: string;
}

/** Whole days left before the auto-purge, clamped at 0. */
export function daysUntilPurge(deletedAt: string | null | undefined, now: Date = new Date()): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const purgeAt = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((purgeAt - now.getTime()) / DAY_MS));
}

export const toTrashTarget = (item: TrashItem): TrashTarget => ({
  id: item.id,
  entityType: item.entity_type,
});

/** Resolve selected ids against the loaded page; unknown ids fall back to the generic `content` type. */
export const selectionToTargets = (ids: Iterable<string>, items: TrashItem[]): TrashTarget[] =>
  [...ids].map((id) => ({
    id,
    entityType: items.find((i) => i.id === id)?.entity_type ?? 'content',
  }));
