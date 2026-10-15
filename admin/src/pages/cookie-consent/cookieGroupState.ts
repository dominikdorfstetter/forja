import type { LegalGroupResponse } from '@/types/api';

// --- Dialog state reducer ---

export interface CookieDialogState {
  groupFormOpen: boolean;
  editingGroup: LegalGroupResponse | null;
  deletingGroup: LegalGroupResponse | null;
}

export type CookieDialogAction =
  | { type: 'OPEN_GROUP_FORM' }
  | { type: 'CLOSE_GROUP_FORM' }
  | { type: 'SET_EDITING_GROUP'; payload: LegalGroupResponse | null }
  | { type: 'SET_DELETING_GROUP'; payload: LegalGroupResponse | null };

export const initialDialogState: CookieDialogState = {
  groupFormOpen: false,
  editingGroup: null,
  deletingGroup: null,
};

export function cookieDialogReducer(state: CookieDialogState, action: CookieDialogAction): CookieDialogState {
  switch (action.type) {
    case 'OPEN_GROUP_FORM':
      return { ...state, groupFormOpen: true };
    case 'CLOSE_GROUP_FORM':
      return { ...state, groupFormOpen: false };
    case 'SET_EDITING_GROUP':
      return { ...state, editingGroup: action.payload };
    case 'SET_DELETING_GROUP':
      return { ...state, deletingGroup: action.payload };
    default:
      return state;
  }
}

// --- Ordering ---

export type MoveDirection = 'up' | 'down';

/**
 * Swap the group at `currentIndex` with its neighbour in `direction`.
 * Returns the new order (callers assign sequential `display_order`), or
 * `null` when the move would leave the list bounds.
 */
export function swapGroups<T>(groups: readonly T[], currentIndex: number, direction: MoveDirection): T[] | null {
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= groups.length) return null;
  const reordered = [...groups];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
  return reordered;
}
