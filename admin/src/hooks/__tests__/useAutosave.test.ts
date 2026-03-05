import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() =>
      useAutosave({ isDirty: false, onSave: vi.fn() }),
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('does not trigger save when not dirty', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutosave({ isDirty: false, onSave, debounceMs: 100 }),
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('triggers save after debounce when dirty', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutosave({ isDirty: true, onSave, debounceMs: 100 }),
    );

    // Not yet
    expect(onSave).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows saving then saved status', async () => {
    let resolveSave: () => void;
    const onSave = vi.fn().mockImplementation(
      () => new Promise<void>((r) => { resolveSave = r; }),
    );

    const { result } = renderHook(() =>
      useAutosave({ isDirty: true, onSave, debounceMs: 100 }),
    );

    // Trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.status).toBe('saving');

    // Resolve save
    await act(async () => {
      resolveSave();
    });

    expect(result.current.status).toBe('saved');

    // After 3s, status resets to idle
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    expect(result.current.status).toBe('idle');
  });

  it('shows error status on save failure after retries', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useAutosave({
        isDirty: true,
        onSave,
        debounceMs: 100,
        onError,
        maxRetries: 1,
      }),
    );

    // Trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // First attempt fails, then waits 2s for retry
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    // Retry also fails — maxRetries=1 means 1 initial + 1 retry = 2 calls
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not trigger save when disabled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutosave({ isDirty: true, onSave, debounceMs: 100, enabled: false }),
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('restarts debounce when formVersion changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ formVersion }) =>
        useAutosave({ isDirty: true, onSave, debounceMs: 200, formVersion }),
      { initialProps: { formVersion: 0 } },
    );

    // Advance 150ms (not yet debounced)
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(onSave).not.toHaveBeenCalled();

    // Change formVersion to restart timer
    rerender({ formVersion: 1 });

    // Advance another 150ms — still not debounced (timer restarted)
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(onSave).not.toHaveBeenCalled();

    // Advance past remaining debounce
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('flush saves immediately and clears pending timer', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAutosave({ isDirty: true, onSave, debounceMs: 5000 }),
    );

    // Don't wait for debounce — call flush
    await act(async () => {
      await result.current.flush();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });

  it('flush is a no-op when not dirty', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAutosave({ isDirty: false, onSave, debounceMs: 100 }),
    );

    await act(async () => {
      await result.current.flush();
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
