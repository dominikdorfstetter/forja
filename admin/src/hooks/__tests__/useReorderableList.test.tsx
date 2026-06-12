import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReorderableList } from '../useReorderableList';

interface Item {
  id: string;
  title: string;
}

const a: Item = { id: 'a', title: 'Alpha' };
const b: Item = { id: 'b', title: 'Beta' };
const c: Item = { id: 'c', title: 'Gamma' };
const d: Item = { id: 'd', title: 'Delta' };

const ids = (items: Item[]) => items.map((i) => i.id);

describe('useReorderableList', () => {
  it('returns an empty list while server data is undefined', () => {
    const { result } = renderHook(() => useReorderableList<Item>(undefined));
    expect(result.current.orderedItems).toEqual([]);
  });

  it('follows server order while the user has not reordered', () => {
    const { result, rerender } = renderHook(({ items }) => useReorderableList(items), {
      initialProps: { items: [a, b, c] },
    });
    expect(ids(result.current.orderedItems)).toEqual(['a', 'b', 'c']);

    rerender({ items: [c, a, b] });
    expect(ids(result.current.orderedItems)).toEqual(['c', 'a', 'b']);
  });

  it('reorder moves the dragged item and returns the new order for the mutation payload', () => {
    const { result } = renderHook(() => useReorderableList([a, b, c]));

    let returned: Item[] | null = null;
    act(() => {
      returned = result.current.reorder('c', 'a');
    });

    expect(ids(result.current.orderedItems)).toEqual(['c', 'a', 'b']);
    expect(returned === null ? null : ids(returned)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the local order when a refetch returns the same items in server order', () => {
    const { result, rerender } = renderHook(({ items }) => useReorderableList(items), {
      initialProps: { items: [a, b, c] },
    });
    act(() => {
      result.current.reorder('c', 'a');
    });

    rerender({ items: [a, b, c] });
    expect(ids(result.current.orderedItems)).toEqual(['c', 'a', 'b']);
  });

  it('appends items created after a local reorder', () => {
    const { result, rerender } = renderHook(({ items }) => useReorderableList(items), {
      initialProps: { items: [a, b] },
    });
    act(() => {
      result.current.reorder('b', 'a');
    });

    rerender({ items: [a, b, d] });
    expect(ids(result.current.orderedItems)).toEqual(['b', 'a', 'd']);
  });

  it('drops items deleted after a local reorder', () => {
    const { result, rerender } = renderHook(({ items }) => useReorderableList(items), {
      initialProps: { items: [a, b, c] },
    });
    act(() => {
      result.current.reorder('c', 'a');
    });

    rerender({ items: [a, c] });
    expect(ids(result.current.orderedItems)).toEqual(['c', 'a']);
  });

  it('reorder is a no-op returning null for unknown ids', () => {
    const { result } = renderHook(() => useReorderableList([a, b]));

    let returned: Item[] | null = [];
    act(() => {
      returned = result.current.reorder('nope', 'a');
    });

    expect(returned).toBeNull();
    expect(ids(result.current.orderedItems)).toEqual(['a', 'b']);
  });

  it('resetOrder falls back to server order (reorder-failure recovery)', () => {
    const { result } = renderHook(({ items }) => useReorderableList(items), {
      initialProps: { items: [a, b, c] },
    });
    act(() => {
      result.current.reorder('c', 'a');
    });
    expect(ids(result.current.orderedItems)).toEqual(['c', 'a', 'b']);

    act(() => {
      result.current.resetOrder();
    });
    expect(ids(result.current.orderedItems)).toEqual(['a', 'b', 'c']);
  });
});
