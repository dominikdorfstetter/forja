import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { getLocales } from '@/services/locales';
import { createSite, updateSiteSettings } from '@/services/sites';
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
    isGuest: false,
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
  vi.mocked(getLocales).mockResolvedValue([]);
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

  it('slug is read-only and auto-derives from name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    const nameInput = screen.getByTestId('site-wizard.input.name').querySelector('input')!;
    const slugInput = screen.getByTestId('site-wizard.input.slug').querySelector('input')! as HTMLInputElement;

    await user.type(nameInput, 'My New Site');

    await waitFor(() => expect(slugInput.value).toBe('my-new-site'));
    expect(slugInput).toHaveAttribute('readonly');
  });

  it('advances to modules step after filling basics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
    await user.click(screen.getByTestId('site-wizard.btn.next'));

    await waitFor(() => {
      expect(screen.getByTestId('site-wizard.module.blog')).toBeInTheDocument();
    });
  });

  it('navigates back from modules to basics', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
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

    // Slug is read-only and derived from name; leaving name empty must block
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
    vi.mocked(createSite).mockResolvedValue(mockSite);
    vi.mocked(updateSiteSettings).mockResolvedValue({} as never);

    renderWithProviders(<SiteCreationWizard open onClose={mockOnClose} />);

    // Step 0: Basics
    await user.type(screen.getByTestId('site-wizard.input.name').querySelector('input')!, 'My Site');
    // Slug auto-fills — rely on auto-fill for final submit test
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
      expect(createSite).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Site', slug: 'my-site' }),
      );
    });

    await waitFor(() => {
      expect(updateSiteSettings).toHaveBeenCalledWith('new-site-1', expect.objectContaining({
        module_blog_enabled: true,
        module_pages_enabled: true,
        module_portfolio_enabled: false,
        editorial_workflow_enabled: false,
      }));
    });
  });
});
