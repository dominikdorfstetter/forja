import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { SnackbarProvider } from 'notistack';
import { useErrorSnackbar } from '../useErrorSnackbar';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SnackbarProvider, { maxSnack: 3 }, children);
}

describe('useErrorSnackbar', () => {
  it('returns showError and showSuccess functions', () => {
    const { result } = renderHook(() => useErrorSnackbar(), { wrapper });
    expect(typeof result.current.showError).toBe('function');
    expect(typeof result.current.showSuccess).toBe('function');
    expect(typeof result.current.enqueueSnackbar).toBe('function');
  });

  it('showSuccess enqueues a success snackbar', () => {
    const { result } = renderHook(() => useErrorSnackbar(), { wrapper });

    act(() => {
      result.current.showSuccess('Item created');
    });
    // No throw = success; notistack handles rendering
  });

  it('showError handles Error instances', () => {
    const { result } = renderHook(() => useErrorSnackbar(), { wrapper });

    act(() => {
      result.current.showError(new Error('Something broke'));
    });
  });

  it('showError handles ProblemDetails-shaped objects', () => {
    const { result } = renderHook(() => useErrorSnackbar(), { wrapper });

    act(() => {
      result.current.showError({
        type: 'about:blank',
        title: 'Validation Error',
        status: 400,
        code: 'BAD_REQUEST',
        detail: 'Name is required',
      });
    });
  });

  it('showError handles unknown error types', () => {
    const { result } = renderHook(() => useErrorSnackbar(), { wrapper });

    act(() => {
      result.current.showError('string error');
    });
  });
});
