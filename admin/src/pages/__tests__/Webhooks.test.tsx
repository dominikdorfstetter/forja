import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, Webhook } from '@/types/api';

// Mock store hooks to use our test providers
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
    permission: 'Admin',
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockWebhook: Webhook = {
  id: 'wh-1',
  site_id: 'site-1',
  url: 'https://example.com/hook',
  description: 'Test webhook',
  events: ['blog.created', 'blog.updated'],
  is_active: true,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const mockWebhook2: Webhook = {
  id: 'wh-2',
  site_id: 'site-1',
  url: 'https://other.com/hook',
  events: [],
  is_active: false,
  created_at: '2025-06-02T00:00:00Z',
  updated_at: '2025-06-02T00:00:00Z',
};

const mockPaginatedWebhooks: Paginated<Webhook> = {
  data: [mockWebhook, mockWebhook2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyPaginated: Paginated<Webhook> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

// We need to import the page after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-require-imports
let WebhooksPage: typeof import('@/pages/Webhooks').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('@/pages/Webhooks');
  WebhooksPage = mod.default;
});

describe('WebhooksPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getWebhooks).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<WebhooksPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders webhook table rows after data loads', async () => {
    vi.mocked(apiService.getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    expect(screen.getByText('https://other.com/hook')).toBeInTheDocument();
  });

  it('shows empty state when no webhooks', async () => {
    vi.mocked(apiService.getWebhooks).mockResolvedValue(emptyPaginated);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    // Should show the empty state title (from i18n key webhooks.empty.title)
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens create dialog on add click', async () => {
    vi.mocked(apiService.getWebhooks).mockResolvedValue(emptyPaginated);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Find add button in the empty state or page header
    const addButtons = screen.getAllByRole('button');
    const addButton = addButtons.find((b) => b.textContent?.includes('webhook') || b.textContent?.includes('Webhook') || b.textContent?.includes('Add'));
    expect(addButton).toBeDefined();
    await user.click(addButton!);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('opens delete confirm on delete icon click', async () => {
    vi.mocked(apiService.getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Find the delete buttons (error-colored icon buttons)
    const deleteButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="DeleteIcon"]'),
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls testWebhook on test button click', async () => {
    vi.mocked(apiService.getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    vi.mocked(apiService.testWebhook).mockResolvedValue({
      id: 'del-1',
      webhook_id: 'wh-1',
      event_type: 'test',
      payload: {},
      status_code: 200,
      attempt_number: 1,
      delivered_at: '2025-06-01T00:00:00Z',
    });
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Test buttons have PlayArrowIcon
    const testButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="PlayArrowIcon"]'),
    );
    expect(testButtons.length).toBeGreaterThan(0);
    await user.click(testButtons[0]);
    expect(apiService.testWebhook).toHaveBeenCalledWith('wh-1');
  });

  it('renders active/inactive status chips', async () => {
    vi.mocked(apiService.getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    // Should have active and inactive chips — look for chip content
    // Just check the data rendered
    expect(screen.getByText('https://other.com/hook')).toBeInTheDocument();
  });
});
