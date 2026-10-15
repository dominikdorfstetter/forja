import type { SortDir } from './types';

export interface EntityListUIState<TItem> {
  viewTab: 'active' | 'archived';
  searchQuery: string;
  statusFilter: string;
  sortBy: string;
  sortDir: SortDir;
  publishingItem: TItem | null;
  unpublishingItem: TItem | null;
  archivingItem: TItem | null;
  restoringItem: TItem | null;
  bulkDeleteOpen: boolean;
  bulkPublishOpen: boolean;
  bulkUnpublishOpen: boolean;
  bulkArchiveOpen: boolean;
  bulkRestoreOpen: boolean;
}

export type EntityListUIAction<TItem> =
  | { type: 'setViewTab'; value: 'active' | 'archived' }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setStatusFilter'; value: string }
  | { type: 'setSort'; sortBy: string; sortDir: SortDir }
  | { type: 'openPublish'; item: TItem }
  | { type: 'closePublish' }
  | { type: 'openUnpublish'; item: TItem }
  | { type: 'closeUnpublish' }
  | { type: 'openArchive'; item: TItem }
  | { type: 'closeArchive' }
  | { type: 'openRestore'; item: TItem }
  | { type: 'closeRestore' }
  | { type: 'openBulkDelete' }
  | { type: 'openBulkPublish' }
  | { type: 'openBulkUnpublish' }
  | { type: 'openBulkArchive' }
  | { type: 'openBulkRestore' }
  | { type: 'closeAllBulk' };

export function makeEntityListReducer<TItem>(defaultSort: { sortBy: string; sortDir: SortDir }) {
  const initial: EntityListUIState<TItem> = {
    viewTab: 'active',
    searchQuery: '',
    statusFilter: '',
    sortBy: defaultSort.sortBy,
    sortDir: defaultSort.sortDir,
    publishingItem: null,
    unpublishingItem: null,
    archivingItem: null,
    restoringItem: null,
    bulkDeleteOpen: false,
    bulkPublishOpen: false,
    bulkUnpublishOpen: false,
    bulkArchiveOpen: false,
    bulkRestoreOpen: false,
  };

  function reducer(state: EntityListUIState<TItem>, action: EntityListUIAction<TItem>): EntityListUIState<TItem> {
    switch (action.type) {
      case 'setViewTab':
        return { ...state, viewTab: action.value, statusFilter: '', searchQuery: '' };
      case 'setSearchQuery':
        return { ...state, searchQuery: action.value };
      case 'setStatusFilter':
        return { ...state, statusFilter: action.value };
      case 'setSort':
        return { ...state, sortBy: action.sortBy, sortDir: action.sortDir };
      case 'openPublish':
        return { ...state, publishingItem: action.item };
      case 'closePublish':
        return { ...state, publishingItem: null };
      case 'openUnpublish':
        return { ...state, unpublishingItem: action.item };
      case 'closeUnpublish':
        return { ...state, unpublishingItem: null };
      case 'openArchive':
        return { ...state, archivingItem: action.item };
      case 'closeArchive':
        return { ...state, archivingItem: null };
      case 'openRestore':
        return { ...state, restoringItem: action.item };
      case 'closeRestore':
        return { ...state, restoringItem: null };
      case 'openBulkDelete':
        return { ...state, bulkDeleteOpen: true };
      case 'openBulkPublish':
        return { ...state, bulkPublishOpen: true };
      case 'openBulkUnpublish':
        return { ...state, bulkUnpublishOpen: true };
      case 'openBulkArchive':
        return { ...state, bulkArchiveOpen: true };
      case 'openBulkRestore':
        return { ...state, bulkRestoreOpen: true };
      case 'closeAllBulk':
        return {
          ...state,
          bulkDeleteOpen: false,
          bulkPublishOpen: false,
          bulkUnpublishOpen: false,
          bulkArchiveOpen: false,
          bulkRestoreOpen: false,
        };
      default:
        return state;
    }
  }

  return { reducer, initial };
}
