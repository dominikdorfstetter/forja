import type { DocumentResponse, DocumentListItem } from '@/types/api';

interface UIState {
  page: number;
  perPage: number;
  selectedFolderId: string | null;
  formOpen: boolean;
  editingDocument: DocumentResponse | null;
  deletingDocument: DocumentListItem | null;
  deletingFolderId: string | null;
  searchQuery: string;
  activeId: string | null;
}

export type UIAction =
  | { type: 'setPage'; value: number }
  | { type: 'setPerPage'; value: number }
  | { type: 'setSelectedFolder'; id: string | null }
  | { type: 'openForm' }
  | { type: 'closeForm' }
  | { type: 'setEditingDocument'; doc: DocumentResponse | null }
  | { type: 'openDelete'; doc: DocumentListItem }
  | { type: 'closeDelete' }
  | { type: 'openDeleteFolder'; id: string }
  | { type: 'closeDeleteFolder' }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setActiveId'; id: string | null };

export const initialUIState: UIState = {
  page: 1,
  perPage: 25,
  selectedFolderId: null,
  formOpen: false,
  editingDocument: null,
  deletingDocument: null,
  deletingFolderId: null,
  searchQuery: '',
  activeId: null,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setPage':
      return { ...state, page: action.value };
    case 'setPerPage':
      return { ...state, perPage: action.value, page: 1 };
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
    case 'setActiveId':
      return { ...state, activeId: action.id };
    default:
      return state;
  }
}
