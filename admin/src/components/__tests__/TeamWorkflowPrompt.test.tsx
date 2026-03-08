import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { SiteContextResponse } from '@/types/api';

const DEFAULT_CONTEXT: SiteContextResponse = {
  member_count: 3,
  current_user_role: 'admin',
  features: {
    editorial_workflow: false,
    scheduling: true,
    versioning: true,
    analytics: false,
  },
  suggestions: { show_team_workflow_prompt: true },
  modules: { blog: true, pages: true, cv: false, legal: false, documents: false, ai: false },
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

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

let TeamWorkflowPrompt: typeof import('@/components/TeamWorkflowPrompt').default;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(apiService.getSiteContext).mockResolvedValue(DEFAULT_CONTEXT);
  vi.mocked(apiService.updateSiteSettings).mockResolvedValue({} as never);
  const mod = await import('@/components/TeamWorkflowPrompt');
  TeamWorkflowPrompt = mod.default;
});

describe('TeamWorkflowPrompt', () => {
  it('renders banner when show_team_workflow_prompt is true', async () => {
    renderWithProviders(<TeamWorkflowPrompt />);
    await waitFor(() => {
      expect(screen.getByText(/multiple contributors/i)).toBeInTheDocument();
    });
  });

  it('does not render when show_team_workflow_prompt is false', async () => {
    vi.mocked(apiService.getSiteContext).mockResolvedValue({
      ...DEFAULT_CONTEXT,
      suggestions: { show_team_workflow_prompt: false },
    });
    renderWithProviders(<TeamWorkflowPrompt />);
    await waitFor(() => {
      expect(screen.queryByText(/multiple contributors/i)).not.toBeInTheDocument();
    });
  });

  it('navigates to settings when "Enable in Settings" is clicked', async () => {
    renderWithProviders(<TeamWorkflowPrompt />);
    await waitFor(() => {
      expect(screen.getByText(/multiple contributors/i)).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /enable in settings/i }).click();
    expect(mockNavigate).toHaveBeenCalledWith('/settings?highlight=editorial_workflow');
  });

  it('calls updateSiteSettings when "Dismiss" is clicked', async () => {
    renderWithProviders(<TeamWorkflowPrompt />);
    await waitFor(() => {
      expect(screen.getByText(/multiple contributors/i)).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /dismiss/i }).click();
    await waitFor(() => {
      expect(vi.mocked(apiService.updateSiteSettings)).toHaveBeenCalledWith(
        'site-1',
        { team_features_prompt_dismissed: true },
      );
    });
  });
});
