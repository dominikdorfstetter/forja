import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { usePortfolioReorder } from '../usePortfolioReorder';

type Item = { id: string };

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(SnackbarProvider, { maxSnack: 3 }, children),
  );
}

const dragStart = (id: string) => ({ active: { id } }) as unknown as DragStartEvent;
const drop = (activeId: string, overId: string | null) =>
  ({ active: { id: activeId }, over: overId ? { id: overId } : null }) as unknown as DragEndEvent;

const a = { id: 'a' };
const b = { id: 'b' };
const c = { id: 'c' };
// Query data keeps its identity across renders; a new array means the server answered again.
const ABC = [a, b, c];
const AB = [a, b];

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});

describe('usePortfolioReorder', () => {
  it('follows server order until something is dropped', () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePortfolioReorder<Item>(ABC, persist, ['items']), { wrapper });

    expect(result.current.ordered).toEqual([a, b, c]);
  });

  it('reorders optimistically and persists the new display order', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePortfolioReorder<Item>(ABC, persist, ['items']), { wrapper });

    act(() => result.current.handleDragEnd(drop('a', 'c')));

    expect(result.current.ordered).toEqual([b, c, a]);
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    expect(persist.mock.calls[0][0]).toEqual([
      { id: 'b', display_order: 0 },
      { id: 'c', display_order: 1 },
      { id: 'a', display_order: 2 },
    ]);
  });

  it('ignores drops outside the list or onto the dragged row itself', () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePortfolioReorder<Item>(AB, persist, ['items']), { wrapper });

    act(() => result.current.handleDragEnd(drop('a', null)));
    act(() => result.current.handleDragEnd(drop('a', 'a')));

    expect(result.current.ordered).toEqual([a, b]);
    expect(persist).not.toHaveBeenCalled();
  });

  it('lets a new server array (refetch, page, sort) win over a local drop', () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ items }) => usePortfolioReorder<Item>(items, persist, ['items']),
      { wrapper, initialProps: { items: [a, b] } },
    );

    act(() => result.current.handleDragEnd(drop('a', 'b')));
    expect(result.current.ordered).toEqual([b, a]);

    rerender({ items: [a, b, c] });
    expect(result.current.ordered).toEqual([a, b, c]);
  });

  it('exposes the row being dragged until it is dropped', () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePortfolioReorder<Item>(AB, persist, ['items']), { wrapper });

    act(() => result.current.handleDragStart(dragStart('b')));
    expect(result.current.activeItem).toEqual(b);

    act(() => result.current.handleDragEnd(drop('b', null)));
    expect(result.current.activeItem).toBeUndefined();
  });

  it('refetches the list when persisting fails', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('nope'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePortfolioReorder<Item>(AB, persist, ['items', 'site-1']), { wrapper });

    act(() => result.current.handleDragEnd(drop('a', 'b')));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['items', 'site-1'] }));
  });
});
