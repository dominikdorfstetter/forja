import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getPage, getPageLocalizations } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { PageResponse, ContentLocalizationResponse, SiteLocaleResponse } from '@/types/api';

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

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ id: 'page-1' }),
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

const mockPage: PageResponse = {
  id: 'page-1',
  content_id: 'content-1',
  route: '/about',
  page_type: 'Static' as const,
  template: '',
  is_in_navigation: false,
  slug: 'about',
  status: 'Draft' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockLocalization: ContentLocalizationResponse = {
  id: 'loc-1',
  content_id: 'content-1',
  locale_id: 'locale-1',
  title: 'About Us',
  subtitle: undefined,
  excerpt: undefined,
  body: undefined,
  meta_title: '',
  meta_description: '',
  translation_status: 'Approved' as const,
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

import PageDetailPage from '@/pages/page-detail/PageDetailPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue({ editorial_workflow_enabled: false } as never);
});

describe('PageDetailPage', () => {
  it('renders loading state while data is fetching', () => {
    vi.mocked(getPage).mockReturnValue(new Promise(() => {}));
    vi.mocked(getPageLocalizations).mockReturnValue(new Promise(() => {}));
    vi.mocked(getSiteLocales).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PageDetailPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the info tab by default after data loads', async () => {
    vi.mocked(getPage).mockResolvedValue(mockPage);
    vi.mocked(getPageLocalizations).mockResolvedValue([mockLocalization]);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
    renderWithProviders(<PageDetailPage />);
    // The page route '/about' appears in breadcrumbs and the form field;
    // wait for any occurrence to confirm data loads and editor renders.
    await waitFor(() => {
      expect(screen.getAllByText('/about').length).toBeGreaterThan(0);
    });
  });

  it('renders sections tab when clicked', async () => {
    vi.mocked(getPage).mockResolvedValue(mockPage);
    vi.mocked(getPageLocalizations).mockResolvedValue([mockLocalization]);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);

    renderWithProviders(<PageDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('/about').length).toBeGreaterThan(0);
    });

    // Sections tab is the 3rd editor tab. Use its role + accessible name.
    // Tab labels are i18n keys that may render as the key string when missing.
    const sectionsTab = screen.getByRole('tab', { name: /sections/i });
    expect(sectionsTab).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(sectionsTab);

    // Sections tab empty state uses en.json: "No sections yet"
    await waitFor(() => {
      expect(screen.getByText('No sections yet')).toBeInTheDocument();
    });
  });
});
