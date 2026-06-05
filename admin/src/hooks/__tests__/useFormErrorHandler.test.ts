import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormErrorHandler } from '../useFormErrorHandler';
import type { ResolvedError } from '@/utils/errorResolver';

describe('useFormErrorHandler', () => {
  it('maps field errors to setError calls', () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useFormErrorHandler(setError));

    act(() => {
      result.current({
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        code: 'VALIDATION_ERROR',
        detail: 'Invalid input',
        errors: [
          { field: 'slug', message: 'is required' },
          { field: 'author', message: 'must not be empty' },
        ],
      });
    });

    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenCalledWith('slug', { type: 'server', message: 'is required' });
    expect(setError).toHaveBeenCalledWith('author', { type: 'server', message: 'must not be empty' });
  });

  it('returns the resolved error for snackbar display', () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useFormErrorHandler(setError));

    let resolved: ResolvedError | undefined;
    act(() => {
      resolved = result.current({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'BLOG_SLUG_TAKEN',
        detail: "Slug 'my-post' is taken",
      });
    });

    expect(resolved).toBeDefined();
    expect(resolved!.code).toBe('BLOG_SLUG_TAKEN');
    expect(resolved!.title).toBe('Blog slug already in use');
    expect(resolved!.action).toBe('Choose a different slug.');
  });

  it('does not call setError when no field errors are present', () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useFormErrorHandler(setError));

    act(() => {
      result.current({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'BLOG_NOT_FOUND',
      });
    });

    expect(setError).not.toHaveBeenCalled();
  });

  it('handles non-ProblemDetails errors gracefully', () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useFormErrorHandler(setError));

    let resolved: ResolvedError | undefined;
    act(() => {
      resolved = result.current(new Error('Network Error'));
    });

    expect(setError).not.toHaveBeenCalled();
    expect(resolved!.title).toBe('Network Error');
  });

  it('maps field errors with error code when present', () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useFormErrorHandler(setError));

    act(() => {
      result.current({
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        code: 'VALIDATION_ERROR',
        errors: [
          { field: 'url', message: 'must be a valid URL', code: 'INVALID_FORMAT' },
        ],
      });
    });

    expect(setError).toHaveBeenCalledWith('url', { type: 'server', message: 'must be a valid URL' });
  });
});
