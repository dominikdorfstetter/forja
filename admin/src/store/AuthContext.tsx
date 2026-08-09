import { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import type { ApiKeyPermission, MembershipSummary, SiteRole } from '@/types/api';
import { getAuthMe } from '@/services/auth';
import { setClerkTokenGetter } from '@/services/http';
import { isGuestApiKey, clearApiKey } from '@/services/apiKeyStorage';

interface AuthState {
  permission: ApiKeyPermission | null;
  siteId: string | null;
  loading: boolean;
  memberships: MembershipSummary[];
  isSystemAdmin: boolean;
  isGuest: boolean;
  demoMode: boolean;
}

type AuthAction =
  | { type: 'loading' }
  | { type: 'reset' }
  | { type: 'loaded'; permission: ApiKeyPermission; siteId: string | null; memberships: MembershipSummary[]; isSystemAdmin: boolean; isGuest: boolean; demoMode: boolean };

const INITIAL_AUTH_STATE: AuthState = {
  permission: null,
  siteId: null,
  loading: true,
  memberships: [],
  isSystemAdmin: false,
  isGuest: false,
  demoMode: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true };
    case 'reset':
      return { ...INITIAL_AUTH_STATE, loading: false, isGuest: false };
    case 'loaded':
      return {
        permission: action.permission,
        siteId: action.siteId,
        loading: false,
        memberships: action.memberships,
        isSystemAdmin: action.isSystemAdmin,
        isGuest: action.isGuest,
        demoMode: action.demoMode,
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
  /** Sign out via Clerk (or clear guest session) */
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
  /** Whether the server is in demo mode */
  demoMode: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Shared selected-site ID used for deriving currentSiteRole.
 *  Exposed as a `useSyncExternalStore` so subscribers (AuthProvider) read the
 *  current value on every render and never miss a notify, regardless of
 *  parent/child effect ordering.
 */
let _selectedSiteId = '';
const _listeners = new Set<() => void>();
export function notifySelectedSiteChanged(siteId: string) {
  _selectedSiteId = siteId;
  _listeners.forEach((fn) => fn());
}
function subscribeSelectedSite(callback: () => void): () => void {
  _listeners.add(callback);
  return () => { _listeners.delete(callback); };
}
function getSelectedSiteSnapshot(): string {
  return _selectedSiteId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken, signOut } = useClerkAuth();
  const { user } = useUser();

  const [state, dispatch] = useReducer(authReducer, {
    ...INITIAL_AUTH_STATE,
    isGuest: isGuestApiKey(),
  });

  // Track selected site for role derivation. useSyncExternalStore reads the
  // current snapshot on every render, so AuthProvider can never miss a notify
  // fired from a child SiteProvider before AuthProvider's effects run.
  const activeSiteId = useSyncExternalStore(subscribeSelectedSite, getSelectedSiteSnapshot);

  // Register the Clerk token getter with the API service
  useEffect(() => {
    setClerkTokenGetter(getToken);
    return () => {
      setClerkTokenGetter(null);
    };
  }, [getToken]);

  // When Clerk auth state changes, fetch /auth/me to get CMS permissions.
  // Also supports guest mode: if Clerk is not signed in but a guest API key
  // exists in sessionStorage, fetch /auth/me using that key instead.
  useEffect(() => {
    if (!isLoaded) return;

    const guestMode = !isSignedIn && isGuestApiKey();

    if (!isSignedIn && !guestMode) {
      dispatch({ type: 'reset' });
      return;
    }

    dispatch({ type: 'loading' });

    let cancelled = false;
    getAuthMe().then(
      (info) => {
        if (!cancelled) {
          dispatch({
            type: 'loaded',
            permission: info.permission,
            siteId: info.site_id ?? null,
            memberships: info.memberships ?? [],
            isSystemAdmin: info.is_system_admin ?? false,
            isGuest: guestMode,
            demoMode: info.demo_mode ?? false,
          });
        }
      },
      () => {
        if (!cancelled) {
          if (guestMode) clearApiKey();
          dispatch({ type: 'reset' });
        }
      },
    );
    return () => { cancelled = true; };
  }, [isSignedIn, isLoaded]);

  const logout = useCallback(async () => {
    if (state.isGuest) {
      clearApiKey();
      dispatch({ type: 'reset' });
      window.location.href = '/';
      return;
    }
    await signOut();
    dispatch({ type: 'reset' });
  }, [signOut, state.isGuest]);

  const refreshAuth = useCallback(async () => {
    try {
      const info = await getAuthMe();
      dispatch({
        type: 'loaded',
        permission: info.permission,
        siteId: info.site_id ?? null,
        memberships: info.memberships ?? [],
        isSystemAdmin: info.is_system_admin ?? false,
        isGuest: isGuestApiKey(),
        demoMode: info.demo_mode ?? false,
      });
    } catch {
      // Silently ignore refresh errors
    }
  }, []);

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

  const value: AuthContextValue = useMemo(() => {
    const perm = state.permission;
    const hasAtLeast = (min: SiteRole): boolean => {
      if (!currentSiteRole) return false;
      return ROLE_RANK[currentSiteRole] >= ROLE_RANK[min];
    };
    return {
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
    isOwner: state.isSystemAdmin || currentSiteRole === 'owner',
    // User info
    clerkUserId: user?.id ?? null,
    userEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    userFullName: user?.fullName ?? null,
    userImageUrl: user?.imageUrl ?? null,
    getRoleForSite,
    demoMode: state.demoMode,
    };
  }, [state, logout, refreshAuth, currentSiteRole, user, getRoleForSite]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
