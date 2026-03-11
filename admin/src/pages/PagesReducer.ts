import type { PageListItem } from '@/types/api';

export type SortDir = 'asc' | 'desc';

interface UIState {
  viewTab: 'active' | 'archived';
  searchQuery: string;
  statusFilter: string;
  typeFilter: string;
  sortBy: string;
  sortDir: SortDir;
  publishingPage: PageListItem | null;
  unpublishingPage: PageListItem | null;
  archivingPage: PageListItem | null;
  restoringPage: PageListItem | null;
  bulkDeleteOpen: boolean;
  bulkPublishOpen: boolean;
  bulkUnpublishOpen: boolean;
  bulkArchiveOpen: boolean;
  bulkRestoreOpen: boolean;
}

type UIAction =
  | { type: 'setViewTab'; value: 'active' | 'archived' }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setStatusFilter'; value: string }
  | { type: 'setTypeFilter'; value: string }
  | { type: 'setSort'; sortBy: string; sortDir: SortDir }
  | { type: 'openPublish'; page: PageListItem }
  | { type: 'closePublish' }
  | { type: 'openUnpublish'; page: PageListItem }
  | { type: 'closeUnpublish' }
  | { type: 'openArchive'; page: PageListItem }
  | { type: 'closeArchive' }
  | { type: 'openRestore'; page: PageListItem }
  | { type: 'closeRestore' }
  | { type: 'openBulkDelete' }
  | { type: 'openBulkPublish' }
  | { type: 'openBulkUnpublish' }
  | { type: 'openBulkArchive' }
  | { type: 'openBulkRestore' }
  | { type: 'closeAllBulk' };

export const initialUIState: UIState = {
  viewTab: 'active',
  searchQuery: '',
  statusFilter: '',
  typeFilter: '',
  sortBy: 'route',
  sortDir: 'asc',
  publishingPage: null,
  unpublishingPage: null,
  archivingPage: null,
  restoringPage: null,
  bulkDeleteOpen: false,
  bulkPublishOpen: false,
  bulkUnpublishOpen: false,
  bulkArchiveOpen: false,
  bulkRestoreOpen: false,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setViewTab':
      return { ...state, viewTab: action.value, statusFilter: '', searchQuery: '' };
    case 'setSearchQuery':
      return { ...state, searchQuery: action.value };
    case 'setStatusFilter':
      return { ...state, statusFilter: action.value };
    case 'setTypeFilter':
      return { ...state, typeFilter: action.value };
    case 'setSort':
      return { ...state, sortBy: action.sortBy, sortDir: action.sortDir };
    case 'openPublish':
      return { ...state, publishingPage: action.page };
    case 'closePublish':
      return { ...state, publishingPage: null };
    case 'openUnpublish':
      return { ...state, unpublishingPage: action.page };
    case 'closeUnpublish':
      return { ...state, unpublishingPage: null };
    case 'openArchive':
      return { ...state, archivingPage: action.page };
    case 'closeArchive':
      return { ...state, archivingPage: null };
    case 'openRestore':
      return { ...state, restoringPage: action.page };
    case 'closeRestore':
      return { ...state, restoringPage: null };
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
      return { ...state, bulkDeleteOpen: false, bulkPublishOpen: false, bulkUnpublishOpen: false, bulkArchiveOpen: false, bulkRestoreOpen: false };
    default:
      return state;
  }
}
