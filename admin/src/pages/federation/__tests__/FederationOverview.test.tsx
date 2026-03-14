import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import apiService from '@/services/api';
import type { FederationStats, FederationSettings } from '@/types/api';

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

const mockStats: FederationStats = {
  follower_count: 142,
  outbound_activities: 28,
  inbound_activities: 10,
  failed_activities: 1,
  pending_comments: 3,
  blocked_instances: 0,
  blocked_actors: 0,
};

const mockSettings: FederationSettings = {
  enabled: true,
  signature_algorithm: 'rsa-sha256',
  moderation_mode: 'queue_all',
  auto_publish: true,
  actor_uri: 'https://example.com/ap/actor/myblog',
  webfinger_address: 'myblog@example.com',
};

let FederationOverview: typeof import('../FederationOverview').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../FederationOverview');
  FederationOverview = mod.default;
});

describe('FederationOverview', () => {
  it('renders stats cards', async () => {
    vi.mocked(apiService.getFederationStats).mockResolvedValue(mockStats);
    vi.mocked(apiService.getFederationSettings).mockResolvedValue(mockSettings);

    renderWithProviders(<FederationOverview />);
    expect(await screen.findByText('142')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays the fediverse handle', async () => {
    vi.mocked(apiService.getFederationStats).mockResolvedValue(mockStats);
    vi.mocked(apiService.getFederationSettings).mockResolvedValue(mockSettings);

    renderWithProviders(<FederationOverview />);
    expect(await screen.findByText('@myblog@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy handle')).toBeInTheDocument();
  });

  it('shows disabled state when federation is off', async () => {
    vi.mocked(apiService.getFederationStats).mockResolvedValue({
      follower_count: 0,
      outbound_activities: 0,
      inbound_activities: 0,
      failed_activities: 0,
      pending_comments: 0,
      blocked_instances: 0,
      blocked_actors: 0,
    });
    vi.mocked(apiService.getFederationSettings).mockResolvedValue({
      ...mockSettings,
      enabled: false,
      actor_uri: undefined,
      webfinger_address: undefined,
    });

    renderWithProviders(<FederationOverview />);
    expect(await screen.findByText('Disabled')).toBeInTheDocument();
  });
});
