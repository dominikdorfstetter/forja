import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { fireEvent } from '@testing-library/react';
import { getBlogDetail, updateBlog, updateBlogLocalization } from '@/services/blogs';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { BlogDetailResponse, SiteLocaleResponse } from '@/types/api';

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
    useParams: () => ({ id: 'blog-1' }),
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

const mockDetail: BlogDetailResponse = {
  id: 'blog-1',
  content_id: 'content-1',
  slug: 'hello-world',
  author: 'Author',
  status: 'Draft',
  is_featured: false,
  allow_comments: true,
  reading_time_minutes: 5,
  publish_start: null,
  publish_end: null,
  published_date: null,
  published_at: null,
  cover_image_id: null,
  header_image_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  categories: [],
  documents: [],
  localizations: [{
    id: 'loc-1',
    content_id: 'content-1',
    locale_id: 'locale-1',
    title: 'Hello, World',
    subtitle: undefined,
    excerpt: undefined,
    body: '# Body',
    meta_title: '',
    meta_description: '',
    translation_status: 'Approved',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }],
} as never;

const mockLocale: SiteLocaleResponse = {
  site_id: 'site-1',
  locale_id: 'locale-1',
  is_default: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  code: 'en',
  name: 'English',
  native_name: 'English',
  direction: 'Ltr',
};

import BlogDetailPage from '@/pages/blog-detail/BlogDetailPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue({ editorial_workflow_enabled: false } as never);
});

describe('BlogDetailPage', () => {
  it('renders loading state while data is fetching', () => {
    vi.mocked(getBlogDetail).mockReturnValue(new Promise(() => {}));
    vi.mocked(getSiteLocales).mockReturnValue(new Promise(() => {}) as never);
    renderWithProviders(<BlogDetailPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the page after data loads', async () => {
    vi.mocked(getBlogDetail).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
    renderWithProviders(<BlogDetailPage />);
    // The toolbar Undo button is a stable signal that the editor view rendered
    // past loading. Title text lives in the page header / breadcrumbs in many
    // separate DOM nodes; this assertion is the most stable for a smoke test.
    await waitFor(() => {
      expect(screen.getAllByLabelText('Undo (Ctrl+Z)').length).toBeGreaterThan(0);
    });
  });

  it('save triggers update mutations with correct payload', async () => {
    vi.mocked(getBlogDetail).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);
    vi.mocked(updateBlog).mockResolvedValue({} as never);
    vi.mocked(updateBlogLocalization).mockResolvedValue({} as never);

    renderWithProviders(<BlogDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Undo (Ctrl+Z)').length).toBeGreaterThan(0);
    });

    // Dirty the form by changing the title field
    const titleField = screen.getByTestId('field-title');
    const input = titleField.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'Edited Title' } });
    fireEvent.blur(input);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('save-post'));

    await waitFor(() => {
      expect(updateBlog).toHaveBeenCalledWith(
        'blog-1',
        expect.objectContaining({ reading_time_minutes: 1 }),
      );
    });
    expect(updateBlogLocalization).toHaveBeenCalledWith(
      'loc-1',
      expect.objectContaining({ title: 'Edited Title' }),
    );
  });
});
