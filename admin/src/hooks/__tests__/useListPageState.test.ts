import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListPageState } from '../useListPageState';

let mockPageSize = 25;

vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: {
      language: 'en',
      theme_id: 'system',
      page_size: mockPageSize,
    },
    isLoading: false,
    updatePreferences: vi.fn(),
    isUpdating: false,
  }),
}));

describe('useListPageState', () => {
  it('starts with default page=1 and pageSize from user preferences', () => {
    mockPageSize = 25;
    const { result } = renderHook(() => useListPageState());
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
  });

  it('uses user preference page_size as default', () => {
    mockPageSize = 50;
    const { result } = renderHook(() => useListPageState());
    expect(result.current.pageSize).toBe(50);
  });

  it('respects custom initial values over user preference', () => {
    mockPageSize = 25;
    const { result } = renderHook(() =>
      useListPageState({ initialPage: 3, initialPageSize: 50 }),
    );
    expect(result.current.page).toBe(3);
    expect(result.current.pageSize).toBe(50);
  });

  it('handlePageChange converts 0-based MUI index to 1-based page', () => {
    mockPageSize = 25;
    const { result } = renderHook(() => useListPageState());

    act(() => result.current.handlePageChange(null, 2));
    expect(result.current.page).toBe(3);
  });

  it('handleRowsPerPageChange updates pageSize and resets page to 1', () => {
    mockPageSize = 25;
    const { result } = renderHook(() => useListPageState());

    // First move to page 3
    act(() => result.current.handlePageChange(null, 2));
    expect(result.current.page).toBe(3);

    // Change rows per page — page should reset
    act(() =>
      result.current.handleRowsPerPageChange({
        target: { value: '50' },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    expect(result.current.pageSize).toBe(50);
    expect(result.current.page).toBe(1);
  });

  it('manages form open/close state', () => {
    mockPageSize = 25;
    const { result } = renderHook(() => useListPageState());

    expect(result.current.formOpen).toBe(false);
    act(() => result.current.openCreate());
    expect(result.current.formOpen).toBe(true);
    act(() => result.current.closeForm());
    expect(result.current.formOpen).toBe(false);
  });

  it('manages editing state', () => {
    mockPageSize = 25;
    const { result } = renderHook(() => useListPageState<{ id: string }>());

    expect(result.current.editing).toBeNull();
    const item = { id: 'test-1' };
    act(() => result.current.openEdit(item));
    expect(result.current.editing).toEqual(item);
    act(() => result.current.closeEdit());
    expect(result.current.editing).toBeNull();
  });

  it('manages deleting state', () => {
    mockPageSize = 25;
    const { result } = renderHook(() => useListPageState<{ id: string }>());

    expect(result.current.deleting).toBeNull();
    const item = { id: 'test-1' };
    act(() => result.current.openDelete(item));
    expect(result.current.deleting).toEqual(item);
    act(() => result.current.closeDelete());
    expect(result.current.deleting).toBeNull();
  });

  describe('chipFilter (list-page kit v2)', () => {
    it('defaults chipFilter to "all"', () => {
      mockPageSize = 25;
      const { result } = renderHook(() => useListPageState());
      expect(result.current.chipFilter).toBe('all');
    });

    it('accepts initialChipFilter from options', () => {
      mockPageSize = 25;
      const { result } = renderHook(() => useListPageState({ initialChipFilter: 'draft' }));
      expect(result.current.chipFilter).toBe('draft');
    });

    it('setChipFilter updates value and resets page to 1', () => {
      mockPageSize = 25;
      const { result } = renderHook(() => useListPageState({ initialPage: 3 }));
      expect(result.current.page).toBe(3);
      act(() => result.current.setChipFilter('scheduled'));
      expect(result.current.chipFilter).toBe('scheduled');
      expect(result.current.page).toBe(1);
    });
  });
});
