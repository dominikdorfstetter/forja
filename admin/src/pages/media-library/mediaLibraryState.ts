import type { MediaListItem } from '@/types/api';

// --- Reducer ---

export interface MediaPageState {
  page: number;
  pageSize: number;
  uploadOpen: boolean;
  deletingFile: MediaListItem | null;
  deletingFolderId: string | null;
  detailFile: MediaListItem | null;
  selectedFolderId: string | null;
  activeId: string | null;
  searchInput: string;
  debouncedSearch: string;
  mimeCategory: string | null;
  filterTags: string[];
}

export type MediaPageAction =
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PER_PAGE'; payload: number }
  | { type: 'SET_UPLOAD_OPEN'; payload: boolean }
  | { type: 'SET_DELETING_FILE'; payload: MediaListItem | null }
  | { type: 'SET_DELETING_FOLDER_ID'; payload: string | null }
  | { type: 'SET_DETAIL_FILE'; payload: MediaListItem | null }
  | { type: 'SET_SELECTED_FOLDER'; payload: string | null }
  | { type: 'SET_ACTIVE_ID'; payload: string | null }
  | { type: 'SET_SEARCH_INPUT'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SET_MIME_CATEGORY'; payload: string | null }
  | { type: 'SELECT_FOLDER'; payload: string | null }
  | { type: 'TOGGLE_MIME_CATEGORY'; payload: string }
  | { type: 'TOGGLE_FILTER_TAG'; payload: string }
  | { type: 'CLEAR_FILTER_TAGS' };

export const initialMediaPageState: MediaPageState = {
  page: 1,
  pageSize: 25,
  uploadOpen: false,
  deletingFile: null,
  deletingFolderId: null,
  detailFile: null,
  selectedFolderId: null,
  activeId: null,
  searchInput: '',
  debouncedSearch: '',
  mimeCategory: null,
  filterTags: [],
};

export function mediaReducer(state: MediaPageState, action: MediaPageAction): MediaPageState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_PER_PAGE':
      return { ...state, pageSize: action.payload, page: 1 };
    case 'SET_UPLOAD_OPEN':
      return { ...state, uploadOpen: action.payload };
    case 'SET_DELETING_FILE':
      return { ...state, deletingFile: action.payload };
    case 'SET_DELETING_FOLDER_ID':
      return { ...state, deletingFolderId: action.payload };
    case 'SET_DETAIL_FILE':
      return { ...state, detailFile: action.payload };
    case 'SET_SELECTED_FOLDER':
      return { ...state, selectedFolderId: action.payload };
    case 'SET_ACTIVE_ID':
      return { ...state, activeId: action.payload };
    case 'SET_SEARCH_INPUT':
      return { ...state, searchInput: action.payload };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearch: action.payload };
    case 'SET_MIME_CATEGORY':
      return { ...state, mimeCategory: action.payload };
    case 'SELECT_FOLDER':
      return { ...state, selectedFolderId: action.payload, page: 1 };
    case 'TOGGLE_MIME_CATEGORY':
      return {
        ...state,
        mimeCategory: state.mimeCategory === action.payload ? null : action.payload,
        page: 1,
      };
    case 'TOGGLE_FILTER_TAG': {
      const tag = action.payload;
      const tags = state.filterTags.includes(tag)
        ? state.filterTags.filter((t) => t !== tag)
        : [...state.filterTags, tag];
      return { ...state, filterTags: tags, page: 1 };
    }
    case 'CLEAR_FILTER_TAGS':
      return { ...state, filterTags: [], page: 1 };
    default:
      return state;
  }
}

// --- Derivations ---

export type MediaListFilters = Pick<
  MediaPageState,
  'page' | 'pageSize' | 'debouncedSearch' | 'mimeCategory' | 'selectedFolderId' | 'filterTags'
>;

/** Query params for server-side filtering; unset filters are omitted. */
export function buildMediaQueryParams(filters: MediaListFilters): Record<string, string | number> {
  const params: Record<string, string | number> = { page: filters.page, page_size: filters.pageSize };
  if (filters.debouncedSearch) params.search = filters.debouncedSearch;
  if (filters.mimeCategory) params.mime_category = filters.mimeCategory;
  if (filters.selectedFolderId) params.folder_id = filters.selectedFolderId;
  if (filters.filterTags.length > 0) params.tags = filters.filterTags.join(',');
  return params;
}

export function hasActiveMediaFilters(filters: MediaListFilters): boolean {
  return !!filters.debouncedSearch || !!filters.mimeCategory || !!filters.selectedFolderId || filters.filterTags.length > 0;
}

export const MEDIA_TAB_SLUGS = ['library', 'documents'] as const;
export type MediaTabSlug = (typeof MEDIA_TAB_SLUGS)[number];

/** The tab to show for a URL slug; documents only when the module is on. */
export function resolveMediaTab(urlTab: string | undefined, documentsEnabled: boolean): MediaTabSlug {
  return urlTab === 'documents' && documentsEnabled ? 'documents' : 'library';
}

/** Whether the URL slug must be replaced with the canonical library route. */
export function needsMediaTabRedirect(urlTab: string | undefined, documentsEnabled: boolean): boolean {
  if (!urlTab) return true;
  if (!MEDIA_TAB_SLUGS.includes(urlTab as MediaTabSlug)) return true;
  return urlTab === 'documents' && !documentsEnabled;
}
