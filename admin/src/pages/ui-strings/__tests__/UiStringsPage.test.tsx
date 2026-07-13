import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { deleteUiString, getUiStringEntries } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import { localeDe, localeEn, localeFr, manyUiStrings, rowFooterLinks, rowMinRead } from './fixtures';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: {
      id: 'site-1',
      name: 'Test Site',
      slug: 'test-site',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockAuth = {
  permission: 'Admin' as const,
  siteId: null,
  loading: false,
  memberships: [],
  isSystemAdmin: false,
  isGuest: false,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
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

import UiStringsPage from '../UiStringsPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.canEditAll = true;
  vi.mocked(getUiStringEntries).mockResolvedValue([rowMinRead, rowFooterLinks]);
  vi.mocked(getSiteLocales).mockResolvedValue([localeEn, localeDe, localeFr]);
});

describe('UiStringsPage', () => {
  it('shows a loading state while entries are pending', () => {
    vi.mocked(getUiStringEntries).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<UiStringsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders keys with per-locale completeness and status chips', async () => {
    renderWithProviders(<UiStringsPage />);

    expect(await screen.findByText('blog.min_read')).toBeInTheDocument();
    expect(screen.getByText('footer.links')).toBeInTheDocument();

    expect(screen.getByTestId('ui-strings.chip.blog.min_read.en.translated')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.chip.blog.min_read.de.outdated')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.chip.blog.min_read.fr.missing')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.chip.footer.links.fr.translated')).toBeInTheDocument();
  });

  it('filters down to rows with missing translations', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    await user.click(screen.getByRole('combobox', { name: 'Filter strings' }));
    await user.click(await screen.findByRole('option', { name: 'Missing translations' }));

    expect(screen.getByText('blog.min_read')).toBeInTheDocument();
    expect(screen.queryByText('footer.links')).not.toBeInTheDocument();
  });

  it('filters down to rows with outdated translations', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    await user.click(screen.getByRole('combobox', { name: 'Filter strings' }));
    await user.click(await screen.findByRole('option', { name: 'Outdated' }));

    expect(screen.getByText('blog.min_read')).toBeInTheDocument();
    expect(screen.queryByText('footer.links')).not.toBeInTheDocument();
  });

  it('filters rows by key substring, case-insensitively', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    await user.type(screen.getByTestId('ui-strings.search'), 'FOOTER');

    expect(screen.getByText('footer.links')).toBeInTheDocument();
    expect(screen.queryByText('blog.min_read')).not.toBeInTheDocument();
  });

  it('composes the key search with the coverage filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    await user.click(screen.getByRole('combobox', { name: 'Filter strings' }));
    await user.click(await screen.findByRole('option', { name: 'Missing translations' }));
    await user.type(screen.getByTestId('ui-strings.search'), 'footer');

    // footer.links is fully translated — nothing matches missing + "footer".
    expect(screen.getByText('No strings match your search or filter.')).toBeInTheDocument();
    expect(screen.queryByText('footer.links')).not.toBeInTheDocument();
  });

  it('paginates the list and navigates between pages', async () => {
    vi.mocked(getUiStringEntries).mockResolvedValue(manyUiStrings(12));
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);

    expect(await screen.findByText('bulk.key_01')).toBeInTheDocument();
    expect(screen.getByText('bulk.key_10')).toBeInTheDocument();
    expect(screen.queryByText('bulk.key_11')).not.toBeInTheDocument();
    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Next page'));

    expect(await screen.findByText('bulk.key_11')).toBeInTheDocument();
    expect(screen.getByText('bulk.key_12')).toBeInTheDocument();
    expect(screen.queryByText('bulk.key_01')).not.toBeInTheDocument();
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
  });

  it('resets to page 1 when the search changes', async () => {
    vi.mocked(getUiStringEntries).mockResolvedValue(manyUiStrings(12));
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('bulk.key_01');

    await user.click(screen.getByLabelText('Next page'));
    expect(await screen.findByText('bulk.key_11')).toBeInTheDocument();

    await user.type(screen.getByTestId('ui-strings.search'), 'key_01');

    // Back on page 1 — the match is visible instead of an empty page 2.
    expect(await screen.findByText('bulk.key_01')).toBeInTheDocument();
    expect(screen.getByText('1–1 of 1')).toBeInTheDocument();
  });

  it('opens the edit dialog with the row prefilled on row click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);

    await user.click(await screen.findByText('blog.min_read'));

    expect(await screen.findByTestId('ui-strings.dialog')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.field.key')).toHaveValue('blog.min_read');
  });

  it('opens the create dialog from the header action', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    await user.click(screen.getByTestId('ui-strings.new'));

    expect(await screen.findByTestId('ui-strings.dialog')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.field.key')).toHaveValue('');
  });

  it('deletes a string after the confirm dialog', async () => {
    vi.mocked(deleteUiString).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    await user.click(screen.getAllByTestId('ui-strings.row-actions')[0]);
    await user.click(await screen.findByText('Delete'));
    await user.click(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(deleteUiString).toHaveBeenCalledWith('site-1', 'us-1');
    });
  });

  it('hides write affordances from viewers (read-only)', async () => {
    mockAuth.canEditAll = false;
    renderWithProviders(<UiStringsPage />);
    await screen.findByText('blog.min_read');

    expect(screen.queryByTestId('ui-strings.new')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('ui-strings.row-actions')).toHaveLength(0);
  });

  it('opens a read-only dialog for viewers: disabled fields, no submit', async () => {
    mockAuth.canEditAll = false;
    const user = userEvent.setup();
    renderWithProviders(<UiStringsPage />);

    await user.click(await screen.findByText('blog.min_read'));

    expect(await screen.findByTestId('ui-strings.dialog')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.field.key')).toBeDisabled();
    expect(screen.getByTestId('ui-strings.dialog.value')).toBeDisabled();
    expect(screen.queryByTestId('ui-strings.dialog.submit')).not.toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.dialog.close')).toBeInTheDocument();
  });

  it('shows the empty state when the site has no strings', async () => {
    vi.mocked(getUiStringEntries).mockResolvedValue([]);
    renderWithProviders(<UiStringsPage />);

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No UI strings yet')).toBeInTheDocument();
  });

  it('shows an error alert when loading fails', async () => {
    vi.mocked(getUiStringEntries).mockRejectedValue(new Error('boom'));
    renderWithProviders(<UiStringsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
