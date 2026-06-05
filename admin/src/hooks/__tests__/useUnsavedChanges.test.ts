import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnsavedChanges } from '../useUnsavedChanges';

describe('useUnsavedChanges', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    addSpy?.mockRestore();
    removeSpy?.mockRestore();
  });

  it('registers beforeunload handler when dirty', () => {
    addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useUnsavedChanges(true));
    const calls = addSpy.mock.calls.filter(([e]: [string]) => e === 'beforeunload');
    expect(calls).toHaveLength(1);
  });

  it('does not register handler when not dirty', () => {
    addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useUnsavedChanges(false));
    const beforeunloadCalls = addSpy.mock.calls.filter(
      ([event]: [string]) => event === 'beforeunload',
    );
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it('removes handler on unmount', () => {
    removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useUnsavedChanges(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });

  it('calls preventDefault on the event', () => {
    addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useUnsavedChanges(true));
    const handler = addSpy.mock.calls.find(
      ([event]: [string]) => event === 'beforeunload',
    )?.[1] as EventListener;

    const event = new Event('beforeunload', { cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    handler(event);
    expect(preventSpy).toHaveBeenCalled();
  });
});
