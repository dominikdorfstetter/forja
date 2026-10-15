import { describe, it, expect } from 'vitest';
import type { LegalGroupResponse } from '@/types/api';
import { cookieDialogReducer, initialDialogState, swapGroups } from '../cookieGroupState';

describe('swapGroups', () => {
  const groups = ['a', 'b', 'c'];

  it('swaps with the previous group when moving up', () => {
    expect(swapGroups(groups, 1, 'up')).toEqual(['b', 'a', 'c']);
  });

  it('swaps with the next group when moving down', () => {
    expect(swapGroups(groups, 1, 'down')).toEqual(['a', 'c', 'b']);
  });

  it('returns null when the move would leave the list', () => {
    expect(swapGroups(groups, 0, 'up')).toBeNull();
    expect(swapGroups(groups, 2, 'down')).toBeNull();
  });

  it('does not mutate the input', () => {
    swapGroups(groups, 0, 'down');
    expect(groups).toEqual(['a', 'b', 'c']);
  });
});

describe('cookieDialogReducer', () => {
  const group = { id: 'g1', cookie_name: 'analytics' } as LegalGroupResponse;

  it('opens and closes the create form', () => {
    const opened = cookieDialogReducer(initialDialogState, { type: 'OPEN_GROUP_FORM' });
    expect(opened.groupFormOpen).toBe(true);
    expect(cookieDialogReducer(opened, { type: 'CLOSE_GROUP_FORM' }).groupFormOpen).toBe(false);
  });

  it('tracks the group being edited or deleted', () => {
    const editing = cookieDialogReducer(initialDialogState, { type: 'SET_EDITING_GROUP', payload: group });
    expect(editing.editingGroup).toBe(group);
    const deleting = cookieDialogReducer(editing, { type: 'SET_DELETING_GROUP', payload: group });
    expect(deleting).toEqual({ groupFormOpen: false, editingGroup: group, deletingGroup: group });
  });
});
