import { useEffect } from 'react';

/**
 * Shows a browser confirmation dialog when the user tries to close/refresh
 * the page while the form has unsaved changes.
 *
 * Note: In-app (React Router) navigation blocking requires a data router
 * (createBrowserRouter), which this app doesn't use. This hook only guards
 * against browser-level navigation (close tab, refresh, address bar).
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
