import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormHistory } from '../useFormHistory';

function createFormMock(initial: Record<string, unknown>) {
  let values = { ...initial };
  const getValues = vi.fn(() => values as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reset = vi.fn((newValues: any) => {
    values = { ...newValues };
  });
  const setValues = (v: Record<string, unknown>) => {
    values = { ...v };
  };
  return { getValues, reset, setValues };
}

describe('useFormHistory', () => {
  it('starts with canUndo=false and canRedo=false', () => {
    const { getValues, reset } = createFormMock({ name: '' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('snapshot captures state and enables undo', () => {
    const { getValues, reset, setValues } = createFormMock({ name: 'a' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    act(() => result.current.snapshot());
    setValues({ name: 'b' });
    act(() => result.current.snapshot());

    expect(result.current.canUndo).toBe(true);
  });

  it('undo restores previous state', () => {
    const { getValues, reset, setValues } = createFormMock({ name: 'a' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    act(() => result.current.snapshot()); // state 0: {name: 'a'}
    setValues({ name: 'b' });
    act(() => result.current.snapshot()); // state 1: {name: 'b'}

    act(() => result.current.undo());
    expect(reset).toHaveBeenCalledWith(
      { name: 'a' },
      { keepDirty: true, keepTouched: true },
    );
  });

  it('redo restores undone state', () => {
    const { getValues, reset, setValues } = createFormMock({ name: 'a' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    act(() => result.current.snapshot());
    setValues({ name: 'b' });
    act(() => result.current.snapshot());

    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(reset).toHaveBeenLastCalledWith(
      { name: 'b' },
      { keepDirty: true, keepTouched: true },
    );
  });

  it('undo returns false when nothing to undo', () => {
    const { getValues, reset } = createFormMock({ name: '' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    let undone = false;
    act(() => {
      undone = result.current.undo();
    });
    expect(undone).toBe(false);
  });

  it('redo returns false when nothing to redo', () => {
    const { getValues, reset } = createFormMock({ name: '' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    let redone = false;
    act(() => {
      redone = result.current.redo();
    });
    expect(redone).toBe(false);
  });

  it('skips duplicate consecutive snapshots', () => {
    const { getValues, reset } = createFormMock({ name: 'a' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    act(() => result.current.snapshot());
    act(() => result.current.snapshot());
    act(() => result.current.snapshot());

    // Only one snapshot, so undo should return false (index 0, can't go lower)
    expect(result.current.canUndo).toBe(false);
  });

  it('clear resets history', () => {
    const { getValues, reset, setValues } = createFormMock({ name: 'a' });
    const { result } = renderHook(() => useFormHistory(getValues, reset));

    act(() => result.current.snapshot());
    setValues({ name: 'b' });
    act(() => result.current.snapshot());
    act(() => result.current.clear());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('enforces max stack size', () => {
    const { getValues, reset, setValues } = createFormMock({ v: 0 });
    const { result } = renderHook(() => useFormHistory(getValues, reset, 3));

    for (let i = 1; i <= 5; i++) {
      setValues({ v: i });
      act(() => result.current.snapshot());
    }

    // Stack is capped at 3: [3, 4, 5]
    // Undo twice to get to the oldest entry
    let undone = true;
    act(() => {
      undone = result.current.undo();
    });
    expect(undone).toBe(true);
    act(() => {
      undone = result.current.undo();
    });
    expect(undone).toBe(true);
    // One more should fail — we're at index 0
    act(() => {
      undone = result.current.undo();
    });
    expect(undone).toBe(false);
  });
});
