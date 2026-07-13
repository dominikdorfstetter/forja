import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { getLegalDocumentDetail, getLegalVersions, updateLegalDocument } from '@/services/legal';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { LegalDocumentFullDetailResponse, SiteLocaleResponse } from '@/types/api';

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
    permission: 'Admin' as const,
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
    memberships: [{
      site_id: 'site-1',
      role: 'admin',
      permissions: ['blog:create', 'blog:update:any', 'blog:publish', 'blog:review', 'settings:update', 'member:invite'],
    }],
    isSystemAdmin: false,
    isGuest: false,
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

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ id: 'doc-1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/store/NavigationGuardContext', () => ({
  useNavigationGuardContext: () => ({
    registerGuard: vi.fn(),
    unregisterGuard: vi.fn(),
    guardedNavigate: vi.fn(),
  }),
  NavigationGuardProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockDetail: LegalDocumentFullDetailResponse = {
  id: 'doc-1',
  content_id: 'content-1',
  cookie_name: 'privacy_policy',
  document_type: 'PrivacyPolicy' as const,
  status: 'Draft' as const,
  slug: 'privacy',
  version: 1,
  parent_version_id: null,
  publish_start: null,
  publish_end: null,
  localizations: [{
    id: 'loc-1',
    content_id: 'content-1',
    locale_id: 'locale-1',
    title: 'Privacy Policy',
    subtitle: undefined,
    excerpt: undefined,
    body: '# Privacy',
    meta_title: '',
    meta_description: '',
    translation_status: 'Approved' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }],
  doc_localizations: [{ id: 'dloc-1', locale_id: 'locale-1', title: 'Privacy Policy', intro: '' }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockLocale: SiteLocaleResponse = {
  site_id: 'site-1',
  locale_id: 'locale-1',
  is_default: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  code: 'en',
  name: 'English',
  native_name: 'English',
  direction: 'Ltr' as const,
};

let LegalDetailPage: typeof import('@/pages/legal-detail/LegalDetailPage').default;

beforeAll(async () => {
  const mod = await import('@/pages/legal-detail/LegalDetailPage');
  LegalDetailPage = mod.default;
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLegalVersions).mockResolvedValue([]);
  vi.mocked(getSiteSettings).mockResolvedValue({ editorial_workflow_enabled: false } as never);
});

describe('LegalDetailPage', () => {
  it('renders loading state while data is fetching', () => {
    vi.mocked(getLegalDocumentDetail).mockReturnValue(new Promise(() => {}));
    vi.mocked(getSiteLocales).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<LegalDetailPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders title field and editor area after data loads', async () => {
    vi.mocked(getLegalDocumentDetail).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
    renderWithProviders(<LegalDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('legal-detail.field-title')).toBeInTheDocument();
    });
    expect(screen.getByTestId('legal-detail.content')).toBeInTheDocument();
  });

  it('shows version chip in the toolbar', async () => {
    vi.mocked(getLegalDocumentDetail).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
    renderWithProviders(<LegalDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });
  });

  it('shows workflow action buttons for draft status', async () => {
    vi.mocked(getLegalDocumentDetail).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
    renderWithProviders(<LegalDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('legal-detail.toolbar')).toBeInTheDocument();
    });
    // Draft status should show either Publish or Submit for Review buttons
    const buttons = screen.getAllByRole('button');
    const hasWorkflowAction = buttons.some((b) => {
      const text = b.textContent ?? '';
      return text.includes('Publish') || text.includes('Submit') || text.includes('Review');
    });
    expect(hasWorkflowAction).toBe(true);
  });

  describe('slug field', () => {
    async function openSlugField() {
      const user = userEvent.setup();
      renderWithProviders(<LegalDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('legal-detail.field-slug')).toBeInTheDocument();
      });
      await user.click(screen.getByText('SEO Settings'));
      return { user, slugField: screen.getByTestId('legal-detail.field-slug') };
    }

    it('lets a draft slug be edited and saved', async () => {
      vi.mocked(getLegalDocumentDetail).mockResolvedValue(mockDetail);
      vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
      vi.mocked(updateLegalDocument).mockResolvedValue({} as never);

      const { user, slugField } = await openSlugField();
      expect(within(slugField).getByText('privacy')).toBeInTheDocument();

      await user.click(within(slugField).getByText('privacy'));
      const input = within(slugField).getByTestId('inline-edit.input').querySelector('input')!;
      await user.clear(input);
      await user.type(input, 'privacy-policy{Enter}');

      await waitFor(() => {
        expect(updateLegalDocument).toHaveBeenCalledWith('doc-1', { slug: 'privacy-policy' });
      });
    });

    it('disables slug editing once the document is published', async () => {
      vi.mocked(getLegalDocumentDetail).mockResolvedValue({ ...mockDetail, status: 'Published' });
      vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);

      const { slugField } = await openSlugField();
      expect(within(slugField).getByText('privacy')).toBeInTheDocument();
      expect(within(slugField).queryByTestId('inline-edit.btn.edit')).not.toBeInTheDocument();
      expect(within(slugField).getByText(/the slug is permanent/i)).toBeInTheDocument();
    });

    it('disables slug editing on forks of a published version', async () => {
      vi.mocked(getLegalDocumentDetail).mockResolvedValue({ ...mockDetail, parent_version_id: 'doc-0', version: 2 });
      vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);

      const { slugField } = await openSlugField();
      expect(within(slugField).queryByTestId('inline-edit.btn.edit')).not.toBeInTheDocument();
    });

    it('maps the LEGAL_SLUG_IMMUTABLE 409 to a friendly message', async () => {
      vi.mocked(getLegalDocumentDetail).mockResolvedValue(mockDetail);
      vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
      vi.mocked(updateLegalDocument).mockRejectedValue({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'LEGAL_SLUG_IMMUTABLE',
        detail: 'The slug of a legal document is locked once any version has been published',
      });

      const { user, slugField } = await openSlugField();
      await user.click(within(slugField).getByText('privacy'));
      const input = within(slugField).getByTestId('inline-edit.input').querySelector('input')!;
      await user.clear(input);
      await user.type(input, 'new-slug{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/the slug can no longer be changed/i)).toBeInTheDocument();
      });
    });
  });
});
