import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { AnalyticsReportResponse, SiteContextResponse } from '@/types/api';
import AnalyticsWidget from '../AnalyticsWidget';

const baseContext: SiteContextResponse = {
  member_count: 1,
  current_user_role: 'admin',
  features: {
    editorial_workflow: false,
    scheduling: true,
    versioning: true,
    analytics: false,
  },
  suggestions: { show_team_workflow_prompt: false },
  modules: { blog: true, pages: true, cv: false, legal: false, documents: false, ai: false, federation: false },
};

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' }],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
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
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

let mockAnalyticsEnabled = false;

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    context: {
      ...baseContext,
      features: { ...baseContext.features, analytics: mockAnalyticsEnabled },
    },
    modules: baseContext.modules,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAnalyticsEnabled = false;
});

describe('AnalyticsWidget', () => {
  it('renders nothing when analytics is disabled', () => {
    mockAnalyticsEnabled = false;

    const { container } = renderWithProviders(<AnalyticsWidget />);

    expect(container.firstChild).toBeNull();
  });

  it('shows loading skeleton while data loads', () => {
    mockAnalyticsEnabled = true;
    vi.mocked(apiService.getAnalyticsReport).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AnalyticsWidget />);

    expect(screen.getByText('Page Views')).toBeInTheDocument();
  });

  it('displays analytics data when loaded', async () => {
    mockAnalyticsEnabled = true;
    const mockReport: AnalyticsReportResponse = {
      total_views: 1234,
      total_unique_visitors: 567,
      top_content: [
        { path: '/blog/hello-world', total_views: 400, unique_visitors: 200 },
        { path: '/about', total_views: 300, unique_visitors: 150 },
      ],
      trend: [],
    };
    vi.mocked(apiService.getAnalyticsReport).mockResolvedValue(mockReport);

    renderWithProviders(<AnalyticsWidget />);

    await waitFor(() => {
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });
    expect(screen.getByText('567')).toBeInTheDocument();
    expect(screen.getByText('/blog/hello-world')).toBeInTheDocument();
    expect(screen.getByText('/about')).toBeInTheDocument();
  });
});
