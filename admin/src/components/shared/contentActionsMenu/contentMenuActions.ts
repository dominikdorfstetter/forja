import type { ContentStatus } from '@/types/api';
import { transitionsByKind } from '@/components/shared/contentEntityActionMenu';

/** Row-menu lifecycle actions for publishable content (portfolio projects). */
export type ContentMenuActionId = 'edit' | 'publish' | 'unpublish' | 'archive' | 'restore';

export type ContentMenuHandlers<T> = Partial<Record<ContentMenuActionId, (item: T) => void>>;

export interface ContentMenuAction<T> {
  id: ContentMenuActionId;
  handler: (item: T) => void;
}

/** Display order of the menu; delete is rendered separately below a divider. */
const MENU_ORDER: readonly ContentMenuActionId[] = ['edit', 'publish', 'unpublish', 'archive', 'restore'];

// Portfolio projects share the blog publish lifecycle.
const rules = transitionsByKind.blog;

const isAllowed: Record<ContentMenuActionId, (status: ContentStatus, canWrite: boolean) => boolean> = {
  edit: (_status, canWrite) => canWrite,
  publish: (status, canWrite) => canWrite && rules.canPublishFrom.includes(status),
  unpublish: (status, canWrite) => canWrite && rules.canUnpublishFrom.includes(status),
  archive: (status, canWrite) => canWrite && rules.canArchiveFrom.includes(status),
  restore: (status, canWrite) => canWrite && rules.canRestoreFrom.includes(status),
};

/**
 * Actions to offer, in menu order: only those the caller wired a handler for
 * and that the item's status and the user's write access permit.
 */
export function visibleContentMenuActions<T>(
  status: ContentStatus,
  canWrite: boolean,
  handlers: ContentMenuHandlers<T>,
): ContentMenuAction<T>[] {
  return MENU_ORDER.flatMap((id) => {
    const handler = handlers[id];
    return handler && isAllowed[id](status, canWrite) ? [{ id, handler }] : [];
  });
}
