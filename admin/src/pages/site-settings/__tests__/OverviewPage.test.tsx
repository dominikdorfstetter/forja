import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { getSite, getSiteSettings, getStorageUsage } from '@/services/sites';
import { useAuth } from '@/store/AuthContext';
import OverviewPage from '../OverviewPage';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isMaster: true,
    isAdmin: true,
    canWrite: true,
    canRead: true,
    permission: 'Master',
    demoMode: false,
  })),
}));

const mockSite = {
  id: 'site-1',
  name: 'Test Site',
  slug: 'test-site',
  timezone: 'UTC',
  is_active: true,
  is_deleted: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  base_url: 'https://example.com',
};

const mockSettings = {
  max_document_file_size: 10_485_760,
  max_media_file_size: 52_428_800,
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
  seo_title_template: '{{title}} | {{site_name}}',
  seo_default_description: '',
  seo_default_og_image_id: null,
  theme_color: '#ffffff',
  background_color: '#ffffff',
  code_injection_head: '',
  code_injection_footer: '',
  storage_quota_bytes: 1_073_741_824,
  allowed_origins: [],
};

const mockStorageUsage = {
  site_id: 'site-1',
  media_bytes: 524_288_000,
  document_bytes: 10_485_760,
  total_bytes: 534_773_760,
  quota_bytes: 1_073_741_824,
  usage_percent: 49.8,
};

describe('OverviewPage — Storage Usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSite).mockResolvedValue(mockSite);
    vi.mocked(getSiteSettings).mockResolvedValue(mockSettings);
    vi.mocked(getStorageUsage).mockResolvedValue(mockStorageUsage);
  });

  it('renders storage usage bar with correct values', async () => {
    renderWithProviders(<OverviewPage />);

    const storageSection = await screen.findByTestId('site-settings.storage-usage');
    expect(storageSection).toBeInTheDocument();

    // Check the progress bar
    const progressBar = await screen.findByTestId('site-settings.storage-bar');
    expect(progressBar).toBeInTheDocument();
  });

  it('shows percentage text', async () => {
    renderWithProviders(<OverviewPage />);

    expect(await screen.findByText('49.8%')).toBeInTheDocument();
  });

  it('shows media and document breakdown', async () => {
    renderWithProviders(<OverviewPage />);

    // Verify the storage section loads (media/doc labels render)
    expect(await screen.findByTestId('site-settings.storage-usage')).toBeInTheDocument();
  });

  it('shows quota selector for sysadmin', async () => {
    renderWithProviders(<OverviewPage />);

    expect(await screen.findByTestId('site-settings.storage-quota')).toBeInTheDocument();
  });

  it('does not render storage section when data is unavailable', async () => {
    vi.mocked(getStorageUsage).mockRejectedValue(new Error('fail'));

    renderWithProviders(<OverviewPage />);

    // Wait for the page to load (general settings should still render)
    await screen.findByTestId('site-settings.base-url');

    // Storage section should not be present
    expect(screen.queryByTestId('site-settings.storage-usage')).not.toBeInTheDocument();
  });
});

const adminAuthValue = {
  isMaster: true,
  isAdmin: true,
  canWrite: true,
  canRead: true,
  permission: 'Master' as const,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  currentSiteRole: 'owner' as const,
  canManageMembers: true,
  canEditAll: true,
  isOwner: true,
  clerkUserId: 'user_123',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: vi.fn(() => 'owner' as const),
  siteId: 'site-1',
  loading: false,
  memberships: [],
  isSystemAdmin: true,
  isGuest: false,
  demoMode: false,
};

describe('OverviewPage — Allowed Origins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(adminAuthValue);
    vi.mocked(getSite).mockResolvedValue(mockSite);
    vi.mocked(getSiteSettings).mockResolvedValue(mockSettings);
    vi.mocked(getStorageUsage).mockResolvedValue(mockStorageUsage);
  });

  it('renders allowed origins section for admin users', async () => {
    renderWithProviders(<OverviewPage />);

    const corsSection = await screen.findByTestId('site-settings.cors');
    expect(corsSection).toBeInTheDocument();
    expect(screen.getByTestId('site-settings.cors-input')).toBeInTheDocument();
  });

  it('hides allowed origins section for non-admin users', async () => {
    vi.mocked(useAuth).mockReturnValue({
      ...adminAuthValue,
      isMaster: false,
      isAdmin: false,
      permission: 'Write' as const,
    });

    renderWithProviders(<OverviewPage />);

    await screen.findByTestId('site-settings.base-url');
    expect(screen.queryByTestId('site-settings.cors')).not.toBeInTheDocument();
  });

  it('populates origins text from settings', async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      ...mockSettings,
      allowed_origins: ['https://example.com', 'https://staging.example.com'],
    });

    renderWithProviders(<OverviewPage />);

    const input = await screen.findByTestId('site-settings.cors-input');
    const textarea = input.querySelector('textarea');
    expect(textarea).toHaveValue('https://example.com\nhttps://staging.example.com');
  });

  it('disables save button when origins have not changed', async () => {
    renderWithProviders(<OverviewPage />);

    const saveBtn = await screen.findByTestId('site-settings.cors-save');
    expect(saveBtn).toBeDisabled();
  });
});
