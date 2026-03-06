import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import apiService from '@/services/api';
import SiteCreationWizard from '../SiteCreationWizard';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site' }],
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
    refreshAuth: vi.fn().mockResolvedValue(undefined),
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

const mockOnClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiService.getLocales).mockResolvedValue([]);
});

describe('SiteCreationWizard', () => {
  it('renders stepper with 4 steps when open', () => {
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    expect(screen.getByTestId('site-creation-wizard')).toBeInTheDocument();
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('Languages')).toBeInTheDocument();
  });

  it('shows basics form on step 0', () => {
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    expect(screen.getByTestId('site-wizard.input.name')).toBeInTheDocument();
    expect(screen.getByTestId('site-wizard.input.slug')).toBeInTheDocument();
  });

  it('advances to modules step after filling basics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
    await user.type(screen.getByTestId('site-wizard.input.slug').querySelector('input')!, 'my-site');

    await user.click(screen.getByTestId('site-wizard.btn.next'));

    // Should now see module toggles
    await waitFor(() => {
      expect(screen.getByTestId('site-wizard.module.blog')).toBeInTheDocument();
    });
  });

  it('navigates back from modules to basics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    // Fill basics and go to step 1
    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
    await user.type(screen.getByTestId('site-wizard.input.slug').querySelector('input')!, 'my-site');
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    await waitFor(() => {
      expect(screen.getByTestId('site-wizard.module.blog')).toBeInTheDocument();
    });

    // Go back
    await user.click(screen.getByTestId('site-wizard.btn.back'));

    await waitFor(() => {
      expect(screen.getByTestId('site-wizard.input.name')).toBeInTheDocument();
    });
  });

  it('shows workflow step with solo/team cards', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    // Step 0 → Step 1 → Step 2
    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
    await user.type(screen.getByTestId('site-wizard.input.slug').querySelector('input')!, 'my-site');
    await user.click(screen.getByTestId('site-wizard.btn.next'));
    await waitFor(() => expect(screen.getByTestId('site-wizard.module.blog')).toBeInTheDocument());
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    // Should see workflow options
    await waitFor(() => {
      expect(screen.getByTestId('site-wizard.workflow.solo')).toBeInTheDocument();
      expect(screen.getByTestId('site-wizard.workflow.team')).toBeInTheDocument();
    });
  });

  it('does not advance past step 0 if name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    // Only fill slug, leave name empty
    await user.type(screen.getByTestId('site-wizard.input.slug').querySelector('input')!, 'my-site');
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    // Should still be on step 0
    expect(screen.getByTestId('site-wizard.input.name')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    await user.click(screen.getByText('Cancel'));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('creates site and updates settings on final submit', async () => {
    const user = userEvent.setup();
    const mockSite = { id: 'new-site-1', name: 'My Site', slug: 'my-site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' };
    vi.mocked(apiService.createSite).mockResolvedValue(mockSite);
    vi.mocked(apiService.updateSiteSettings).mockResolvedValue({} as never);

    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    // Step 0: Basics
    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
    await user.type(screen.getByTestId('site-wizard.input.slug').querySelector('input')!, 'my-site');
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    // Step 1: Modules (keep defaults)
    await waitFor(() => expect(screen.getByTestId('site-wizard.module.blog')).toBeInTheDocument());
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    // Step 2: Workflow (keep solo default)
    await waitFor(() => expect(screen.getByTestId('site-wizard.workflow.solo')).toBeInTheDocument());
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    // Step 3: Languages (skip, click create)
    await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument());
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    await waitFor(() => {
      expect(apiService.createSite).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Site', slug: 'my-site' }),
      );
    });

    await waitFor(() => {
      expect(apiService.updateSiteSettings).toHaveBeenCalledWith('new-site-1', expect.objectContaining({
        module_blog_enabled: true,
        module_pages_enabled: true,
        module_cv_enabled: false,
        editorial_workflow_enabled: false,
      }));
    });
  });
});
