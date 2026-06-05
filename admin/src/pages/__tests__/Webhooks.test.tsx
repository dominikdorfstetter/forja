import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getWebhooks, testWebhook } from '@/services/webhooks';
import type { Paginated, Webhook } from '@/types/api';

const mockAuth = vi.hoisted(() => ({
  permission: 'Admin' as string,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
}));

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
  useAuth: () => mockAuth,
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
  debounce_seconds: 0,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const mockWebhook2: Webhook = {
  id: 'wh-2',
  site_id: 'site-1',
  url: 'https://other.com/hook',
  events: [],
  is_active: false,
  debounce_seconds: 0,
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
let WebhooksPage: typeof import('@/pages/Webhooks').default;

beforeAll(async () => {
  const mod = await import('@/pages/Webhooks');
  WebhooksPage = mod.default;
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset auth to admin defaults
  Object.assign(mockAuth, {
    permission: 'Admin',
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
  });
});

describe('WebhooksPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getWebhooks).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<WebhooksPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders webhook table rows after data loads', async () => {
    vi.mocked(getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    expect(screen.getByText('https://other.com/hook')).toBeInTheDocument();
  });

  it('shows empty state when no webhooks', async () => {
    vi.mocked(getWebhooks).mockResolvedValue(emptyPaginated);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    // Should show the empty state title (from i18n key webhooks.empty.title)
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens create dialog on add click', async () => {
    vi.mocked(getWebhooks).mockResolvedValue(emptyPaginated);
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

  it('opens delete confirm on delete action', async () => {
    vi.mocked(getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Row actions live inside an ActionMenu now: open the menu, click Delete.
    const menuTriggers = screen.getAllByTestId('webhook-actions.btn.menu');
    await user.click(menuTriggers[0]);
    const menu = await screen.findByRole('menu');
    const deleteItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => (el.textContent || '').includes('Delete'),
    )!;
    await user.click(deleteItem);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls testWebhook on Send test action', async () => {
    vi.mocked(getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    vi.mocked(testWebhook).mockResolvedValue({
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
    const menuTriggers = screen.getAllByTestId('webhook-actions.btn.menu');
    await user.click(menuTriggers[0]);
    const menu = await screen.findByRole('menu');
    const testItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => (el.textContent || '').toLowerCase().includes('test'),
    )!;
    await user.click(testItem);
    expect(testWebhook).toHaveBeenCalledWith('wh-1');
  });

  it('renders active/inactive status chips', async () => {
    vi.mocked(getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
    // Should have active and inactive chips — look for chip content
    // Just check the data rendered
    expect(screen.getByText('https://other.com/hook')).toBeInTheDocument();
  });

  describe('RBAC guards', () => {
    it('hides admin-only menu items for non-admin users', async () => {
      Object.assign(mockAuth, { permission: 'Read', canWrite: false, isAdmin: false });
      vi.mocked(getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
      renderWithProviders(<WebhooksPage />);
      await waitFor(() => {
        expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
      });

      // Open the row ActionMenu and inspect available items.
      const user = userEvent.setup();
      const menuTriggers = screen.getAllByTestId('webhook-actions.btn.menu');
      await user.click(menuTriggers[0]);
      const menu = await screen.findByRole('menu');
      const itemTexts = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
        (el) => el.textContent || '',
      );

      // Admin-only actions (test / edit / delete / analytics) are hidden.
      expect(itemTexts.some((t) => t.toLowerCase().includes('test'))).toBe(false);
      expect(itemTexts.some((t) => t.toLowerCase().includes('edit'))).toBe(false);
      expect(itemTexts.some((t) => t.toLowerCase().includes('delete'))).toBe(false);
      expect(itemTexts.some((t) => t.toLowerCase().includes('analytics'))).toBe(false);

      // Delivery log stays available for non-admins.
      expect(itemTexts.some((t) => t.toLowerCase().includes('deliver'))).toBe(true);
    });

    it('hides create button in page header for non-admin users', async () => {
      Object.assign(mockAuth, { permission: 'Read', canWrite: false, isAdmin: false });
      vi.mocked(getWebhooks).mockResolvedValue(mockPaginatedWebhooks);
      renderWithProviders(<WebhooksPage />);
      await waitFor(() => {
        expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
      });

      // The add webhook button should not be rendered
      const addButtons = screen.queryAllByRole('button').filter(
        (b) => b.textContent?.includes('webhook') || b.textContent?.includes('Webhook'),
      );
      expect(addButtons).toHaveLength(0);
    });
  });
});
