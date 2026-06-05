import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNavigationGuard } from '../useNavigationGuard';

const mockRegisterGuard = vi.fn();
const mockUnregisterGuard = vi.fn();

vi.mock('@/store/NavigationGuardContext', () => ({
  useNavigationGuardContext: () => ({
    registerGuard: mockRegisterGuard,
    unregisterGuard: mockUnregisterGuard,
    guardedNavigate: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useNavigationGuard', () => {
  it('registers guard on mount', () => {
    renderHook(() => useNavigationGuard('form-1', false));
    expect(mockRegisterGuard).toHaveBeenCalledWith('form-1', false);
  });

  it('registers guard as dirty when isDirty=true', () => {
    renderHook(() => useNavigationGuard('form-1', true));
    expect(mockRegisterGuard).toHaveBeenCalledWith('form-1', true);
  });

  it('unregisters guard on unmount', () => {
    const { unmount } = renderHook(() => useNavigationGuard('form-1', false));
    unmount();
    expect(mockUnregisterGuard).toHaveBeenCalledWith('form-1');
  });

  it('adds beforeunload listener when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useNavigationGuard('form-1', true));
    const calls = addSpy.mock.calls.filter(([e]) => e === 'beforeunload');
    expect(calls).toHaveLength(1);
  });

  it('does not add beforeunload listener when not dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useNavigationGuard('form-1', false));
    const calls = addSpy.mock.calls.filter(([e]) => e === 'beforeunload');
    expect(calls).toHaveLength(0);
  });

  it('updates guard registration when isDirty changes', () => {
    const { rerender } = renderHook(
      ({ dirty }) => useNavigationGuard('form-1', dirty),
      { initialProps: { dirty: false } },
    );
    expect(mockRegisterGuard).toHaveBeenCalledWith('form-1', false);

    rerender({ dirty: true });
    expect(mockRegisterGuard).toHaveBeenCalledWith('form-1', true);
  });
});
