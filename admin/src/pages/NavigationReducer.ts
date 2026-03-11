import type { NavigationMenu, NavigationItem } from '@/types/api';

interface UIState {
  selectedMenuIndex: number;
  menuFormOpen: boolean;
  editingMenu: NavigationMenu | null;
  deletingMenu: NavigationMenu | null;
  formOpen: boolean;
  editingItem: NavigationItem | null;
  deletingItem: NavigationItem | null;
  activeId: string | null;
}

type UIAction =
  | { type: 'setSelectedMenuIndex'; value: number }
  | { type: 'openMenuForm' }
  | { type: 'closeMenuForm' }
  | { type: 'setEditingMenu'; menu: NavigationMenu | null }
  | { type: 'openDeleteMenu'; menu: NavigationMenu }
  | { type: 'closeDeleteMenu' }
  | { type: 'openItemForm' }
  | { type: 'closeItemForm' }
  | { type: 'setEditingItem'; item: NavigationItem | null }
  | { type: 'openDeleteItem'; item: NavigationItem }
  | { type: 'closeDeleteItem' }
  | { type: 'setActiveId'; id: string | null };

export const initialUIState: UIState = {
  selectedMenuIndex: 0,
  menuFormOpen: false,
  editingMenu: null,
  deletingMenu: null,
  formOpen: false,
  editingItem: null,
  deletingItem: null,
  activeId: null,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setSelectedMenuIndex':
      return { ...state, selectedMenuIndex: action.value };
    case 'openMenuForm':
      return { ...state, menuFormOpen: true };
    case 'closeMenuForm':
      return { ...state, menuFormOpen: false, editingMenu: null };
    case 'setEditingMenu':
      return { ...state, editingMenu: action.menu, menuFormOpen: action.menu !== null || state.menuFormOpen };
    case 'openDeleteMenu':
      return { ...state, deletingMenu: action.menu };
    case 'closeDeleteMenu':
      return { ...state, deletingMenu: null };
    case 'openItemForm':
      return { ...state, formOpen: true };
    case 'closeItemForm':
      return { ...state, formOpen: false };
    case 'setEditingItem':
      return { ...state, editingItem: action.item };
    case 'openDeleteItem':
      return { ...state, deletingItem: action.item };
    case 'closeDeleteItem':
      return { ...state, deletingItem: null };
    case 'setActiveId':
      return { ...state, activeId: action.id };
    default:
      return state;
  }
}

/** Flatten a tree of items with depth for display */
export function flattenItemsWithDepth(items: NavigationItem[]): { item: NavigationItem; depth: number }[] {
  const result: { item: NavigationItem; depth: number }[] = [];

  const addChildren = (parentId: string | undefined, depth: number) => {
    const children = items
      .filter(i => (i.parent_id || undefined) === parentId)
      .sort((a, b) => a.display_order - b.display_order);
    for (const child of children) {
      result.push({ item: child, depth });
      addChildren(child.id, depth + 1);
    }
  };

  addChildren(undefined, 0);
  return result;
}
