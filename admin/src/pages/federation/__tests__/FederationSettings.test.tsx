import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { FederationSettings } from '@/types/api';

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

const mockSettings: FederationSettings = {
  enabled: true,
  actorHandle: '@myblog@example.com',
  signatureAlgorithm: 'rsa-sha256',
  moderationMode: 'queue_all',
  autoPublish: true,
  summary: 'A blog about tech',
  avatarUrl: null,
};

let FederationSettingsPage: typeof import('../FederationSettings').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../FederationSettings');
  FederationSettingsPage = mod.default;
});

describe('FederationSettings', () => {
  it('renders settings form with current values', async () => {
    vi.mocked(apiService.getFederationSettings).mockResolvedValue(mockSettings);
    renderWithProviders(<FederationSettingsPage />);
    expect(await screen.findByText('@myblog@example.com')).toBeInTheDocument();
  });

  it('shows the enable/disable toggle', async () => {
    vi.mocked(apiService.getFederationSettings).mockResolvedValue(mockSettings);
    renderWithProviders(<FederationSettingsPage />);
    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Enable Federation')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(apiService.getFederationSettings).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<FederationSettingsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
