import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '../useBulkSelection';

describe('useBulkSelection', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useBulkSelection());
    expect(result.current.count).toBe(0);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggles an item on and off', () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it('selectAll selects all given ids', () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(['a', 'b', 'c']));
    expect(result.current.count).toBe(3);
    expect(result.current.allSelected(['a', 'b', 'c'])).toBe(true);
  });

  it('selectAll deselects all when all are already selected', () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(['a', 'b']));
    expect(result.current.count).toBe(2);

    act(() => result.current.selectAll(['a', 'b']));
    expect(result.current.count).toBe(0);
  });

  it('clear removes all selections', () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(['a', 'b', 'c']));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it('allSelected returns false for empty array', () => {
    const { result } = renderHook(() => useBulkSelection());
    expect(result.current.allSelected([])).toBe(false);
  });

  it('clears selection when deps change', () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useBulkSelection(deps),
      { initialProps: { deps: [1] } },
    );

    act(() => result.current.selectAll(['a', 'b']));
    expect(result.current.count).toBe(2);

    rerender({ deps: [2] });
    expect(result.current.count).toBe(0);
  });
});
