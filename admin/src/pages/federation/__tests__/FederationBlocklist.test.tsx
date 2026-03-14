import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, FederationBlockedInstance, FederationBlockedActor } from '@/types/api';

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

const mockBlockedInstances: Paginated<FederationBlockedInstance> = {
  data: [
    {
      id: 'bi-1',
      instanceDomain: 'spam.example.com',
      reason: 'Spam',
      blockedAt: '2025-06-01T00:00:00Z',
    },
  ],
  meta: { page: 1, page_size: 25, total_items: 1, total_pages: 1 },
};

const mockBlockedActors: Paginated<FederationBlockedActor> = {
  data: [
    {
      id: 'ba-1',
      blockedActorUri: 'https://spam.example.com/users/spammer',
      reason: 'Abusive',
      blockedAt: '2025-06-01T00:00:00Z',
    },
  ],
  meta: { page: 1, page_size: 25, total_items: 1, total_pages: 1 },
};

let FederationBlocklist: typeof import('../FederationBlocklist').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../FederationBlocklist');
  FederationBlocklist = mod.default;
});

describe('FederationBlocklist', () => {
  it('renders blocked instances tab by default', async () => {
    vi.mocked(apiService.getBlockedInstances).mockResolvedValue(mockBlockedInstances);
    vi.mocked(apiService.getBlockedActors).mockResolvedValue(mockBlockedActors);
    renderWithProviders(<FederationBlocklist />);
    await waitFor(() => {
      expect(screen.getByText('spam.example.com')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(apiService.getBlockedInstances).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getBlockedActors).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<FederationBlocklist />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
