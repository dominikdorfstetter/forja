import { useEffect, useState } from 'react';

/**
 * Open state for the dashboard's QuickPostDialog. The command palette can
 * open it too, by dispatching `command-palette:action` with detail
 * `'quick-post'`.
 */
export function useQuickPostShortcut() {
  const [quickPostOpen, setQuickPostOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'quick-post') {
        setQuickPostOpen(true);
      }
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  return [quickPostOpen, setQuickPostOpen] as const;
}
