import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { createContext, useContext } from 'react';
import type { ApiKeyPermission, MembershipSummary, Site, SiteRole } from '@/types/api';

// ---- Auth context mock ----

interface AuthContextValue {
  permission: ApiKeyPermission | null;
  siteId: string | null;
  loading: boolean;
  memberships: MembershipSummary[];
  isSystemAdmin: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  canRead: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  isMaster: boolean;
  currentSiteRole: SiteRole | null;
  canManageMembers: boolean;
  canEditAll: boolean;
  isOwner: boolean;
  clerkUserId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  userImageUrl: string | null;
  getRoleForSite: (siteId: string) => SiteRole | null;
}

const defaultAuth: AuthContextValue = {
  permission: 'Admin',
  siteId: null,
  loading: false,
  memberships: [],
  isSystemAdmin: false,
  logout: async () => {},
  refreshAuth: async () => {},
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  currentSiteRole: 'admin',
  canManageMembers: true,
  canEditAll: true,
  isOwner: false,
  clerkUserId: 'clerk-user-1',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: () => 'admin',
};

const MockAuthContext = createContext<AuthContextValue>(defaultAuth);

// ---- Site context mock ----

interface SiteContextValue {
  selectedSiteId: string;
  setSelectedSiteId: (id: string) => void;
  selectedSite: Site | undefined;
  sites: Site[] | undefined;
  isLoading: boolean;
}

const testSite: Site = {
  id: 'site-1',
  name: 'Test Site',
  slug: 'test-site',
  timezone: 'UTC',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const defaultSite: SiteContextValue = {
  selectedSiteId: 'site-1',
  setSelectedSiteId: () => {},
  selectedSite: testSite,
  sites: [testSite],
  isLoading: false,
};

const MockSiteContext = createContext<SiteContextValue>(defaultSite);

// ---- Export hooks that match the real module API ----
// These are used inside vi.mock to redirect useAuth / useSiteContext to our mock contexts

export function useMockAuth() {
  return useContext(MockAuthContext);
}

export function useMockSiteContext() {
  return useContext(MockSiteContext);
}

// ---- Render options ----

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authOverrides?: Partial<AuthContextValue>;
  siteOverrides?: Partial<SiteContextValue>;
  route?: string;
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AllProviders({
  children,
  authOverrides,
  siteOverrides,
  route,
}: {
  children: ReactNode;
  authOverrides?: Partial<AuthContextValue>;
  siteOverrides?: Partial<SiteContextValue>;
  route?: string;
}) {
  const queryClient = createTestQueryClient();
  const authValue = { ...defaultAuth, ...authOverrides };
  const siteValue = { ...defaultSite, ...siteOverrides };

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route || '/']}>
        <SnackbarProvider maxSnack={3}>
          <MockAuthContext.Provider value={authValue}>
            <MockSiteContext.Provider value={siteValue}>
              {children}
            </MockSiteContext.Provider>
          </MockAuthContext.Provider>
        </SnackbarProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {},
) {
  const { authOverrides, siteOverrides, route, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders
        authOverrides={authOverrides}
        siteOverrides={siteOverrides}
        route={route}
      >
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
}

// Re-exports
export { screen, waitFor, within, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
