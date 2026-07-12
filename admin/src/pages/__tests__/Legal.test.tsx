import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within, userEvent } from '@/test/test-utils';
import { getLegalDocuments } from '@/services/legal';
import type { LegalDocumentResponse, Paginated } from '@/types/api';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockAuth = {
  permission: 'Admin' as const,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  memberships: [],
  isSystemAdmin: false,
  siteId: null,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  currentSiteRole: 'admin' as const,
  canManageMembers: true,
  canEditAll: true,
  isOwner: false,
  isGuest: false,
  clerkUserId: 'clerk-1',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: () => 'admin' as const,
};

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

vi.mock('@/services/legal');

// CookieConsentPage pulls a wide tree (legal services, MUI dialogs, etc.) we
// don't need for the documents-tab tracer; stub it out.
vi.mock('@/pages/CookieConsentPage', () => ({
  default: () => <div data-testid="cookie-consent.stub">Cookie Consent</div>,
}));

const mockDoc1: LegalDocumentResponse = {
  id: 'doc-1',
  cookie_name: 'privacy-policy',
  document_type: 'PrivacyPolicy',
  status: 'Published',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockDoc2: LegalDocumentResponse = {
  id: 'doc-2',
  cookie_name: 'terms-of-service',
  document_type: 'TermsOfService',
  status: 'Draft',
  version: 1,
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

const mockPaginated: Paginated<LegalDocumentResponse> = {
  data: [mockDoc1, mockDoc2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

type ListParamsArg = {
  search?: string;
  status?: string;
  exclude_status?: string;
  exclude_document_type?: string;
};

function listCalls(): Array<[string, ListParamsArg | undefined]> {
  return vi.mocked(getLegalDocuments).mock.calls as unknown as Array<
    [string, ListParamsArg | undefined]
  >;
}

let LegalPage: typeof import('@/pages/Legal').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  const mod = await import('@/pages/Legal');
  LegalPage = mod.default;
});

describe('LegalPage on EntityListPage harness', () => {
  it('renders documents list (tracer bullet)', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    expect(screen.getByText('terms-of-service')).toBeInTheDocument();
  });

  it('excludes CookieConsent and Archived server-side on the Active tab', async () => {
    // Regression: these filters were dropped at the adapter boundary, so the
    // status chips and Active/Archived tabs silently did nothing (#status-bug).
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    const [, params] = listCalls()[0];
    expect(params?.exclude_document_type).toBe('CookieConsent');
    expect(params?.exclude_status).toBe('Archived');
    expect(params?.status).toBeUndefined();
  });

  it('status chip filter refetches with the chosen status', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    // The chip is a <button>; the same label also appears in status pills, so
    // target it by role.
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await waitFor(() => {
      const matched = listCalls().some(([, params]) => params?.status === 'Draft');
      expect(matched).toBe(true);
    });
  });

  it('renders a status pill per document so status changes are visible', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    // mockDoc1 is Published, mockDoc2 is Draft — both pills render inside the
    // table (the same labels also exist as filter chips, hence the scoping).
    const table = within(screen.getByTestId('legal.table'));
    expect(table.getByText('Published')).toBeInTheDocument();
    expect(table.getByText('Draft')).toBeInTheDocument();
  });

  it('keeps outer LegalPage chrome — single PageHeader, outer Documents | CookieConsent tabs', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    // Outer LegalPage owns the page chrome — exactly one h1.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // Outer Documents | CookieConsent tabs are present.
    expect(screen.getByTestId('legal.tab.documents')).toBeInTheDocument();
    expect(screen.getByTestId('legal.tab.cookieConsent')).toBeInTheDocument();
  });

  it('row click navigates to /legal/${id} via routePath override', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByText('privacy-policy'));
    expect(mockNavigate).toHaveBeenCalledWith('/legal/doc-1');
  });

  it('search input wires through to getLegalDocuments after debounce', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(mockPaginated);
    renderWithProviders(<LegalPage />);
    await waitFor(() => {
      expect(screen.getByText('privacy-policy')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.type(screen.getByTestId('legal.search'), 'privacy');
    await waitFor(
      () => {
        const calls = vi.mocked(getLegalDocuments).mock.calls as unknown as Array<
          [string, { search?: string } | undefined]
        >;
        const matched = calls.some((args) => args[1]?.search === 'privacy');
        expect(matched).toBe(true);
      },
      { timeout: 2000 },
    );
  });
});
