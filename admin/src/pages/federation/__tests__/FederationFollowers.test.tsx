import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, FederationFollower } from '@/types/api';

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

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    permission: 'Admin',
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockFollowers: Paginated<FederationFollower> = {
  data: [
    {
      id: 'f-1',
      actor_uri: 'https://mastodon.social/users/alice',
      inbox_uri: 'https://mastodon.social/users/alice/inbox',
      display_name: 'Alice',
      username: 'alice',
      avatar_url: null,
      status: 'accepted',
      followed_at: '2025-06-01T00:00:00Z',
    },
    {
      id: 'f-2',
      actor_uri: 'https://fosstodon.org/users/bob',
      inbox_uri: 'https://fosstodon.org/users/bob/inbox',
      display_name: 'Bob',
      username: 'bob',
      avatar_url: null,
      status: 'accepted',
      followed_at: '2025-06-02T00:00:00Z',
    },
  ],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

let FederationFollowers: typeof import('../FederationFollowers').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../FederationFollowers');
  FederationFollowers = mod.default;
});

describe('FederationFollowers', () => {
  it('renders follower rows after data loads', async () => {
    vi.mocked(apiService.getFederationFollowers).mockResolvedValue(mockFollowers);
    renderWithProviders(<FederationFollowers />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.mocked(apiService.getFederationFollowers).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<FederationFollowers />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no followers', async () => {
    vi.mocked(apiService.getFederationFollowers).mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
    });
    renderWithProviders(<FederationFollowers />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
