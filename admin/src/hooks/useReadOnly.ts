import { useMemo } from 'react';
import { useAuth } from '@/store/AuthContext';

interface DisabledProps {
  disabled: boolean;
  'aria-disabled': boolean;
}

export interface UseReadOnlyResult {
  /** True when the current user cannot perform write operations on the selected site. */
  readOnly: boolean;
  /** Inverse convenience — true when the current user can write. */
  canWrite: boolean;
  /** Spreadable props for MUI inputs / buttons that should reflect read-only state. */
  disabledProps: DisabledProps;
  /**
   * Pass through `value` only when the user can write; return `undefined` otherwise.
   *
   * Designed for MUI props like `onDelete`, `onClick`, and `onChange` where MUI
   * hides or no-ops the affordance when the handler is `undefined`. Lets callers
   * write `onDelete={gate(() => mutate(id))}` instead of inline ternaries.
   */
  gate: <T>(value: T) => T | undefined;
}

/**
 * Canonical read-only / write-permission hook for admin components.
 *
 * Wraps `useAuth().canWrite` so write affordances express intent at the use site
 * rather than re-deriving permission state from auth every time. Components that
 * gate a delete chip or a save button should prefer this hook over reading
 * `canWrite` directly — the audit (issue #451) treats `useReadOnly()` as the
 * documented seam.
 */
export function useReadOnly(): UseReadOnlyResult {
  const { canWrite } = useAuth();

  return useMemo(() => {
    const readOnly = !canWrite;
    return {
      readOnly,
      canWrite,
      disabledProps: {
        disabled: readOnly,
        'aria-disabled': readOnly,
      },
      gate: <T,>(value: T): T | undefined => (readOnly ? undefined : value),
    };
  }, [canWrite]);
}
