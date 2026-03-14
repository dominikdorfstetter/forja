import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, FederationActivity } from '@/types/api';

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

const mockActivities: Paginated<FederationActivity> = {
  data: [
    {
      id: 'act-1',
      activityType: 'Create',
      actorUri: 'https://example.com/users/myblog',
      objectUri: 'https://example.com/posts/1',
      direction: 'out',
      status: 'delivered',
      errorMessage: null,
      createdAt: '2025-06-01T10:00:00Z',
    },
    {
      id: 'act-2',
      activityType: 'Follow',
      actorUri: 'https://mastodon.social/users/alice',
      objectUri: null,
      direction: 'in',
      status: 'processed',
      errorMessage: null,
      createdAt: '2025-06-01T09:00:00Z',
    },
  ],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

let FederationActivityLog: typeof import('../FederationActivityLog').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../FederationActivityLog');
  FederationActivityLog = mod.default;
});

describe('FederationActivityLog', () => {
  it('renders activity rows after data loads', async () => {
    vi.mocked(apiService.getFederationActivities).mockResolvedValue(mockActivities);
    renderWithProviders(<FederationActivityLog />);
    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
    expect(screen.getByText('Follow')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.mocked(apiService.getFederationActivities).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<FederationActivityLog />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
