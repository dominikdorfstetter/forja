import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ChangedField {
  /** RHF field path, e.g. "seo.title". Used as the revert key. */
  name: string;
  /** Human label shown in the changed-fields popover. */
  label: string;
}

export interface SaveBarRegistration {
  /** Status text rendered on the left of the bar, e.g. "Unsaved changes". */
  status?: ReactNode;
  /** True while the mutation is running; used to disable the buttons and show a saving label. */
  saving?: boolean;
  /**
   * Number of changed fields. When > 0 the bar shows "N unsaved changes"
   * instead of the generic status text.
   */
  changeCount?: number;
  /**
   * The changed fields, surfaced in a popover so the user can see and
   * revert individual edits. Optional — omit to hide the popover.
   */
  changedFields?: ChangedField[];
  /** Fired when the user reverts a single field from the popover. */
  onRevertField?: (name: string) => void;
  /** Fired when the user hits Save. */
  onSave?: () => void;
  /** Fired when the user hits Discard. Optional — if omitted, the Discard button is hidden. */
  onDiscard?: () => void;
  /** Override labels; sensible defaults come from i18n in the host. */
  saveLabel?: ReactNode;
  savingLabel?: ReactNode;
  discardLabel?: ReactNode;
  /** Optional test IDs for e2e hooks. */
  saveTestId?: string;
  discardTestId?: string;
}

interface InternalEntry extends SaveBarRegistration {
  id: string;
  registeredAt: number;
}

interface SaveBarContextValue {
  register: (id: string, entry: SaveBarRegistration) => void;
  unregister: (id: string) => void;
  activeEntry: InternalEntry | undefined;
}

const SaveBarContext = createContext<SaveBarContextValue | undefined>(undefined);

/**
 * Holds at most N dirty-form registrations from around the app. The global
 * save bar at the bottom of the shell reads `activeEntry` (the most
 * recently registered entry) and renders Save/Discard wired to it.
 *
 * The pattern lets any page declare "while I'm dirty, dock a save bar
 * somewhere in the chrome" without owning the bar's position or style.
 * Multiple pages can register if they mount simultaneously (e.g. two
 * independent editors on one settings page) — the most recent wins.
 */
export function SaveBarProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, InternalEntry>>({});

  const register = useCallback((id: string, entry: SaveBarRegistration) => {
    setEntries((prev) => ({
      ...prev,
      [id]: { ...entry, id, registeredAt: Date.now() },
    }));
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const activeEntry = useMemo(() => {
    const list = Object.values(entries);
    if (list.length === 0) return undefined;
    return list.reduce((latest, e) => (e.registeredAt > latest.registeredAt ? e : latest));
  }, [entries]);

  const value = useMemo(
    () => ({ register, unregister, activeEntry }),
    [register, unregister, activeEntry],
  );

  return <SaveBarContext.Provider value={value}>{children}</SaveBarContext.Provider>;
}

export function useSaveBar() {
  const ctx = useContext(SaveBarContext);
  if (!ctx) throw new Error('useSaveBar must be used inside SaveBarProvider');
  return ctx;
}

/**
 * Register a save-bar entry while `visible` is true and tear it down
 * otherwise (or on unmount). The save/discard callbacks are captured via
 * refs so they always fire against the latest closure without re-running
 * the registration effect on every render.
 */
export function useRegisterSaveBar(
  id: string,
  options: SaveBarRegistration & { visible: boolean },
) {
  const { register, unregister } = useSaveBar();

  const saveRef = useRef(options.onSave);
  const discardRef = useRef(options.onDiscard);
  const revertFieldRef = useRef(options.onRevertField);
  const changedFieldsRef = useRef(options.changedFields);
  useEffect(() => {
    saveRef.current = options.onSave;
    discardRef.current = options.onDiscard;
    revertFieldRef.current = options.onRevertField;
    changedFieldsRef.current = options.changedFields;
  });

  const {
    visible,
    status,
    saving,
    changeCount,
    saveLabel,
    savingLabel,
    discardLabel,
    saveTestId,
    discardTestId,
  } = options;

  // Re-register when the set of changed fields changes (by identity of names),
  // so the popover stays in sync without re-running on every keystroke.
  const changedFieldsKey = options.changedFields?.map((f) => f.name).join(',') ?? '';

  useEffect(() => {
    if (!visible) {
      unregister(id);
      return;
    }
    register(id, {
      status,
      saving,
      changeCount,
      changedFields: changedFieldsRef.current,
      onRevertField: revertFieldRef.current
        ? (name) => revertFieldRef.current?.(name)
        : undefined,
      onSave: () => saveRef.current?.(),
      onDiscard: discardRef.current ? () => discardRef.current?.() : undefined,
      saveLabel,
      savingLabel,
      discardLabel,
      saveTestId,
      discardTestId,
    });
    return () => unregister(id);
  }, [
    id,
    visible,
    status,
    saving,
    changeCount,
    changedFieldsKey,
    saveLabel,
    savingLabel,
    discardLabel,
    saveTestId,
    discardTestId,
    register,
    unregister,
  ]);
}
