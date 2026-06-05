import { type ReactNode } from 'react';
import { useRegisterSaveBar, type ChangedField } from '@/store/SaveBarContext';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';

/**
 * Counts the changed leaves in a react-hook-form `dirtyFields` object.
 *
 * RHF represents dirty state as a structurally-mirrored object where each
 * changed primitive is `true` and nested objects/arrays recurse. We count
 * every truthy leaf so "3 unsaved changes" matches what the user edited,
 * regardless of nesting (e.g. `seo.title`, array rows).
 */
export function countDirtyFields(dirty: unknown): number {
  if (!dirty || typeof dirty !== 'object') return dirty ? 1 : 0;
  let count = 0;
  for (const value of Object.values(dirty as Record<string, unknown>)) {
    if (value && typeof value === 'object') count += countDirtyFields(value);
    else if (value) count += 1;
  }
  return count;
}

export interface UseFormSaveBarOptions {
  /** Stable form id; also used as the navigation-guard key. */
  id: string;
  /** Whether the form has unsaved changes. */
  isDirty: boolean;
  /** True while the save mutation is running. */
  saving?: boolean;
  /** Called when the user hits Save. */
  onSave: () => void;
  /** Called when the user hits Discard (reset the whole form). */
  onDiscard?: () => void;
  /** RHF `formState.dirtyFields`; used to derive the change count. */
  dirtyFields?: unknown;
  /** Explicit change count; overrides the count derived from `dirtyFields`. */
  changeCount?: number;
  /** Reverts a single field (RHF `resetField`); enables per-field revert. */
  revertField?: (name: string) => void;
  /** Changed fields for the popover; pair names with human labels. */
  changedFields?: ChangedField[];
  /** Custom status node; defaults to the change-count text in the bar. */
  status?: ReactNode;
  saveLabel?: ReactNode;
  savingLabel?: ReactNode;
  discardLabel?: ReactNode;
  saveTestId?: string;
  discardTestId?: string;
  /** Guard in-app/browser navigation while dirty. Default true. */
  guardNavigation?: boolean;
  /**
   * Force the bar visible even when not dirty (e.g. a mode that always needs
   * an explicit save). Decoupled from the navigation guard, which still keys
   * off `isDirty` so it never nags when there are no real edits.
   */
  forceVisible?: boolean;
}

/**
 * The single seam every page-level form uses to opt into the global save
 * system. One call wires up:
 *  - the floating save bar (via {@link useRegisterSaveBar}),
 *  - the unsaved-changes navigation guard + `beforeunload`
 *    (via {@link useNavigationGuard}),
 *  - the change count and per-field revert surfaced in the bar.
 *
 * Replaces the old autosave hook: saving is now explicit and reversible.
 */
export function useFormSaveBar({
  id,
  isDirty,
  saving = false,
  onSave,
  onDiscard,
  dirtyFields,
  changeCount,
  revertField,
  changedFields,
  status,
  saveLabel,
  savingLabel,
  discardLabel,
  saveTestId,
  discardTestId,
  guardNavigation = true,
  forceVisible = false,
}: UseFormSaveBarOptions): void {
  const count = changeCount ?? countDirtyFields(dirtyFields);

  useNavigationGuard(id, guardNavigation && isDirty);

  useRegisterSaveBar(id, {
    visible: isDirty || saving || forceVisible,
    saving,
    status,
    changeCount: count,
    changedFields,
    onRevertField: revertField,
    onSave,
    onDiscard,
    saveLabel,
    savingLabel,
    discardLabel,
    saveTestId,
    discardTestId,
  });
}
