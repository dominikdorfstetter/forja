import type { BlogListItem } from '@/types/api';

export type SortDir = 'asc' | 'desc';

interface UIState {
  quickPostOpen: boolean;
  viewTab: 'active' | 'archived';
  searchQuery: string;
  statusFilter: string;
  sortBy: string;
  sortDir: SortDir;
  publishingBlog: BlogListItem | null;
  unpublishingBlog: BlogListItem | null;
  archivingBlog: BlogListItem | null;
  restoringBlog: BlogListItem | null;
  bulkDeleteOpen: boolean;
  bulkPublishOpen: boolean;
  bulkUnpublishOpen: boolean;
  bulkArchiveOpen: boolean;
  bulkRestoreOpen: boolean;
}

type UIAction =
  | { type: 'openQuickPost' }
  | { type: 'closeQuickPost' }
  | { type: 'setViewTab'; value: 'active' | 'archived' }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setStatusFilter'; value: string }
  | { type: 'setSort'; sortBy: string; sortDir: SortDir }
  | { type: 'openPublish'; blog: BlogListItem }
  | { type: 'closePublish' }
  | { type: 'openUnpublish'; blog: BlogListItem }
  | { type: 'closeUnpublish' }
  | { type: 'openArchive'; blog: BlogListItem }
  | { type: 'closeArchive' }
  | { type: 'openRestore'; blog: BlogListItem }
  | { type: 'closeRestore' }
  | { type: 'openBulkDelete' }
  | { type: 'openBulkPublish' }
  | { type: 'openBulkUnpublish' }
  | { type: 'openBulkArchive' }
  | { type: 'openBulkRestore' }
  | { type: 'closeAllBulk' };

export const initialUIState: UIState = {
  quickPostOpen: false,
  viewTab: 'active',
  searchQuery: '',
  statusFilter: '',
  sortBy: 'published_date',
  sortDir: 'desc',
  publishingBlog: null,
  unpublishingBlog: null,
  archivingBlog: null,
  restoringBlog: null,
  bulkDeleteOpen: false,
  bulkPublishOpen: false,
  bulkUnpublishOpen: false,
  bulkArchiveOpen: false,
  bulkRestoreOpen: false,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'openQuickPost':
      return { ...state, quickPostOpen: true };
    case 'closeQuickPost':
      return { ...state, quickPostOpen: false };
    case 'setViewTab':
      return { ...state, viewTab: action.value, statusFilter: '', searchQuery: '' };
    case 'setSearchQuery':
      return { ...state, searchQuery: action.value };
    case 'setStatusFilter':
      return { ...state, statusFilter: action.value };
    case 'setSort':
      return { ...state, sortBy: action.sortBy, sortDir: action.sortDir };
    case 'openPublish':
      return { ...state, publishingBlog: action.blog };
    case 'closePublish':
      return { ...state, publishingBlog: null };
    case 'openUnpublish':
      return { ...state, unpublishingBlog: action.blog };
    case 'closeUnpublish':
      return { ...state, unpublishingBlog: null };
    case 'openArchive':
      return { ...state, archivingBlog: action.blog };
    case 'closeArchive':
      return { ...state, archivingBlog: null };
    case 'openRestore':
      return { ...state, restoringBlog: action.blog };
    case 'closeRestore':
      return { ...state, restoringBlog: null };
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
