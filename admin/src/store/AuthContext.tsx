import { createContext, useContext, useState, useReducer, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import type { ApiKeyPermission, MembershipSummary, SiteRole } from '@/types/api';
import apiService from '@/services/api';

interface AuthState {
  permission: ApiKeyPermission | null;
  siteId: string | null;
  loading: boolean;
  memberships: MembershipSummary[];
  isSystemAdmin: boolean;
}

type AuthAction =
  | { type: 'loading' }
  | { type: 'reset' }
  | { type: 'loaded'; permission: ApiKeyPermission; siteId: string | null; memberships: MembershipSummary[]; isSystemAdmin: boolean };

const INITIAL_AUTH_STATE: AuthState = {
  permission: null,
  siteId: null,
  loading: true,
  memberships: [],
  isSystemAdmin: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true };
    case 'reset':
      return { ...INITIAL_AUTH_STATE, loading: false };
    case 'loaded':
      return {
        permission: action.permission,
        siteId: action.siteId,
        loading: false,
        memberships: action.memberships,
        isSystemAdmin: action.isSystemAdmin,
      };
  }
}

/** Role rank for comparison */
const ROLE_RANK: Record<SiteRole, number> = {
  owner: 60,
  admin: 50,
  editor: 40,
  author: 30,
  reviewer: 20,
  viewer: 10,
};

interface AuthContextValue extends AuthState {
  /** Sign out via Clerk */
  logout: () => Promise<void>;
  /** Re-fetch /auth/me to refresh permissions & memberships */
  refreshAuth: () => Promise<void>;
  /** Permission helpers (combine API-key permission + site role) */
  canRead: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  isMaster: boolean;
  /** Site-scoped role for the currently selected site */
  currentSiteRole: SiteRole | null;
  /** Site-scoped permission helpers */
  canManageMembers: boolean;
  canEditAll: boolean;
  isOwner: boolean;
  /** Clerk user info */
  clerkUserId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  userImageUrl: string | null;
  /** Get role for a specific site */
  getRoleForSite: (siteId: string) => SiteRole | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Shared selected-site ID used for deriving currentSiteRole */
let _selectedSiteId = '';
const _listeners = new Set<() => void>();
export function notifySelectedSiteChanged(siteId: string) {
  _selectedSiteId = siteId;
  _listeners.forEach((fn) => fn());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken, signOut } = useClerkAuth();
  const { user } = useUser();

  const [state, dispatch] = useReducer(authReducer, INITIAL_AUTH_STATE);

  // Track selected site for role derivation
  const [activeSiteId, setActiveSiteId] = useState(_selectedSiteId);
  useEffect(() => {
    const handler = () => setActiveSiteId(_selectedSiteId);
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);

  // Register the Clerk token getter with the API service
  useEffect(() => {
    apiService.setClerkTokenGetter(getToken);
    return () => {
      apiService.setClerkTokenGetter(null);
    };
  }, [getToken]);

  // When Clerk auth state changes, fetch /auth/me to get CMS permissions
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      dispatch({ type: 'reset' });
      return;
    }

    dispatch({ type: 'loading' });

    let cancelled = false;
    apiService.getAuthMe().then(
      (info) => {
        if (!cancelled) {
          dispatch({
            type: 'loaded',
            permission: info.permission,
            siteId: info.site_id ?? null,
            memberships: info.memberships ?? [],
            isSystemAdmin: info.is_system_admin ?? false,
          });
        }
      },
      () => {
        if (!cancelled) {
          dispatch({ type: 'reset' });
        }
      },
    );
    return () => { cancelled = true; };
  }, [isSignedIn, isLoaded]);

  const logout = useCallback(async () => {
    await signOut();
    dispatch({ type: 'reset' });
  }, [signOut]);

  const refreshAuth = useCallback(async () => {
    try {
      const info = await apiService.getAuthMe();
      dispatch({
        type: 'loaded',
        permission: info.permission,
        siteId: info.site_id ?? null,
        memberships: info.memberships ?? [],
        isSystemAdmin: info.is_system_admin ?? false,
      });
    } catch {
      // Silently ignore refresh errors
    }
  }, []);

  const perm = state.permission;

  const getRoleForSite = useCallback(
    (siteId: string): SiteRole | null => {
      if (state.isSystemAdmin) return 'owner';
      const m = state.memberships.find((ms) => ms.site_id === siteId);
      return m?.role ?? null;
    },
    [state.memberships, state.isSystemAdmin],
  );

  const currentSiteRole = useMemo(() => {
    const siteId = state.siteId || activeSiteId;
    if (!siteId) return null;
    return getRoleForSite(siteId);
  }, [state.siteId, activeSiteId, getRoleForSite]);

  const hasAtLeast = (min: SiteRole): boolean => {
    if (!currentSiteRole) return false;
    return ROLE_RANK[currentSiteRole] >= ROLE_RANK[min];
  };

  const value: AuthContextValue = {
    ...state,
    logout,
    refreshAuth,
    // Permission helpers (combine API-key permission + site role)
    canRead: perm !== null,
    canWrite: perm === 'Write' || perm === 'Admin' || perm === 'Master' || state.isSystemAdmin || hasAtLeast('author'),
    isAdmin: perm === 'Admin' || perm === 'Master' || state.isSystemAdmin || hasAtLeast('admin'),
    isMaster: perm === 'Master' || state.isSystemAdmin,
    // Site-scoped
    currentSiteRole,
    canManageMembers: state.isSystemAdmin || hasAtLeast('admin'),
    canEditAll: state.isSystemAdmin || hasAtLeast('editor'),
    isOwner: currentSiteRole === 'owner',
    // User info
    clerkUserId: user?.id ?? null,
    userEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    userFullName: user?.fullName ?? null,
    userImageUrl: user?.imageUrl ?? null,
    getRoleForSite,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
