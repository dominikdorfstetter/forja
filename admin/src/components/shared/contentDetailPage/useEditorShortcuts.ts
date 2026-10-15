import { useEffect, useRef } from 'react';

interface UndoRedo {
  undo: () => unknown;
  redo: () => unknown;
}

/**
 * Editor keyboard shortcuts: Cmd/Ctrl+S = save, Cmd/Ctrl+Z = undo,
 * Cmd/Ctrl+Shift+Z = redo.
 */
export function useEditorShortcuts(save: () => Promise<void>, history: UndoRedo) {
  // `save` is read only inside the handler, so hold it in a ref and keep the
  // listener bound once — re-subscribing on every `save` identity change is
  // pointless churn (equivalent to a stable Effect Event).
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        void saveRef.current();
      } else if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        history.redo();
      } else if (mod && e.key === 'z') {
        e.preventDefault();
        history.undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history]);
}
