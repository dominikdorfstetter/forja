import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  isDirty: boolean;
  onSave: () => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
  onError?: (error: unknown) => void;
  maxRetries?: number;
  /** Value that changes on every form edit. Restarts the debounce timer. */
  formVersion?: number;
}

interface UseAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  flush: () => Promise<void>;
}

export function useAutosave({
  isDirty,
  onSave,
  debounceMs = 3000,
  enabled = true,
  onError,
  maxRetries = 3,
  formVersion = 0,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs to avoid stale closures in the retry loop
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setStatus('saving');

    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }

    const delays = [2000, 4000, 8000];
    const attempts = maxRetries + 1; // 1 initial + N retries

    for (let i = 0; i < attempts; i++) {
      try {
        await onSaveRef.current();
        setLastSavedAt(new Date());
        setStatus('saved');
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
        savingRef.current = false;
        return;
      } catch (err) {
        if (i < attempts - 1) {
          // Wait before retrying
          await new Promise((r) => setTimeout(r, delays[i] ?? delays[delays.length - 1]));
        } else {
          // All retries exhausted
          setStatus('error');
          onErrorRef.current?.(err);
          // Auto-reset error after 5s so next dirty change can trigger autosave
          savedTimerRef.current = setTimeout(() => setStatus('idle'), 5000);
        }
      }
    }
    savingRef.current = false;
  }, [maxRetries]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isDirty && !savingRef.current) {
      await save();
    }
  }, [isDirty, save]);

  // Debounce autosave on dirty changes — formVersion restarts the timer on each edit
  useEffect(() => {
    if (!enabled || !isDirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, isDirty, debounceMs, save, formVersion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return { status, lastSavedAt, flush };
}
