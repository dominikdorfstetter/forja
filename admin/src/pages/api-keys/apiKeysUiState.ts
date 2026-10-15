import type { ApiKeyListItem, ApiKeyPermission, SiteRole } from '@/types/api';

/** Max API key permission a site role can create */
export function maxPermissionForRole(role: SiteRole | null, isSysAdmin: boolean): ApiKeyPermission {
  if (isSysAdmin) return 'Admin';
  switch (role) {
    case 'owner':
      return 'Admin';
    case 'admin':
      return 'Write';
    default:
      return 'Read';
  }
}

export interface UIState {
  statusFilter: string;
  permissionFilter: string;
  searchInput: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  createOpen: boolean;
  editingKey: ApiKeyListItem | null;
  blockingKey: ApiKeyListItem | null;
  revokingKey: ApiKeyListItem | null;
  deletingKey: ApiKeyListItem | null;
  usageKey: ApiKeyListItem | null;
}

export type UIAction =
  | { type: 'setStatusFilter'; value: string }
  | { type: 'setPermissionFilter'; value: string }
  | { type: 'setSearchInput'; value: string }
  | { type: 'setPage'; value: number }
  | { type: 'setPageSize'; value: number }
  | { type: 'setSort'; sortBy: string; sortDir: 'asc' | 'desc' }
  | { type: 'openCreate' }
  | { type: 'closeCreate' }
  | { type: 'openEdit'; key: ApiKeyListItem }
  | { type: 'closeEdit' }
  | { type: 'openBlock'; key: ApiKeyListItem }
  | { type: 'closeBlock' }
  | { type: 'openRevoke'; key: ApiKeyListItem }
  | { type: 'closeRevoke' }
  | { type: 'openDelete'; key: ApiKeyListItem }
  | { type: 'closeDelete' }
  | { type: 'openUsage'; key: ApiKeyListItem }
  | { type: 'closeUsage' };

export const initialUIState: UIState = {
  statusFilter: '',
  permissionFilter: '',
  searchInput: '',
  sortBy: '',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
  createOpen: false,
  editingKey: null,
  blockingKey: null,
  revokingKey: null,
  deletingKey: null,
  usageKey: null,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setStatusFilter':
      return { ...state, statusFilter: action.value, page: 1 };
    case 'setPermissionFilter':
      return { ...state, permissionFilter: action.value, page: 1 };
    case 'setSearchInput':
      return { ...state, searchInput: action.value, page: 1 };
    case 'setPage':
      return { ...state, page: action.value };
    case 'setPageSize':
      return { ...state, pageSize: action.value, page: 1 };
    case 'setSort':
      return { ...state, sortBy: action.sortBy, sortDir: action.sortDir, page: 1 };
    case 'openCreate':
      return { ...state, createOpen: true };
    case 'closeCreate':
      return { ...state, createOpen: false };
    case 'openEdit':
      return { ...state, editingKey: action.key };
    case 'closeEdit':
      return { ...state, editingKey: null };
    case 'openBlock':
      return { ...state, blockingKey: action.key };
    case 'closeBlock':
      return { ...state, blockingKey: null };
    case 'openRevoke':
      return { ...state, revokingKey: action.key };
    case 'closeRevoke':
      return { ...state, revokingKey: null };
    case 'openDelete':
      return { ...state, deletingKey: action.key };
    case 'closeDelete':
      return { ...state, deletingKey: null };
    case 'openUsage':
      return { ...state, usageKey: action.key };
    case 'closeUsage':
      return { ...state, usageKey: null };
    default:
      return state;
  }
}

/** Sort action for a column header click: toggles direction on the active column, else ascending. */
export function sortActionFor(state: Pick<UIState, 'sortBy' | 'sortDir'>, column: string): UIAction {
  const sortDir = state.sortBy === column && state.sortDir === 'asc' ? 'desc' : 'asc';
  return { type: 'setSort', sortBy: column, sortDir };
}

/** Whether any list filter (status, permission, settled search) is narrowing the results. */
export function hasActiveFilters(state: Pick<UIState, 'statusFilter' | 'permissionFilter'>, search: string): boolean {
  return Boolean(state.statusFilter || state.permissionFilter || search);
}
