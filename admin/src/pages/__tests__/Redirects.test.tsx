import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, Redirect } from '@/types/api';

const mockAuth = vi.hoisted(() => ({
  permission: 'Admin' as string,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
}));

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
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockRedirect: Redirect = {
  id: 'r-1',
  site_id: 'site-1',
  source_path: '/old-page',
  destination_path: '/new-page',
  status_code: 301,
  is_active: true,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const mockRedirect2: Redirect = {
  id: 'r-2',
  site_id: 'site-1',
  source_path: '/temp',
  destination_path: '/final',
  status_code: 302,
  is_active: false,
  created_at: '2025-07-01T00:00:00Z',
  updated_at: '2025-07-01T00:00:00Z',
};

const mockPaginated: Paginated<Redirect> = {
  data: [mockRedirect, mockRedirect2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyPaginated: Paginated<Redirect> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let RedirectsPage: typeof import('@/pages/Redirects').default;

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(mockAuth, {
    permission: 'Admin',
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
  });
  const mod = await import('@/pages/Redirects');
  RedirectsPage = mod.default;
});

describe('RedirectsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getRedirects).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<RedirectsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders redirect table after data loads', async () => {
    vi.mocked(apiService.getRedirects).mockResolvedValue(mockPaginated);
    renderWithProviders(<RedirectsPage />);
    await waitFor(() => {
      expect(screen.getByText('/old-page')).toBeInTheDocument();
    });
    expect(screen.getByText('/new-page')).toBeInTheDocument();
    expect(screen.getByText('/temp')).toBeInTheDocument();
  });

  it('shows empty state when no redirects', async () => {
    vi.mocked(apiService.getRedirects).mockResolvedValue(emptyPaginated);
    renderWithProviders(<RedirectsPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  describe('RBAC guards', () => {
    it('hides edit and delete buttons for non-write users', async () => {
      Object.assign(mockAuth, { permission: 'Read', canWrite: false, isAdmin: false });
      vi.mocked(apiService.getRedirects).mockResolvedValue(mockPaginated);
      renderWithProviders(<RedirectsPage />);
      await waitFor(() => {
        expect(screen.getByText('/old-page')).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByRole('button').filter(
        (b) => b.querySelector('[data-testid="EditIcon"]'),
      );
      const deleteButtons = screen.queryAllByRole('button').filter(
        (b) => b.querySelector('[data-testid="DeleteIcon"]'),
      );

      expect(editButtons).toHaveLength(0);
      expect(deleteButtons).toHaveLength(0);
    });

    it('hides create button in page header for non-write users', async () => {
      Object.assign(mockAuth, { permission: 'Read', canWrite: false, isAdmin: false });
      vi.mocked(apiService.getRedirects).mockResolvedValue(mockPaginated);
      renderWithProviders(<RedirectsPage />);
      await waitFor(() => {
        expect(screen.getByText('/old-page')).toBeInTheDocument();
      });

      const addButtons = screen.queryAllByRole('button').filter(
        (b) => b.textContent?.includes('redirect') || b.textContent?.includes('Redirect'),
      );
      expect(addButtons).toHaveLength(0);
    });
  });
});
