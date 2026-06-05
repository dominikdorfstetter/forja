import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReadOnly } from '../useReadOnly';

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/store/AuthContext';

const mockedUseAuth = vi.mocked(useAuth);

function setCanWrite(canWrite: boolean) {
  mockedUseAuth.mockReturnValue({ canWrite } as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe('useReadOnly', () => {
  it('returns readOnly=false and canWrite=true when the user can write', () => {
    setCanWrite(true);
    const { result } = renderHook(() => useReadOnly());
    expect(result.current.readOnly).toBe(false);
    expect(result.current.canWrite).toBe(true);
  });

  it('returns readOnly=true and canWrite=false when the user is restricted', () => {
    setCanWrite(false);
    const { result } = renderHook(() => useReadOnly());
    expect(result.current.readOnly).toBe(true);
    expect(result.current.canWrite).toBe(false);
  });

  it('disabledProps reflects the read-only state for MUI form controls', () => {
    setCanWrite(false);
    const { result } = renderHook(() => useReadOnly());
    expect(result.current.disabledProps).toEqual({
      disabled: true,
      'aria-disabled': true,
    });
  });

  it('disabledProps stays enabled when the user can write', () => {
    setCanWrite(true);
    const { result } = renderHook(() => useReadOnly());
    expect(result.current.disabledProps).toEqual({
      disabled: false,
      'aria-disabled': false,
    });
  });

  it('gate(value) returns the value unchanged when the user can write', () => {
    setCanWrite(true);
    const handler = () => 'clicked';
    const { result } = renderHook(() => useReadOnly());
    expect(result.current.gate(handler)).toBe(handler);
  });

  it('gate(value) returns undefined when the user is read-only', () => {
    setCanWrite(false);
    const handler = () => 'clicked';
    const { result } = renderHook(() => useReadOnly());
    expect(result.current.gate(handler)).toBeUndefined();
  });
});
