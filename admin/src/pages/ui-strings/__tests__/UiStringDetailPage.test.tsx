import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { createUiString, getUiStringEntries, updateUiString } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import {
  localeDe,
  localeEn,
  localeFr,
  localization,
  problemDetails,
  rowMinRead,
  uiString,
} from './fixtures';

const mockNavigate = vi.fn();
let mockParams: { id?: string } = {};
vi.mock('react-router', async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

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

import UiStringDetailPage from '../UiStringDetailPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.canEditAll = true;
  mockParams = {};
  vi.mocked(getUiStringEntries).mockResolvedValue([rowMinRead]);
  vi.mocked(getSiteLocales).mockResolvedValue([localeEn, localeDe, localeFr]);
});

describe('UiStringDetailPage — create', () => {
  it('rejects a malformed key client-side and never calls the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    await user.type(await screen.findByTestId('ui-strings.field.key'), 'Bad Key');
    await user.type(screen.getByTestId('ui-strings.field.value'), 'whatever');

    expect(
      await screen.findByText("Use lowercase letters and digits, joined by '.', '_' or '-'"),
    ).toBeInTheDocument();

    await user.click(await screen.findByTestId('ui-strings.detail.save'));
    await waitFor(() => {
      expect(createUiString).not.toHaveBeenCalled();
    });
  });

  it('creates the key with its default-locale value and navigates to the editor', async () => {
    vi.mocked(createUiString).mockResolvedValue(uiString({ id: 'us-new', key: 'footer.tagline' }));
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    await user.type(await screen.findByTestId('ui-strings.field.key'), 'footer.tagline');
    await user.type(screen.getByTestId('ui-strings.field.value'), 'Built with Forja');
    await user.click(await screen.findByTestId('ui-strings.detail.save'));

    await waitFor(() => {
      expect(createUiString).toHaveBeenCalledWith('site-1', {
        key: 'footer.tagline',
        localizations: [{ locale_id: 'loc-en', value: 'Built with Forja' }],
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/ui-strings/us-new', { replace: true });
  });

  it('surfaces the duplicate-key error (409 ERR_STRINGS_KEY_TAKEN) as a friendly message', async () => {
    vi.mocked(createUiString).mockRejectedValue(problemDetails('ERR_STRINGS_KEY_TAKEN', 409));
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    await user.type(await screen.findByTestId('ui-strings.field.key'), 'blog.min_read');
    await user.click(await screen.findByTestId('ui-strings.detail.save'));

    expect(await screen.findByText(/Key already in use/)).toBeInTheDocument();
  });

  it('surfaces the 500-key cap (422 ERR_STRINGS_LIMIT_EXCEEDED) as a friendly message', async () => {
    vi.mocked(createUiString).mockRejectedValue(problemDetails('ERR_STRINGS_LIMIT_EXCEEDED', 422));
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    await user.type(await screen.findByTestId('ui-strings.field.key'), 'one.too.many');
    await user.click(await screen.findByTestId('ui-strings.detail.save'));

    expect(await screen.findByText(/String limit reached/)).toBeInTheDocument();
  });
});

describe('UiStringDetailPage — edit', () => {
  beforeEach(() => {
    mockParams = { id: 'us-1' };
  });

  it('loads the key and default-locale value into the form', async () => {
    renderWithProviders(<UiStringDetailPage />);

    expect(await screen.findByDisplayValue('blog.min_read')).toBeInTheDocument();
    expect(screen.getByDisplayValue('min read')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.tab.de')).toBeInTheDocument();
  });

  it('saves an edited default value through the save bar as a localization upsert', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    const valueField = await screen.findByTestId('ui-strings.field.value');
    await user.clear(valueField);
    await user.type(valueField, 'minutes to read');
    await user.click(await screen.findByTestId('ui-strings.detail.save'));

    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: undefined,
        localizations: [{ locale_id: 'loc-en', value: 'minutes to read' }],
      });
    });
  });

  it('batches an in-flight non-default edit into the save-bar PUT alongside the default value', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    const valueField = await screen.findByTestId('ui-strings.field.value');
    await user.clear(valueField);
    await user.type(valueField, 'minutes to read');

    await user.click(screen.getByTestId('ui-strings.tab.de'));
    const localized = await screen.findByTestId('ui-strings.field.value.localized');
    await user.clear(localized);
    await user.type(localized, 'Minuten Lesezeit');

    await user.click(await screen.findByTestId('ui-strings.detail.save'));

    // The fresh de translation rides in the same PUT as the changed default
    // value, so the backend's auto-outdated flip exempts it.
    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: undefined,
        localizations: [
          { locale_id: 'loc-en', value: 'minutes to read' },
          { locale_id: 'loc-de', value: 'Minuten Lesezeit' },
        ],
      });
    });
  });

  it('blocks clearing the default-locale value with a validation error instead of a silent no-op', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    const valueField = await screen.findByTestId('ui-strings.field.value');
    await user.clear(valueField);

    expect(
      await screen.findByText('Value is required — the default value cannot be cleared'),
    ).toBeInTheDocument();

    await user.click(await screen.findByTestId('ui-strings.detail.save'));
    await waitFor(() => {
      expect(updateUiString).not.toHaveBeenCalled();
    });
  });

  it('does not PUT when a non-default value is blurred unchanged', async () => {
    vi.mocked(getUiStringEntries).mockResolvedValue([
      uiString({
        id: 'us-1',
        key: 'blog.min_read',
        localizations: [
          localization('l-1', 'loc-en', 'min read'),
          localization('l-2', 'loc-de', 'Min. Lesezeit'),
        ],
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    await user.click(await screen.findByTestId('ui-strings.tab.de'));
    await user.click(await screen.findByTestId('ui-strings.field.value.localized'));
    await user.tab();

    await waitFor(() => {
      expect(updateUiString).not.toHaveBeenCalled();
    });
  });

  it('re-upserts an unchanged but outdated value on blur so the confirm-save clears the flag', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    // rowMinRead's de localization is flagged Outdated.
    await user.click(await screen.findByTestId('ui-strings.tab.de'));
    await user.click(await screen.findByTestId('ui-strings.field.value.localized'));
    await user.tab();

    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        localizations: [{ locale_id: 'loc-de', value: 'Min. Lesezeit' }],
      });
    });
  });

  it('saves a non-default locale value on blur (LocaleAwareFields path)', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    renderWithProviders(<UiStringDetailPage />);

    await user.click(await screen.findByTestId('ui-strings.tab.de'));
    const localized = await screen.findByTestId('ui-strings.field.value.localized');
    expect(localized).toHaveValue('Min. Lesezeit');

    await user.clear(localized);
    await user.type(localized, 'Mindestlesezeit');
    await user.tab();

    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        localizations: [{ locale_id: 'loc-de', value: 'Mindestlesezeit' }],
      });
    });
  });

  it('renders read-only for viewers: disabled key, plain values, no delete', async () => {
    mockAuth.canEditAll = false;
    renderWithProviders(<UiStringDetailPage />);

    expect(await screen.findByDisplayValue('blog.min_read')).toBeDisabled();
    expect(screen.getByTestId('ui-strings.readonly.de')).toHaveValue('Min. Lesezeit');
    expect(screen.getByTestId('ui-strings.readonly.fr')).toHaveValue('');
    expect(screen.queryByTestId('ui-strings.detail.delete')).not.toBeInTheDocument();
  });

  it('shows not-found when the id does not exist', async () => {
    mockParams = { id: 'nope' };
    renderWithProviders(<UiStringDetailPage />);

    expect(await screen.findByText('This UI string does not exist.')).toBeInTheDocument();
  });
});
