import { useEffect } from 'react';
import { useNavigationGuardContext } from '@/store/NavigationGuardContext';

/**
 * Registers a navigation guard that blocks in-app sidebar navigation
 * and browser-level navigation (close tab, refresh) when isDirty is true.
 */
export function useNavigationGuard(id: string, isDirty: boolean) {
  const { registerGuard, unregisterGuard } = useNavigationGuardContext();

  // Keep the guard registration in sync with isDirty
  useEffect(() => {
    registerGuard(id, isDirty);
    return () => unregisterGuard(id);
  }, [id, isDirty, registerGuard, unregisterGuard]);

  // Browser-level beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
