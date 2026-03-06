import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { useCrudMutations } from '../useCrudMutations';

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(SnackbarProvider, { maxSnack: 3 }, children),
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
});

describe('useCrudMutations', () => {
  it('returns create, update, delete mutations', () => {
    const { result } = renderHook(
      () =>
        useCrudMutations({
          queryKey: 'items',
        }),
      { wrapper },
    );

    expect(result.current.createMutation).toBeDefined();
    expect(result.current.updateMutation).toBeDefined();
    expect(result.current.deleteMutation).toBeDefined();
  });

  it('create mutation calls mutationFn and invalidates queries', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: '1' });
    const onSuccess = vi.fn();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useCrudMutations<{ name: string }, never>({
          queryKey: 'items',
          create: {
            mutationFn,
            successMessage: 'Created!',
            onSuccess,
          },
        }),
      { wrapper },
    );

    await act(async () => {
      result.current.createMutation.mutate({ name: 'test' });
    });

    await waitFor(() => {
      expect(result.current.createMutation.isSuccess).toBe(true);
    });
    expect(mutationFn).toHaveBeenCalled();
    expect(mutationFn.mock.calls[0][0]).toEqual({ name: 'test' });
    expect(onSuccess).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('delete mutation calls the provided function', async () => {
    let receivedArg: unknown;
    const deleteFn = vi.fn().mockImplementation((id: string) => {
      receivedArg = id;
      return Promise.resolve();
    });

    const config = {
      queryKey: 'items',
      delete: {
        mutationFn: deleteFn,
        successMessage: 'Deleted!',
      },
    };

    const { result } = renderHook(
      () => useCrudMutations<string, string>(config),
      { wrapper },
    );

    await act(async () => {
      await result.current.deleteMutation.mutateAsync('item-1');
    });

    expect(receivedArg).toBe('item-1');
  });

  it('invalidates additional query keys', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: '1' });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useCrudMutations<{ name: string }, never>({
          queryKey: 'items',
          additionalInvalidations: [['related-items']],
          create: {
            mutationFn,
            successMessage: 'Created!',
          },
        }),
      { wrapper },
    );

    await act(async () => {
      result.current.createMutation.mutate({ name: 'test' });
    });

    await waitFor(() => {
      expect(result.current.createMutation.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['related-items'],
    });
  });
});
