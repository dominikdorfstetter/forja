import { useCallback, useRef, useState } from 'react';
import type { UseFormGetValues, UseFormReset, FieldValues } from 'react-hook-form';

interface FormHistoryReturn {
  /** Push the current form state onto the history stack */
  snapshot: () => void;
  /** Undo to the previous snapshot (returns false if nothing to undo) */
  undo: () => boolean;
  /** Redo to the next snapshot (returns false if nothing to redo) */
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Reset history (call when form is opened/closed) */
  clear: () => void;
}

/**
 * Tracks undo/redo history for a react-hook-form instance.
 *
 * Usage:
 *   const { snapshot, undo, redo, canUndo, canRedo, clear } = useFormHistory(getValues, reset);
 *   // Call snapshot() after meaningful changes (e.g. on field blur)
 *   // Call undo()/redo() from toolbar buttons
 *   // Call clear() when dialog opens or closes
 */
export function useFormHistory<T extends FieldValues>(
  getValues: UseFormGetValues<T>,
  reset: UseFormReset<T>,
  maxSize = 50,
): FormHistoryReturn {
  const stackRef = useRef<T[]>([]);
  const indexRef = useRef(-1);
  const [, forceUpdate] = useState(0);

  const clear = useCallback(() => {
    stackRef.current = [];
    indexRef.current = -1;
    forceUpdate((n) => n + 1);
  }, []);

  const snapshot = useCallback(() => {
    const values = getValues();
    const json = JSON.stringify(values);

    // Skip if identical to current position
    if (
      indexRef.current >= 0 &&
      JSON.stringify(stackRef.current[indexRef.current]) === json
    ) {
      return;
    }

    // Truncate any redo entries beyond current position
    stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
    stackRef.current.push(JSON.parse(json) as T);

    // Enforce max size
    if (stackRef.current.length > maxSize) {
      stackRef.current.shift();
    } else {
      indexRef.current += 1;
    }

    forceUpdate((n) => n + 1);
  }, [getValues, maxSize]);

  const undo = useCallback((): boolean => {
    if (indexRef.current <= 0) return false;

    // If this is the first undo, snapshot current state so redo can restore it
    if (indexRef.current === stackRef.current.length - 1) {
      const current = getValues();
      const currentJson = JSON.stringify(current);
      const topJson = JSON.stringify(stackRef.current[indexRef.current]);
      if (currentJson !== topJson) {
        stackRef.current.push(JSON.parse(currentJson) as T);
        indexRef.current += 1;
      }
    }

    indexRef.current -= 1;
    reset(stackRef.current[indexRef.current], { keepDirty: true, keepTouched: true });
    forceUpdate((n) => n + 1);
    return true;
  }, [getValues, reset]);

  const redo = useCallback((): boolean => {
    if (indexRef.current >= stackRef.current.length - 1) return false;
    indexRef.current += 1;
    reset(stackRef.current[indexRef.current], { keepDirty: true, keepTouched: true });
    forceUpdate((n) => n + 1);
    return true;
  }, [reset]);

  return {
    snapshot,
    undo,
    redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < stackRef.current.length - 1,
    clear,
  };
}
