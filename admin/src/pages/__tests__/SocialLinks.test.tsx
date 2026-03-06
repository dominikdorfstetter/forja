import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { SocialLink } from '@/types/api';

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

const mockLink: SocialLink = {
  id: 'sl-1',
  title: 'GitHub',
  url: 'https://github.com/example',
  icon: 'github',
  display_order: 0,
};

const mockLink2: SocialLink = {
  id: 'sl-2',
  title: 'Twitter',
  url: 'https://twitter.com/example',
  icon: 'twitter',
  display_order: 1,
};

let SocialLinksPage: typeof import('@/pages/SocialLinks').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  const mod = await import('@/pages/SocialLinks');
  SocialLinksPage = mod.default;
});

describe('SocialLinksPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getSocialLinks).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SocialLinksPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders social links table after data loads', async () => {
    vi.mocked(apiService.getSocialLinks).mockResolvedValue([mockLink, mockLink2]);
    renderWithProviders(<SocialLinksPage />);
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
    expect(screen.getByText('Twitter')).toBeInTheDocument();
  });

  it('shows empty state when no links', async () => {
    vi.mocked(apiService.getSocialLinks).mockResolvedValue([]);
    renderWithProviders(<SocialLinksPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(apiService.getSocialLinks).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<SocialLinksPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
