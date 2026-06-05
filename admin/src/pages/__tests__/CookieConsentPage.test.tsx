import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getLegalDocuments, getLegalGroups } from '@/services/legal';
import type { Paginated, LegalDocumentResponse } from '@/types/api';
import CookieConsentPage from '@/pages/CookieConsentPage';

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

const mockAuth = {
  permission: 'Admin' as const,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  memberships: [],
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
};

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const emptyCookieConsentResult: Paginated<LegalDocumentResponse> = {
  data: [],
  meta: { page: 1, page_size: 100, total_items: 0, total_pages: 0 },
};

const cookieConsentDoc: LegalDocumentResponse = {
  id: 'doc-cookie-1',
  cookie_name: 'cookie_consent',
  document_type: 'CookieConsent',
  status: 'Draft',
  version: 1,
  publish_start: null,
  publish_end: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const cookieConsentResult: Paginated<LegalDocumentResponse> = {
  data: [cookieConsentDoc],
  meta: { page: 1, page_size: 100, total_items: 1, total_pages: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  vi.mocked(getLegalGroups).mockResolvedValue([]);
});

describe('CookieConsentPage', () => {
  it('shows empty state when no cookie consent document exists', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(emptyCookieConsentResult);
    renderWithProviders(<CookieConsentPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('shows create button for users with write access when document is missing', async () => {
    mockAuth.canWrite = true;
    vi.mocked(getLegalDocuments).mockResolvedValue(emptyCookieConsentResult);
    renderWithProviders(<CookieConsentPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const buttons = screen.getAllByRole('button');
    const createBtn = buttons.find((b) => b.textContent?.toLowerCase().includes('creat') || b.textContent?.toLowerCase().includes('cookie'));
    expect(createBtn).toBeDefined();
  });

  it('shows loading state while the document is being fetched', () => {
    vi.mocked(getLegalDocuments).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<CookieConsentPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders document info once cookie consent document is loaded', async () => {
    vi.mocked(getLegalDocuments).mockResolvedValue(cookieConsentResult);
    renderWithProviders(<CookieConsentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('cookie-consent.doc-info')).toBeInTheDocument();
    });
    expect(screen.getByText('cookie_consent')).toBeInTheDocument();
  });
});
