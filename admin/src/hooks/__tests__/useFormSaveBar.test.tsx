import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { ReactNode } from 'react';
import { SaveBarProvider, useSaveBar } from '@/store/SaveBarContext';
import {
  NavigationGuardProvider,
  useNavigationGuardContext,
} from '@/store/NavigationGuardContext';
import { useFormSaveBar, countDirtyFields } from '@/hooks/useFormSaveBar';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

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

// ---- End-to-end behavior through the global bar and the navigation guard ----

function FormHarness({
  isDirty,
  onSave,
  guardNavigation,
}: {
  isDirty: boolean;
  onSave?: () => void;
  guardNavigation?: boolean;
}) {
  useFormSaveBar({
    id: 'harness-form',
    isDirty,
    onSave: onSave ?? vi.fn(),
    guardNavigation,
    saveTestId: 'harness.btn.save',
  });
  const { guardedNavigate } = useNavigationGuardContext();
  return <button onClick={() => guardedNavigate('/elsewhere')}>go elsewhere</button>;
}

function harnessRoutes(props: React.ComponentProps<typeof FormHarness>) {
  return (
    <Routes>
      <Route path="/" element={<FormHarness {...props} />} />
      <Route path="/elsewhere" element={<div>arrived elsewhere</div>} />
    </Routes>
  );
}

describe('useFormSaveBar through the global save bar', () => {
  it('clicking Save in the bar invokes the form save handler', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(harnessRoutes({ isDirty: true, onSave }));

    await user.click(screen.getByTestId('harness.btn.save'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('blocks navigation while dirty and proceeds once the user confirms leaving', async () => {
    const user = userEvent.setup();
    renderWithProviders(harnessRoutes({ isDirty: true }));

    await user.click(screen.getByRole('button', { name: 'go elsewhere' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.queryByText('arrived elsewhere')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(screen.getByText('arrived elsewhere')).toBeInTheDocument();
  });

  it('navigates freely once the form is clean again (saved or reset)', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(harnessRoutes({ isDirty: true }));

    rerender(harnessRoutes({ isDirty: false }));
    await user.click(screen.getByRole('button', { name: 'go elsewhere' }));

    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(screen.getByText('arrived elsewhere')).toBeInTheDocument();
  });

  it('never blocks navigation when guardNavigation is disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(harnessRoutes({ isDirty: true, guardNavigation: false }));

    await user.click(screen.getByRole('button', { name: 'go elsewhere' }));
    expect(screen.getByText('arrived elsewhere')).toBeInTheDocument();
  });
});
