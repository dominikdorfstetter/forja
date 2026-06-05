import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import {
  getDocument,
  getDocumentFolders,
  getDocuments,
  unlockDocumentAccess,
} from '@/services/documents';
import userEvent from '@testing-library/user-event';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { DocumentListItem, DocumentResponse, DocumentFolder, SiteLocaleResponse, Paginated } from '@/types/api';

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
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockDocument: DocumentListItem = {
  id: 'doc-1',
  site_id: 'site-1',
  file_name: 'report.pdf',
  url: 'https://cdn.example.com/report.pdf',
  document_type: 'pdf',
  file_size: 524288,
  folder_id: 'folder-1',
  has_file: false,
  is_private: false,
  private_failed_attempt_count: 0,
  display_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockFolder: DocumentFolder = {
  id: 'folder-1',
  name: 'Reports',
  site_id: 'site-1',
  display_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockDetail: DocumentResponse = {
  ...mockDocument,
  localizations: [],
};

const mockLocalization: SiteLocaleResponse =
{
  site_id: 'site-1',
  locale_id: 'locale-1',
  is_default: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  code: 'en',
  name: 'English',
  native_name: 'English',
  direction: 'Ltr' as const,
} as
never;

const mockPaginatedDocuments: Paginated<DocumentListItem> = {
  data: [mockDocument],
  meta: { page: 1, page_size: 25, total_items: 1, total_pages: 1 },
};

const emptyPaginated: Paginated<DocumentListItem> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let DocumentsPage: typeof import('@/pages/Documents').default;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue({ editorial_workflow_enabled: false } as never);
  const mod = await import('@/pages/Documents');
  DocumentsPage = mod.default;
});

describe('DocumentsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getDocumentFolders).mockReturnValue(new Promise(() => {}));
    vi.mocked(getDocuments).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DocumentsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the documents page with folder sidebar and card grid', async () => {
    vi.mocked(getDocumentFolders).mockResolvedValue([mockFolder]);
    vi.mocked(getDocuments).mockResolvedValue(mockPaginatedDocuments);
    vi.mocked(getDocument).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocalization]);

    renderWithProviders(<DocumentsPage />);

    // Wait for the folder sidebar to appear
    await waitFor(() => {
      expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
    });

    // Folder is visible
    expect(screen.getByText('Reports')).toBeInTheDocument();

    // Document card is rendered
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  it('shows empty state when no documents', async () => {
    vi.mocked(getDocumentFolders).mockResolvedValue([]);
    vi.mocked(getDocuments).mockResolvedValue(emptyPaginated);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocalization]);

    renderWithProviders(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Empty state status elements appear
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  // Regression: the documents list paginated from page 2 on initial mount
  // because the query fn double-incremented a 1-indexed page counter
  // (`page: ui.page + 1` with `initialUIState.page === 1`). The newest
  // document — which sorts to the top of page 1 under the default
  // `created_at DESC` order — was therefore never shown, and changing
  // the page size requested an out-of-range page and returned empty.
  it('requests page 1 (not page 2) on initial mount', async () => {
    vi.mocked(getDocumentFolders).mockResolvedValue([]);
    vi.mocked(getDocuments).mockResolvedValue(mockPaginatedDocuments);
    vi.mocked(getDocument).mockResolvedValue(mockDetail);
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocalization]);

    renderWithProviders(<DocumentsPage />);

    await waitFor(() => {
      expect(getDocuments).toHaveBeenCalled();
    });

    const [, params] = vi.mocked(getDocuments).mock.calls[0];
    expect(params).toMatchObject({ page: 1 });
  });

  // Regression: the unlock confirmation used the native window.confirm()
  // browser dialog. It must be an in-app MUI dialog instead.
  it('opens an in-app confirm dialog for unlock (never window.confirm)', async () => {
    // The card action strip is `pointer-events: none` until a CSS :hover
    // reveal that jsdom doesn't apply; this test exercises the handler
    // wiring, not the hover reveal, so skip the pointer-events guard.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const confirmSpy = vi.spyOn(window, 'confirm');
    const lockedDoc: DocumentListItem = {
      ...mockDocument,
      id: 'locked-doc',
      file_name: 'secret.pdf',
      has_file: true,
      is_private: true,
      private_locked_until: '9999-12-31T23:59:59Z',
    };
    vi.mocked(getDocumentFolders).mockResolvedValue([]);
    vi.mocked(getDocuments).mockResolvedValue({
      data: [lockedDoc],
      meta: { page: 1, page_size: 25, total_items: 1, total_pages: 1 },
    });
    vi.mocked(getDocument).mockResolvedValue({ ...mockDetail, ...lockedDoc });
    vi.mocked(getSiteLocales).mockResolvedValue([mockLocalization]);
    vi.mocked(unlockDocumentAccess).mockResolvedValue(undefined as never);

    renderWithProviders(<DocumentsPage />);

    const unlockBtn = await screen.findByTestId('document-card.btn.unlock');
    await user.click(unlockBtn);

    // In-app dialog appears; window.confirm is never used.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
