import { describe, it, expect } from 'vitest';
import {
  hasActiveFilters,
  initialUIState,
  maxPermissionForRole,
  sortActionFor,
  uiReducer,
} from '../apiKeysUiState';

describe('maxPermissionForRole', () => {
  it.each([
    ['owner', false, 'Admin'],
    ['admin', false, 'Write'],
    ['editor', false, 'Read'],
    [null, false, 'Read'],
    [null, true, 'Admin'],
  ] as const)('role %s (sysadmin=%s) may create up to %s keys', (role, isSysAdmin, expected) => {
    expect(maxPermissionForRole(role, isSysAdmin)).toBe(expected);
  });
});

describe('sortActionFor', () => {
  it('starts a new column ascending', () => {
    expect(sortActionFor({ sortBy: 'name', sortDir: 'desc' }, 'status')).toEqual({
      type: 'setSort',
      sortBy: 'status',
      sortDir: 'asc',
    });
  });

  it('toggles direction on the active column', () => {
    expect(sortActionFor({ sortBy: 'name', sortDir: 'asc' }, 'name')).toMatchObject({ sortDir: 'desc' });
    expect(sortActionFor({ sortBy: 'name', sortDir: 'desc' }, 'name')).toMatchObject({ sortDir: 'asc' });
  });
});

describe('hasActiveFilters', () => {
  it('is false with no filters and no search', () => {
    expect(hasActiveFilters(initialUIState, '')).toBe(false);
  });

  it.each([
    [{ statusFilter: 'Active', permissionFilter: '' }, ''],
    [{ statusFilter: '', permissionFilter: 'Read' }, ''],
    [{ statusFilter: '', permissionFilter: '' }, 'prod'],
  ])('is true when any filter or the search narrows results', (state, search) => {
    expect(hasActiveFilters(state, search)).toBe(true);
  });
});

describe('uiReducer', () => {
  it('resets to page 1 when sorting or filtering changes', () => {
    const onPage3 = { ...initialUIState, page: 3 };
    expect(uiReducer(onPage3, sortActionFor(onPage3, 'name')).page).toBe(1);
    expect(uiReducer(onPage3, { type: 'setStatusFilter', value: 'Active' }).page).toBe(1);
  });
});
