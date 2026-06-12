import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { SnackbarProvider } from 'notistack';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import type { Paginated, BulkContentResponse } from '@/types/api';
import EntityListPage from '../EntityListPage';
import type { EntityListAdapter } from '../types';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    context: { features: { editorial_workflow: false } },
  }),
}));

interface FakeItem {
  id: string;
  name: string;
  status: 'Draft' | 'Published' | 'Archived';
}

const items: FakeItem[] = [
  { id: 'item-1', name: 'first-item', status: 'Published' },
  { id: 'item-2', name: 'second-item', status: 'Draft' },
];

const paginated: Paginated<FakeItem> = {
  data: items,
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const empty: Paginated<FakeItem> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

function buildAdapter(overrides: Partial<EntityListAdapter<FakeItem>> = {}): EntityListAdapter<FakeItem> {
  return {
    entityKey: 'fake',
    pageHeaderIcon: 'folder',
    i18nNamespace: 'blogs',
    fetchList: vi.fn(async () => paginated),
    listQueryKey: (siteId, params) => ['fake-list', siteId, params.page, params.page_size, params.search ?? '', params.status ?? '', params.exclude_status ?? '', params.sort_by ?? '', params.sort_dir ?? ''],
    bulkExtraInvalidations: () => [],
    getItemId: (item) => item.id,
    updateEntity: vi.fn(async () => ({})),
    deleteEntity: vi.fn(async () => ({})),
    bulkAction: vi.fn(async () => ({ succeeded: 0, failed: 0, total: 0 } as BulkContentResponse)),
    defaultSort: { sortBy: 'name', sortDir: 'asc' },
    buildColumns: () => [
      { key: 'name', label: 'Name', width: '1fr', render: (item) => item.name },
      { key: 'status', label: 'Status', width: '120px', render: (item) => item.status },
    ],
    buildChipFilters: () => [
      { value: 'all', label: 'All' },
      { value: 'Draft', label: 'Draft' },
      { value: 'Published', label: 'Published' },
    ],
    pageTestId: 'fake.page',
    tableTestId: 'fake.table',
    searchTestId: 'fake.search',
    emptyIcon: <span data-testid="empty-icon" />,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntityListPage tracer bullet', () => {
  it('renders item rows after fetchList resolves', async () => {
    const adapter = buildAdapter();
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={({ item }) => <span data-testid={`row-${item.id}`}>actions</span>}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('first-item')).toBeInTheDocument();
    });
    expect(screen.getByText('second-item')).toBeInTheDocument();
    expect(adapter.fetchList).toHaveBeenCalled();
  });

  it('shows loading state while fetching', () => {
    const adapter = buildAdapter({
      fetchList: vi.fn(() => new Promise(() => {})) as never,
    });
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no items', async () => {
    const adapter = buildAdapter({
      fetchList: vi.fn(async () => empty) as never,
    });
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('passes search input through to fetchList after debounce', async () => {
    const fetchList = vi.fn(async () => paginated);
    const adapter = buildAdapter({ fetchList: fetchList as never });
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('first-item')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const searchInputs = screen.getAllByRole('searchbox');
    expect(searchInputs.length).toBeGreaterThan(0);
    await user.type(searchInputs[0], 'foo');

    // After debounce, fetchList should be called with the search param.
    await waitFor(
      () => {
        const calls = fetchList.mock.calls as unknown as Array<[string, { search?: string }]>;
        const matched = calls.some((args) => args[1]?.search === 'foo');
        expect(matched).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it('shows error alert when fetchList fails', async () => {
    const adapter = buildAdapter({
      fetchList: vi.fn(async () => { throw new Error('boom'); }) as never,
    });
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('EntityListPage harness widening', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('chrome="embedded" hides the harness PageHeader (parent owns page chrome)', async () => {
    const adapter = buildAdapter({ chrome: 'embedded' });
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('first-item')).toBeInTheDocument();
    });
    // PageHeader renders an <h1>; embedded mode must not produce one.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('chrome="standalone" (default) renders the harness PageHeader', async () => {
    const adapter = buildAdapter();
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('first-item')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('routePath override drives row-click navigation target', async () => {
    const adapter = buildAdapter({
      routePath: (item) => `/legal/${item.id}`,
    });
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('first-item')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByText('first-item'));
    expect(mockNavigate).toHaveBeenCalledWith('/legal/item-1');
  });

  it('queryKeyRoot override is applied to mutation invalidations', async () => {
    const adapter = buildAdapter({
      entityKey: 'fake',
      queryKeyRoot: 'legal',
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    // Custom render exposing our spied QueryClient (skips the default test-utils provider).
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SnackbarProvider>
            <EntityListPage
              adapter={adapter}
              renderRowActions={({ item, rowActions }) => (
                <button
                  type="button"
                  data-testid={`fire-publish-${item.id}`}
                  onClick={() => rowActions.openPublish(item)}
                >
                  publish
                </button>
              )}
              renderDialogs={({ rowState, onRowConfirmStatus, rowActions }) =>
                rowState.publishingItem ? (
                  <button
                    type="button"
                    data-testid="confirm-publish"
                    onClick={() => {
                      onRowConfirmStatus(rowState.publishingItem!, 'Published');
                      rowActions.closePublish();
                    }}
                  >
                    confirm
                  </button>
                ) : null
              }
            />
          </SnackbarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('fire-publish-item-1')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('fire-publish-item-1'));
    await user.click(await screen.findByTestId('confirm-publish'));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['legal', 'site-1'] });
    });
  });

  it('default queryKeyRoot falls back to ${entityKey}s when not overridden', async () => {
    const adapter = buildAdapter({ entityKey: 'fake' });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SnackbarProvider>
            <EntityListPage
              adapter={adapter}
              renderRowActions={({ item, rowActions }) => (
                <button
                  type="button"
                  data-testid={`fire-publish-${item.id}`}
                  onClick={() => rowActions.openPublish(item)}
                >
                  publish
                </button>
              )}
              renderDialogs={({ rowState, onRowConfirmStatus, rowActions }) =>
                rowState.publishingItem ? (
                  <button
                    type="button"
                    data-testid="confirm-publish"
                    onClick={() => {
                      onRowConfirmStatus(rowState.publishingItem!, 'Published');
                      rowActions.closePublish();
                    }}
                  >
                    confirm
                  </button>
                ) : null
              }
            />
          </SnackbarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('fire-publish-item-1')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('fire-publish-item-1'));
    await user.click(await screen.findByTestId('confirm-publish'));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fakes', 'site-1'] });
    });
  });

  it('default routePath falls back to /${entityKey}s/${id} when not overridden', async () => {
    const adapter = buildAdapter();
    renderWithProviders(
      <EntityListPage
        adapter={adapter}
        renderRowActions={() => null}
        renderDialogs={() => null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('first-item')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByText('first-item'));
    expect(mockNavigate).toHaveBeenCalledWith('/fakes/item-1');
  });
});
