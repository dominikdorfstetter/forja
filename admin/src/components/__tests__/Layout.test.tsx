import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { getSiteContext, getSiteSettings, getTrashCount } from '@/services/sites';
import type { SiteContextResponse } from '@/types/api';

const DEFAULT_CONTEXT: SiteContextResponse = {
  member_count: 1,
  current_user_role: 'admin',
  features: { editorial_workflow: false, scheduling: true, versioning: true, analytics: false },
  suggestions: { show_team_workflow_prompt: false },
  modules: { blog: true, pages: true, portfolio: false, legal: false, documents: false, ai: false, forms: false, collections: false },
  integration: { code_injection_head: '', code_injection_footer: '', seo_title_template: '', seo_default_description: '', theme_color: '#ffffff', background_color: '#ffffff' },
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

let mockCurrentSiteRole: string | null = 'admin';

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
    refreshAuth: vi.fn(),
    currentSiteRole: mockCurrentSiteRole,
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

vi.mock('@/store/NavigationGuardContext', () => ({
  useNavigationGuardContext: () => ({
    guardedNavigate: vi.fn(),
    setPendingPath: vi.fn(),
    pendingPath: null,
    confirmNavigation: vi.fn(),
    cancelNavigation: vi.fn(),
  }),
  NavigationGuardProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/HelpStateContext', () => ({
  useHelpState: () => ({
    state: { tourCompleted: true, showHelp: false },
    tourActive: false,
    completeTour: vi.fn(),
    startTour: vi.fn(),
    isLoading: false,
  }),
  HelpStateProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/theme/ThemeContext', () => ({
  useThemeMode: () => ({
    mode: 'light',
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  }),
  ThemeModeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/command-palette', () => ({
  CommandPalette: () => null,
}));

vi.mock('@/components/help/QuickTour', () => ({
  default: () => null,
}));

vi.mock('@/components/layout/TopBar', () => ({
  default: () => <div data-testid="mock-topbar" />,
}));

vi.mock('@/components/layout/SidebarNav', () => ({
  default: () => <div data-testid="mock-sidebar-nav" />,
}));

let Layout: typeof import('@/components/Layout').default;

beforeAll(async () => {
  const mod = await import('@/components/Layout');
  Layout = mod.default;
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentSiteRole = 'admin';
  vi.mocked(getSiteContext).mockResolvedValue(DEFAULT_CONTEXT);
  vi.mocked(getTrashCount).mockResolvedValue({ count: 0 });
  vi.mocked(getSiteSettings).mockResolvedValue({
    max_document_file_size: 10485760,
    max_media_file_size: 10485760,
    analytics_enabled: false,
    maintenance_mode: false,
    contact_email: '',
    editorial_workflow_enabled: false,
    preview_templates: [],
    document_password_min_length: 8,
    document_password_regex: '',
    module_blog_enabled: true,
    module_pages_enabled: true,
    module_portfolio_enabled: false,
    module_legal_enabled: false,
    module_documents_enabled: false,
    module_ai_enabled: false,
    module_forms_enabled: false,
    module_collections_enabled: false,
    robots_txt_rules: [],
    seo_title_template: '',
    seo_default_description: '',
    seo_default_og_image_id: null,
    theme_color: '#ffffff',
    background_color: '#ffffff',
    code_injection_head: '',
    code_injection_footer: '',
    storage_quota_bytes: 0,
    allowed_origins: [],
  });
});

describe('Layout — role chip', () => {
  it('renders role chip with correct text for admin', async () => {
    renderWithProviders(<Layout />, { route: '/' });
    const chip = await screen.findByTestId('layout.role-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/admin/i);
  });

  it('does not render role chip when currentSiteRole is null', async () => {
    mockCurrentSiteRole = null;
    renderWithProviders(<Layout />, { route: '/' });
    // Wait for render to complete
    await screen.findByTestId('layout.site-name');
    expect(screen.queryByTestId('layout.role-chip')).not.toBeInTheDocument();
  });
});

describe('Layout — maintenance mode banner', () => {
  it('shows maintenance banner when maintenance_mode is true', async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      max_document_file_size: 10485760,
      max_media_file_size: 10485760,
      analytics_enabled: false,
      maintenance_mode: true,
      contact_email: '',
      editorial_workflow_enabled: false,
      preview_templates: [],
      document_password_min_length: 8,
      document_password_regex: '',
      module_blog_enabled: true,
      module_pages_enabled: true,
      module_portfolio_enabled: false,
      module_legal_enabled: false,
      module_documents_enabled: false,
      module_ai_enabled: false,
      module_forms_enabled: false,
      module_collections_enabled: false,
      robots_txt_rules: [],
      seo_title_template: '',
      seo_default_description: '',
      seo_default_og_image_id: null,
      theme_color: '#ffffff',
      background_color: '#ffffff',
      code_injection_head: '',
      code_injection_footer: '',
      storage_quota_bytes: 0,
      allowed_origins: [],
    });
    renderWithProviders(<Layout />, { route: '/' });
    const banner = await screen.findByTestId('maintenance-mode-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('maintenance-mode-turn-off')).toBeInTheDocument();
  });

  it('does not show maintenance banner when maintenance_mode is false', async () => {
    renderWithProviders(<Layout />, { route: '/' });
    await screen.findByTestId('layout.site-name');
    expect(screen.queryByTestId('maintenance-mode-banner')).not.toBeInTheDocument();
  });
});
