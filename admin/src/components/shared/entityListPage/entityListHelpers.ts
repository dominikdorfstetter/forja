import type { BulkContentRequest, ContentStatus } from '@/types/api';
import type { BulkDialogActions, DialogsSlotProps, EntityListAdapter, ListQueryParams, SortDir } from './types';

export type BulkAction = Parameters<DialogsSlotProps<unknown>['onBulkConfirm']>[0];

interface ListQueryInputs {
  page: number;
  pageSize: number;
  search: string;
  isArchived: boolean;
  statusFilter: string;
  sortBy: string;
  sortDir: SortDir;
  extra?: Record<string, unknown>;
}

/**
 * The list request: the Archived tab pins `status=Archived`; the Active tab
 * excludes archived rows and applies the chip filter (empty = all).
 */
export function buildListQueryParams({
  page,
  pageSize,
  search,
  isArchived,
  statusFilter,
  sortBy,
  sortDir,
  extra,
}: ListQueryInputs): ListQueryParams {
  return {
    page,
    page_size: pageSize,
    search: search || undefined,
    status: isArchived ? ('Archived' as ContentStatus) : (statusFilter as ContentStatus) || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    exclude_status: isArchived ? undefined : ('Archived' as ContentStatus),
    ...extra,
  };
}

/** Clicking the sorted column flips its direction; a new column starts ascending. */
export function nextSortDir(current: { sortBy: string; sortDir: SortDir }, column: string): SortDir {
  if (current.sortBy !== column) return 'asc';
  return current.sortDir === 'asc' ? 'desc' : 'asc';
}

/** Bulk dialog action → bulk endpoint request (restore lands as Draft). */
export function bulkRequestFor(action: BulkAction, ids: string[]): BulkContentRequest {
  if (action === 'delete') return { ids, action: 'Delete' };
  const status: ContentStatus =
    action === 'publish' ? 'Published' : action === 'archive' ? 'Archived' : 'Draft';
  return { ids, action: 'UpdateStatus', status };
}

/** Row-click target: the adapter override, else `/${entityKey}s/${id}`. */
export function entityRoutePath<TItem>(
  adapter: Pick<EntityListAdapter<TItem, unknown>, 'routePath' | 'entityKey' | 'getItemId'>,
  item: TItem,
): string {
  return adapter.routePath?.(item) ?? `/${adapter.entityKey}s/${adapter.getItemId(item)}`;
}

export type ListView = 'noSite' | 'loading' | 'error' | 'empty' | 'ready';

/**
 * Which body the list renders. "empty" is the first-run state — no rows on the
 * Active tab with no search/filter applied; a filtered miss still shows the table.
 */
export function resolveListView({
  hasSite,
  isLoading,
  hasError,
  itemCount,
  pristine,
}: {
  hasSite: boolean;
  isLoading: boolean;
  hasError: boolean;
  itemCount: number;
  pristine: boolean;
}): ListView {
  if (!hasSite) return 'noSite';
  if (isLoading) return 'loading';
  if (hasError) return 'error';
  if (itemCount === 0 && pristine) return 'empty';
  return 'ready';
}

/** Bulk-toolbar handlers per tab: Archived only offers restore (+ delete). */
export function bulkToolbarHandlers(isArchived: boolean, actions: BulkDialogActions) {
  if (isArchived) {
    return { onPublish: undefined, onUnpublish: undefined, onArchive: undefined, onRestore: actions.openBulkRestore };
  }
  return {
    onPublish: actions.openBulkPublish,
    onUnpublish: actions.openBulkUnpublish,
    onArchive: actions.openBulkArchive,
    onRestore: undefined,
  };
}
