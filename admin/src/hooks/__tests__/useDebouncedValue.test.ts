import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello'));
    expect(result.current).toBe('hello');
  });

  it('does not update until delay has passed', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });

    // Before delay
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');

    // After delay
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('b');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(200));

    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(200));

    // Still 'a' — timer was reset by second change
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('c');
  });

  it('uses default 500ms delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });

    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe(1);

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(2);
  });
});
