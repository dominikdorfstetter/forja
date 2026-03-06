import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListPageState } from '../useListPageState';

describe('useListPageState', () => {
  it('starts with default page=1 and perPage=25', () => {
    const { result } = renderHook(() => useListPageState());
    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(25);
  });

  it('respects custom initial values', () => {
    const { result } = renderHook(() =>
      useListPageState({ initialPage: 3, initialPerPage: 50 }),
    );
    expect(result.current.page).toBe(3);
    expect(result.current.perPage).toBe(50);
  });

  it('handlePageChange converts 0-based MUI index to 1-based page', () => {
    const { result } = renderHook(() => useListPageState());

    act(() => result.current.handlePageChange(null, 2));
    expect(result.current.page).toBe(3);
  });

  it('handleRowsPerPageChange updates perPage and resets page to 1', () => {
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
    expect(result.current.perPage).toBe(50);
    expect(result.current.page).toBe(1);
  });

  it('manages form open/close state', () => {
    const { result } = renderHook(() => useListPageState());

    expect(result.current.formOpen).toBe(false);
    act(() => result.current.openCreate());
    expect(result.current.formOpen).toBe(true);
    act(() => result.current.closeForm());
    expect(result.current.formOpen).toBe(false);
  });

  it('manages editing state', () => {
    const { result } = renderHook(() => useListPageState<{ id: string }>());

    expect(result.current.editing).toBeNull();
    const item = { id: 'test-1' };
    act(() => result.current.openEdit(item));
    expect(result.current.editing).toEqual(item);
    act(() => result.current.closeEdit());
    expect(result.current.editing).toBeNull();
  });

  it('manages deleting state', () => {
    const { result } = renderHook(() => useListPageState<{ id: string }>());

    expect(result.current.deleting).toBeNull();
    const item = { id: 'test-1' };
    act(() => result.current.openDelete(item));
    expect(result.current.deleting).toEqual(item);
    act(() => result.current.closeDelete());
    expect(result.current.deleting).toBeNull();
  });
});
