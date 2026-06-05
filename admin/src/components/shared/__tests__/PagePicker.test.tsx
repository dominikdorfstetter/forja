import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { getPage, getPages } from '@/services/pages';
import type { PageListItem, Paginated } from '@/types/api';
import PagePicker from '../PagePicker';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [],
    isLoading: false,
  }),
}));

const mockPages: PageListItem[] = [
  { id: 'page-1', route: '/about', page_type: 'Static', slug: 'about', is_in_navigation: true, status: 'Published', created_at: '2025-01-01T00:00:00Z' },
  { id: 'page-2', route: '/contact', page_type: 'Contact', slug: 'contact', is_in_navigation: false, status: 'Published', created_at: '2025-01-01T00:00:00Z' },
  { id: 'page-3', route: '/blog', page_type: 'BlogIndex', slug: 'blog', is_in_navigation: true, status: 'Draft', created_at: '2025-01-01T00:00:00Z' },
];

const paginatedResponse: Paginated<PageListItem> = {
  data: mockPages,
  meta: { page: 1, page_size: 20, total_items: 3, total_pages: 1 },
};

const emptyResponse: Paginated<PageListItem> = {
  data: [],
  meta: { page: 1, page_size: 20, total_items: 0, total_pages: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PagePicker', () => {
  it('renders with label and placeholder', async () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    const onChange = vi.fn();
    renderWithProviders(<PagePicker value="" onChange={onChange} />);
    expect(screen.getByTestId('page-picker')).toBeInTheDocument();
    expect(screen.getByLabelText(/select a page/i)).toBeInTheDocument();
  });

  it('shows page options when opened', async () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PagePicker value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('/about')).toBeInTheDocument();
      expect(screen.getByText('/contact')).toBeInTheDocument();
    });
  });

  it('calls onChange when a page is selected', async () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PagePicker value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('/about')).toBeInTheDocument();
    });

    await user.click(screen.getByText('/about'));
    expect(onChange).toHaveBeenCalledWith('page-1');
  });

  it('shows empty state when no pages match', async () => {
    vi.mocked(getPages).mockResolvedValue(emptyResponse);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PagePicker value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'zzzzz');

    await waitFor(() => {
      expect(screen.getByText(/no pages found/i)).toBeInTheDocument();
    });
  });

  it('pre-populates when value is provided and page exists in results', async () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    const onChange = vi.fn();
    renderWithProviders(<PagePicker value="page-1" onChange={onChange} />);

    await waitFor(() => {
      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('/about');
    });
  });

  it('fetches single page when value is not in results', async () => {
    vi.mocked(getPages).mockResolvedValue(emptyResponse);
    vi.mocked(getPage).mockResolvedValue({
      id: 'page-99',
      content_id: 'c-99',
      route: '/hidden',
      page_type: 'Static',
      slug: 'hidden',
      is_in_navigation: false,
      status: 'Published',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });
    const onChange = vi.fn();
    renderWithProviders(<PagePicker value="page-99" onChange={onChange} />);

    await waitFor(() => {
      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('/hidden');
    });
  });

  it('shows page type and slug in options', async () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PagePicker value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    await waitFor(() => {
      // Route shown as primary text
      expect(screen.getByText('/about')).toBeInTheDocument();
      // Page type chip rendered
      expect(screen.getAllByTestId('page-type-chip').length).toBeGreaterThan(0);
    });
  });

  it('accepts custom label', () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    renderWithProviders(<PagePicker value="" onChange={vi.fn()} label="Target Page" />);
    expect(screen.getByLabelText('Target Page')).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.mocked(getPages).mockResolvedValue(paginatedResponse);
    renderWithProviders(
      <PagePicker value="" onChange={vi.fn()} error helperText="Page is required" />,
    );
    expect(screen.getByText('Page is required')).toBeInTheDocument();
  });
});
