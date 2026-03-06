import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { SiteMembership } from '@/types/api';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockAuth = {
  permission: 'Admin' as const,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  memberships: [],
  isSystemAdmin: false,
  siteId: null,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  currentSiteRole: 'admin' as const,
  canManageMembers: true,
  canEditAll: true,
  isOwner: false,
  clerkUserId: 'clerk-1',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: () => 'admin' as const,
};

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockMember: SiteMembership = {
  id: 'm-1',
  site_id: 'site-1',
  clerk_user_id: 'clerk-user-2',
  role: 'editor',
  name: 'Jane Doe',
  email: 'jane@example.com',
  image_url: undefined,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockOwner: SiteMembership = {
  id: 'm-2',
  site_id: 'site-1',
  clerk_user_id: 'clerk-1',
  role: 'owner',
  name: 'Test User',
  email: 'test@example.com',
  image_url: undefined,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

let MembersPage: typeof import('@/pages/Members').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockAuth.canManageMembers = true;
  mockAuth.isOwner = false;
  const mod = await import('@/pages/Members');
  MembersPage = mod.default;
});

describe('MembersPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getSiteMembers).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MembersPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders member table after data loads', async () => {
    vi.mocked(apiService.getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
    renderWithProviders(<MembersPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('shows empty state when no members', async () => {
    vi.mocked(apiService.getSiteMembers).mockResolvedValue([]);
    renderWithProviders(<MembersPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('shows error state on API failure', async () => {
    vi.mocked(apiService.getSiteMembers).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<MembersPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });
});
