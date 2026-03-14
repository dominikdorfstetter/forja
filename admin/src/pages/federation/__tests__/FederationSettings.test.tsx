import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
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
  signature_algorithm: 'rsa-sha256',
  moderation_mode: 'queue_all',
  auto_publish: true,
  actor_uri: 'https://example.com/ap/actor/myblog',
  webfinger_address: 'myblog@example.com',
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
    // Settings tab now only shows sysadmin controls (algorithm, moderation, key management)
    expect(await screen.findByText('RSA-SHA256')).toBeInTheDocument();
  });

  it('shows the auto-publish toggle (enable/disable is in ModulesTab)', async () => {
    vi.mocked(apiService.getFederationSettings).mockResolvedValue(mockSettings);
    renderWithProviders(<FederationSettingsPage />);
    expect(await screen.findByText('Auto-publish new posts to federation')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(apiService.getFederationSettings).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<FederationSettingsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
