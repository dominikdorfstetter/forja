import type { DocumentResponse, DocumentListItem } from '@/types/api';

interface UIState {
  page: number;
  pageSize: number;
  selectedFolderId: string | null;
  formOpen: boolean;
  editingDocument: DocumentResponse | null;
  deletingDocument: DocumentListItem | null;
  deletingFolderId: string | null;
  searchQuery: string;
  debouncedSearchQuery: string;
  activeId: string | null;
  privacyDocument: DocumentResponse | null;
  passwordDocument: DocumentListItem | null;
  unlockingDocument: DocumentListItem | null;
}

export type UIAction =
  | { type: 'setPage'; value: number }
  | { type: 'setPageSize'; value: number }
  | { type: 'setSelectedFolder'; id: string | null }
  | { type: 'openForm' }
  | { type: 'closeForm' }
  | { type: 'setEditingDocument'; doc: DocumentResponse | null }
  | { type: 'openDelete'; doc: DocumentListItem }
  | { type: 'closeDelete' }
  | { type: 'openDeleteFolder'; id: string }
  | { type: 'closeDeleteFolder' }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setDebouncedSearchQuery'; value: string }
  | { type: 'setActiveId'; id: string | null }
  | { type: 'openPrivacy'; doc: DocumentResponse }
  | { type: 'closePrivacy' }
  | { type: 'openPassword'; doc: DocumentListItem }
  | { type: 'closePassword' }
  | { type: 'openUnlock'; doc: DocumentListItem }
  | { type: 'closeUnlock' };

export const initialUIState: UIState = {
  page: 1,
  pageSize: 25,
  selectedFolderId: null,
  formOpen: false,
  editingDocument: null,
  deletingDocument: null,
  deletingFolderId: null,
  searchQuery: '',
  debouncedSearchQuery: '',
  activeId: null,
  privacyDocument: null,
  passwordDocument: null,
  unlockingDocument: null,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setPage':
      return { ...state, page: action.value };
    case 'setPageSize':
      return { ...state, pageSize: action.value, page: 1 };
    case 'setSelectedFolder':
      return { ...state, selectedFolderId: action.id, page: 1 };
    case 'openForm':
      return { ...state, formOpen: true };
    case 'closeForm':
      return { ...state, formOpen: false, editingDocument: null };
    case 'setEditingDocument':
      return { ...state, editingDocument: action.doc, formOpen: action.doc !== null || state.formOpen };
    case 'openDelete':
      return { ...state, deletingDocument: action.doc };
    case 'closeDelete':
      return { ...state, deletingDocument: null };
    case 'openDeleteFolder':
      return { ...state, deletingFolderId: action.id };
    case 'closeDeleteFolder':
      return { ...state, deletingFolderId: null };
    case 'setSearchQuery':
      return { ...state, searchQuery: action.value };
    case 'setDebouncedSearchQuery':
      return { ...state, debouncedSearchQuery: action.value };
    case 'setActiveId':
      return { ...state, activeId: action.id };
    case 'openPrivacy':
      return { ...state, privacyDocument: action.doc };
    case 'closePrivacy':
      return { ...state, privacyDocument: null };
    case 'openPassword':
      return { ...state, passwordDocument: action.doc };
    case 'closePassword':
      return { ...state, passwordDocument: null };
    case 'openUnlock':
      return { ...state, unlockingDocument: action.doc };
    case 'closeUnlock':
      return { ...state, unlockingDocument: null };
    default:
      return state;
  }
}
