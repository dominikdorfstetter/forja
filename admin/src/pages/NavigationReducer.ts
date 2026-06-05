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
  expandedIds: Set<string>;
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
  | { type: 'setActiveId'; id: string | null }
  | { type: 'toggleExpanded'; id: string }
  | { type: 'expandAll'; ids: string[] }
  | { type: 'collapseAll' };

export const initialUIState: UIState = {
  selectedMenuIndex: 0,
  menuFormOpen: false,
  editingMenu: null,
  deletingMenu: null,
  formOpen: false,
  editingItem: null,
  deletingItem: null,
  activeId: null,
  expandedIds: new Set<string>(),
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
    case 'toggleExpanded': {
      const next = new Set(state.expandedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, expandedIds: next };
    }
    case 'expandAll':
      return { ...state, expandedIds: new Set(action.ids) };
    case 'collapseAll':
      return { ...state, expandedIds: new Set() };
    default:
      return state;
  }
}

export interface FlatItem {
  item: NavigationItem;
  depth: number;
  isLastChild: boolean;
  hasChildren: boolean;
  childCount: number;
}

/** Flatten a tree of items with depth and metadata for tree rendering. */
export function flattenItemsWithDepth(
  items: NavigationItem[],
  expandedIds?: Set<string>,
): FlatItem[] {
  const result: FlatItem[] = [];

  const childrenOf = (parentId: string | undefined): NavigationItem[] =>
    items
      .filter((i) => (i.parent_id || undefined) === parentId)
      .sort((a, b) => a.display_order - b.display_order);

  const addChildren = (parentId: string | undefined, depth: number) => {
    const children = childrenOf(parentId);
    children.forEach((child, index) => {
      const grandchildren = childrenOf(child.id);
      const hasChildren = grandchildren.length > 0;
      result.push({
        item: child,
        depth,
        isLastChild: index === children.length - 1,
        hasChildren,
        childCount: grandchildren.length,
      });
      // Only recurse into children of expanded parents (or all if no expandedIds provided)
      if (hasChildren && (!expandedIds || expandedIds.has(child.id))) {
        addChildren(child.id, depth + 1);
      }
    });
  };

  addChildren(undefined, 0);
  return result;
}

/** Get all parent IDs (items that have children). */
export function getParentIds(items: NavigationItem[]): string[] {
  const parentIds = new Set<string>();
  items.forEach((item) => {
    if (item.parent_id) parentIds.add(item.parent_id);
  });
  return Array.from(parentIds);
}
