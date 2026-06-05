import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import { z } from 'zod';
import type { SiteLocaleResponse } from '@/types/api';
import type { ContentDetailAdapter } from '../types';

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
    useParams: () => ({ id: 'fake-1' }),
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

interface FakeDetail {
  id: string;
  status: 'Draft' | 'Published' | 'Archived' | 'InReview' | 'Scheduled';
  publish_start: string | null;
  publish_end: string | null;
  localizations: FakeLoc[];
  slug: string;
}

interface FakeLoc {
  id: string;
  locale_id: string;
  title: string;
  body: string;
}

interface FakeFormData {
  title: string;
  body: string;
  status: 'Draft' | 'Published' | 'Archived' | 'InReview' | 'Scheduled';
  publish_start: string | null;
  publish_end: string | null;
}

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

const mockDetail: FakeDetail = {
  id: 'fake-1',
  status: 'Draft',
  publish_start: null,
  publish_end: null,
  slug: 'hello-world',
  localizations: [{ id: 'loc-1', locale_id: 'locale-1', title: 'Original Title', body: 'Original body' }],
};

interface AdapterMocks {
  fetchDetail: ReturnType<typeof vi.fn>;
  updateEntity: ReturnType<typeof vi.fn>;
  createLocalization: ReturnType<typeof vi.fn>;
  updateLocalization: ReturnType<typeof vi.fn>;
}

function buildAdapter(mocks: AdapterMocks): ContentDetailAdapter<FakeDetail, FakeFormData, FakeLoc> {
  return {
    entityKey: 'fake',
    fetchDetail: (id) => (mocks.fetchDetail as (id: string) => Promise<FakeDetail>)(id),
    detailQueryKey: (id) => ['fake-detail', id],
    getLocalizations: (d) => d?.localizations ?? [],
    getLocalizationLocaleId: (l) => l.locale_id,
    schema: z.object({
      title: z.string(),
      body: z.string(),
      status: z.enum(['Draft', 'Published', 'Archived', 'InReview', 'Scheduled']),
      publish_start: z.string().nullable(),
      publish_end: z.string().nullable(),
    }) as never,
    buildFormDefaults: (detail, loc) => ({
      title: loc?.title ?? '',
      body: loc?.body ?? '',
      status: detail?.status ?? 'Draft',
      publish_start: detail?.publish_start ?? null,
      publish_end: detail?.publish_end ?? null,
    }),
    buildEntityUpdates: (values, detail) => {
      const u: Record<string, unknown> = {};
      if (values.status !== detail.status) u.status = values.status;
      return u;
    },
    buildLocalizationData: (values) => ({ body: values.body || undefined }),
    getLocTitleField: (values) => values.title || undefined,
    updateEntity: (id, data) => (mocks.updateEntity as (id: string, data: unknown) => Promise<unknown>)(id, data),
    createLocalization: (entityId, localeId, data) =>
      (mocks.createLocalization as (e: string, l: string, d: unknown) => Promise<unknown>)(entityId, localeId, data),
    updateLocalization: (locId, data) =>
      (mocks.updateLocalization as (l: string, d: unknown) => Promise<unknown>)(locId, data),
    i18nNamespace: 'blogDetail',
    getIcon: () => 'article',
    getTitle: (d) => d.slug,
    getBreadcrumbs: () => [{ label: 'Fakes' }],
    getPreviewPath: (d) => `/fakes/${d.slug}`,
    multiLocaleTabs: true,
    pageTestId: 'fake-detail.page',
  };
}

let ContentDetailPage: typeof import('../ContentDetailPage').default;

beforeAll(async () => {
  const mod = await import('../ContentDetailPage');
  ContentDetailPage = mod.default;
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue({ editorial_workflow_enabled: false } as never);
});

describe('ContentDetailPage tracer bullet', () => {
  it('renders the detail title in the header after data loads', async () => {
    const mocks: AdapterMocks = {
      fetchDetail: vi.fn().mockResolvedValue(mockDetail),
      updateEntity: vi.fn(),
      createLocalization: vi.fn(),
      updateLocalization: vi.fn().mockResolvedValue({}),
    };
    const adapter = buildAdapter(mocks);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);

    renderWithProviders(
      <ContentDetailPage
        adapter={adapter}
        renderToolbar={() => <div data-testid="toolbar-slot" />}
        renderEditor={({ detail }) => <div data-testid="editor-slot">{detail.slug}</div>}
        renderStandardDialogs={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-slot')).toBeInTheDocument();
    });
    expect(screen.getByTestId('editor-slot')).toHaveTextContent('hello-world');
  });

  it('save handler invokes adapter.updateLocalization with edited body', async () => {
    const mocks: AdapterMocks = {
      fetchDetail: vi.fn().mockResolvedValue(mockDetail),
      updateEntity: vi.fn().mockResolvedValue({}),
      createLocalization: vi.fn(),
      updateLocalization: vi.fn().mockResolvedValue({}),
    };
    const adapter = buildAdapter(mocks);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);

    renderWithProviders(
      <ContentDetailPage
        adapter={adapter}
        renderToolbar={({ setValue, onSave }) => (
          <div>
            <button
              type="button"
              data-testid="set-body"
              onClick={() => setValue('body', 'Edited body', { shouldDirty: true })}
            >
              Edit
            </button>
            <button type="button" data-testid="save-btn" onClick={onSave}>
              Save
            </button>
          </div>
        )}
        renderEditor={() => <div data-testid="editor-slot" />}
        renderStandardDialogs={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('set-body'));
    await user.click(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(mocks.updateLocalization).toHaveBeenCalledWith(
        'loc-1',
        expect.objectContaining({ body: 'Edited body' }),
      );
    });
  });

  // #783: a rejected entity-status update must not abort the localization
  // save — otherwise typed translation content is lost and the user is
  // deadlocked (can't add the locales the publish gate demands).
  it('still saves the localization when the entity update rejects', async () => {
    const mocks: AdapterMocks = {
      fetchDetail: vi.fn().mockResolvedValue(mockDetail),
      updateEntity: vi.fn().mockRejectedValue(new Error('The default locale (de) must have a title before publishing')),
      createLocalization: vi.fn(),
      updateLocalization: vi.fn().mockResolvedValue({}),
    };
    const adapter = buildAdapter(mocks);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocale]);

    renderWithProviders(
      <ContentDetailPage
        adapter={adapter}
        renderToolbar={({ setValue, onSave }) => (
          <div>
            <button
              type="button"
              data-testid="edit"
              onClick={() => {
                // Force the entity update to be non-empty (status change) AND
                // a localization change in the same save.
                setValue('status', 'Published', { shouldDirty: true });
                setValue('body', 'Edited body', { shouldDirty: true });
              }}
            >
              Edit
            </button>
            <button type="button" data-testid="save-btn" onClick={onSave}>
              Save
            </button>
          </div>
        )}
        renderEditor={() => <div data-testid="editor-slot" />}
        renderStandardDialogs={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('edit'));
    await user.click(screen.getByTestId('save-btn'));

    // The entity update is attempted and rejects...
    await waitFor(() => {
      expect(mocks.updateEntity).toHaveBeenCalled();
    });
    // ...but the localization save still lands.
    await waitFor(() => {
      expect(mocks.updateLocalization).toHaveBeenCalledWith(
        'loc-1',
        expect.objectContaining({ body: 'Edited body' }),
      );
    });
  });

  it('renders loading state while detail is fetching', () => {
    const mocks: AdapterMocks = {
      fetchDetail: vi.fn().mockReturnValue(new Promise(() => {})),
      updateEntity: vi.fn(),
      createLocalization: vi.fn(),
      updateLocalization: vi.fn(),
    };
    const adapter = buildAdapter(mocks);
    vi.mocked(getSiteLocales).mockReturnValue(new Promise(() => {}) as never);

    renderWithProviders(
      <ContentDetailPage
        adapter={adapter}
        renderToolbar={() => null}
        renderEditor={() => null}
        renderStandardDialogs={() => null}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
