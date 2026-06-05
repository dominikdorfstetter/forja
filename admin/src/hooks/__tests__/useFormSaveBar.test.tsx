import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { SaveBarProvider, useSaveBar } from '@/store/SaveBarContext';
import { NavigationGuardProvider } from '@/store/NavigationGuardContext';
import { useFormSaveBar, countDirtyFields } from '@/hooks/useFormSaveBar';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <NavigationGuardProvider>
        <SaveBarProvider>{children}</SaveBarProvider>
      </NavigationGuardProvider>
    </MemoryRouter>
  );
}

describe('countDirtyFields', () => {
  it('counts flat truthy leaves', () => {
    expect(countDirtyFields({ a: true, b: true, c: false })).toBe(2);
  });

  it('counts nested leaves once each', () => {
    expect(countDirtyFields({ seo: { title: true, desc: true }, status: true })).toBe(3);
  });

  it('treats an array of dirty entries as leaves', () => {
    expect(countDirtyFields({ items: [{ x: true }, { y: true }] })).toBe(2);
  });

  it('returns 0 for undefined / empty', () => {
    expect(countDirtyFields(undefined)).toBe(0);
    expect(countDirtyFields({})).toBe(0);
  });
});

describe('useFormSaveBar', () => {
  it('registers a save-bar entry while dirty and clears it when clean', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }) =>
        ({
          bar: useSaveBar(),
          _: useFormSaveBar({ id: 'f1', isDirty, onSave: vi.fn() }),
        }),
      { wrapper, initialProps: { isDirty: true } },
    );

    expect(result.current.bar.activeEntry?.id).toBe('f1');

    rerender({ isDirty: false });
    expect(result.current.bar.activeEntry).toBeUndefined();
  });

  it('derives changeCount from dirtyFields when not given explicitly', () => {
    const { result } = renderHook(
      () => ({
        bar: useSaveBar(),
        _: useFormSaveBar({
          id: 'f2',
          isDirty: true,
          onSave: vi.fn(),
          dirtyFields: { title: true, body: true },
        }),
      }),
      { wrapper },
    );
    expect(result.current.bar.activeEntry?.changeCount).toBe(2);
  });

  it('passes changedFields and a per-field revert callback through to the bar', () => {
    const revertField = vi.fn();
    const { result } = renderHook(
      () => ({
        bar: useSaveBar(),
        _: useFormSaveBar({
          id: 'f3',
          isDirty: true,
          onSave: vi.fn(),
          revertField,
          changedFields: [{ name: 'title', label: 'Title' }],
        }),
      }),
      { wrapper },
    );
    const entry = result.current.bar.activeEntry;
    expect(entry?.changedFields).toEqual([{ name: 'title', label: 'Title' }]);
    act(() => entry?.onRevertField?.('title'));
    expect(revertField).toHaveBeenCalledWith('title');
  });

  it('stays registered while saving even if no longer dirty (so the bar shows the spinner)', () => {
    const { result } = renderHook(
      () => ({
        bar: useSaveBar(),
        _: useFormSaveBar({ id: 'f4', isDirty: false, saving: true, onSave: vi.fn() }),
      }),
      { wrapper },
    );
    expect(result.current.bar.activeEntry?.id).toBe('f4');
    expect(result.current.bar.activeEntry?.saving).toBe(true);
  });
});
