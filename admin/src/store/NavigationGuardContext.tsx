import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface NavigationGuardContextValue {
  registerGuard: (id: string, isDirty: boolean) => void;
  unregisterGuard: (id: string) => void;
  guardedNavigate: (to: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const guards = useRef<Map<string, boolean>>(new Map());
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const registerGuard = useCallback((id: string, isDirty: boolean) => {
    guards.current.set(id, isDirty);
  }, []);

  const unregisterGuard = useCallback((id: string) => {
    guards.current.delete(id);
  }, []);

  const hasDirtyGuards = useCallback(() => {
    for (const dirty of guards.current.values()) {
      if (dirty) return true;
    }
    return false;
  }, []);

  const guardedNavigate = useCallback((to: string) => {
    if (hasDirtyGuards()) {
      setPendingPath(to);
    } else {
      navigate(to);
    }
  }, [hasDirtyGuards, navigate]);

  const handleConfirmLeave = useCallback(() => {
    const path = pendingPath;
    setPendingPath(null);
    // Clear all guards so the navigation doesn't re-trigger
    guards.current.clear();
    if (path) navigate(path);
  }, [pendingPath, navigate]);

  const handleCancelLeave = useCallback(() => {
    setPendingPath(null);
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, unregisterGuard, guardedNavigate }}>
      {children}
      <ConfirmDialog
        open={pendingPath !== null}
        title={t('shared.navigationGuard.title')}
        message={t('shared.navigationGuard.message')}
        confirmLabel={t('shared.navigationGuard.leave')}
        confirmColor="warning"
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuardContext() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error('useNavigationGuardContext must be used within NavigationGuardProvider');
  return ctx;
}
