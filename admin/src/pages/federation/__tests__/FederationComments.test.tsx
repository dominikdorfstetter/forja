import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, FederationComment } from '@/types/api';

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

const mockComments: Paginated<FederationComment> = {
  data: [
    {
      id: 'c-1',
      contentId: 'blog-1',
      authorActorUri: 'https://mastodon.social/users/alice',
      authorName: 'Alice',
      authorAvatarUrl: null,
      bodyHtml: '<p>Great post!</p>',
      status: 'pending',
      createdAt: '2025-06-01T10:00:00Z',
      moderatedAt: null,
    },
    {
      id: 'c-2',
      contentId: 'blog-2',
      authorActorUri: 'https://fosstodon.org/users/bob',
      authorName: 'Bob',
      authorAvatarUrl: null,
      bodyHtml: '<p>Interesting read.</p>',
      status: 'approved',
      createdAt: '2025-06-02T10:00:00Z',
      moderatedAt: '2025-06-02T11:00:00Z',
    },
  ],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

let FederationComments: typeof import('../FederationComments').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../FederationComments');
  FederationComments = mod.default;
});

describe('FederationComments', () => {
  it('renders comment rows after data loads', async () => {
    vi.mocked(apiService.getFederationComments).mockResolvedValue(mockComments);
    renderWithProviders(<FederationComments />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.mocked(apiService.getFederationComments).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<FederationComments />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
