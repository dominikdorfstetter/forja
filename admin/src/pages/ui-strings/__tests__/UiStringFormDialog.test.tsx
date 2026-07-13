import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { createUiString, getUiStringEntries, updateUiString } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import { localeDe, localeEn, localeFr, problemDetails, rowMinRead, uiString } from './fixtures';

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

import UiStringsPage from '../UiStringsPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUiStringEntries).mockResolvedValue([rowMinRead]);
  vi.mocked(getSiteLocales).mockResolvedValue([localeEn, localeDe, localeFr]);
});

const openCreateDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(<UiStringsPage />);
  await screen.findByText('blog.min_read');
  await user.click(screen.getByTestId('ui-strings.new'));
  await screen.findByTestId('ui-strings.dialog');
};

const openEditDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(<UiStringsPage />);
  await user.click(await screen.findByText('blog.min_read'));
  await screen.findByTestId('ui-strings.dialog');
};

describe('UiStringFormDialog — create', () => {
  it('POSTs the key with its default-locale value and closes on success', async () => {
    vi.mocked(createUiString).mockResolvedValue(uiString({ id: 'us-new', key: 'footer.tagline' }));
    const user = userEvent.setup();
    await openCreateDialog(user);

    await user.type(screen.getByTestId('ui-strings.field.key'), 'footer.tagline');
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'Built with Forja');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    await waitFor(() => {
      expect(createUiString).toHaveBeenCalledWith('site-1', {
        key: 'footer.tagline',
        localizations: [{ locale_id: 'loc-en', value: 'Built with Forja' }],
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ui-strings.dialog')).not.toBeInTheDocument();
    });
  });

  it('includes every locale the user filled in the single POST', async () => {
    vi.mocked(createUiString).mockResolvedValue(uiString({ id: 'us-new', key: 'footer.tagline' }));
    const user = userEvent.setup();
    await openCreateDialog(user);

    await user.type(screen.getByTestId('ui-strings.field.key'), 'footer.tagline');
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'Built with Forja');
    await user.click(screen.getByTestId('ui-strings.tab.de'));
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'Gebaut mit Forja');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    await waitFor(() => {
      expect(createUiString).toHaveBeenCalledWith('site-1', {
        key: 'footer.tagline',
        localizations: [
          { locale_id: 'loc-en', value: 'Built with Forja' },
          { locale_id: 'loc-de', value: 'Gebaut mit Forja' },
        ],
      });
    });
  });

  it('keeps submit disabled until the default-locale value is filled', async () => {
    const user = userEvent.setup();
    await openCreateDialog(user);

    await user.type(screen.getByTestId('ui-strings.field.key'), 'footer.tagline');
    expect(screen.getByTestId('ui-strings.dialog.submit')).toBeDisabled();

    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'Built with Forja');
    expect(screen.getByTestId('ui-strings.dialog.submit')).toBeEnabled();
  });

  it('rejects a malformed key client-side and never calls the API', async () => {
    const user = userEvent.setup();
    await openCreateDialog(user);

    await user.type(screen.getByTestId('ui-strings.field.key'), 'Bad Key');
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'whatever');

    expect(
      await screen.findByText("Use lowercase letters and digits, joined by '.', '_' or '-'"),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.dialog.submit')).toBeDisabled();
    expect(createUiString).not.toHaveBeenCalled();
  });

  it('surfaces the duplicate-key error (409 ERR_STRINGS_KEY_TAKEN) and stays open', async () => {
    vi.mocked(createUiString).mockRejectedValue(problemDetails('ERR_STRINGS_KEY_TAKEN', 409));
    const user = userEvent.setup();
    await openCreateDialog(user);

    await user.type(screen.getByTestId('ui-strings.field.key'), 'blog.min_read');
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'min read');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    expect(await screen.findByText(/Key already in use/)).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.dialog')).toBeInTheDocument();
  });

  it('surfaces the 500-key cap (422 ERR_STRINGS_LIMIT_EXCEEDED) as a friendly message', async () => {
    vi.mocked(createUiString).mockRejectedValue(problemDetails('ERR_STRINGS_LIMIT_EXCEEDED', 422));
    const user = userEvent.setup();
    await openCreateDialog(user);

    await user.type(screen.getByTestId('ui-strings.field.key'), 'one.too.many');
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'nope');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    expect(await screen.findByText(/String limit reached/)).toBeInTheDocument();
  });
});

describe('UiStringFormDialog — edit', () => {
  it('prefills the key and per-locale values, with status chips on the tabs', async () => {
    const user = userEvent.setup();
    await openEditDialog(user);

    expect(screen.getByTestId('ui-strings.field.key')).toHaveValue('blog.min_read');
    expect(screen.getByTestId('ui-strings.dialog.value')).toHaveValue('min read');
    expect(screen.getByTestId('ui-strings.dialog.status.de.outdated')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.dialog.status.fr.missing')).toBeInTheDocument();

    await user.click(screen.getByTestId('ui-strings.tab.de'));
    expect(screen.getByTestId('ui-strings.dialog.value')).toHaveValue('Min. Lesezeit');
  });

  it('PUTs only the changed locales in one batched request', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    await openEditDialog(user);

    const value = screen.getByTestId('ui-strings.dialog.value');
    await user.clear(value);
    await user.type(value, 'minutes to read');
    await user.click(screen.getByTestId('ui-strings.tab.de'));
    await user.clear(screen.getByTestId('ui-strings.dialog.value'));
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'Minuten Lesezeit');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    // fr was never touched — it must not appear (payload locales are exempt
    // from the backend's auto-outdated flip).
    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: undefined,
        localizations: [
          { locale_id: 'loc-en', value: 'minutes to read' },
          { locale_id: 'loc-de', value: 'Minuten Lesezeit' },
        ],
        removed_locale_ids: undefined,
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ui-strings.dialog')).not.toBeInTheDocument();
    });
  });

  it('does not resend an untouched outdated locale when saving another edit', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    await openEditDialog(user);

    const value = screen.getByTestId('ui-strings.dialog.value');
    await user.clear(value);
    await user.type(value, 'minutes to read');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    // de is outdated but untouched — resending it would silently confirm it.
    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: undefined,
        localizations: [{ locale_id: 'loc-en', value: 'minutes to read' }],
        removed_locale_ids: undefined,
      });
    });
  });

  it('re-sends an outdated value the user explicitly touched as the confirm', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    await openEditDialog(user);

    // Touch the outdated de value without ultimately changing it.
    await user.click(screen.getByTestId('ui-strings.tab.de'));
    await user.type(screen.getByTestId('ui-strings.dialog.value'), 'x{Backspace}');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: undefined,
        localizations: [{ locale_id: 'loc-de', value: 'Min. Lesezeit' }],
        removed_locale_ids: undefined,
      });
    });
  });

  it('sends a cleared persisted non-default value as a removal', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    await openEditDialog(user);

    await user.click(screen.getByTestId('ui-strings.tab.de'));
    await user.clear(screen.getByTestId('ui-strings.dialog.value'));

    expect(
      screen.getByText('Clearing this removes the translation when you save.'),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: undefined,
        localizations: [],
        removed_locale_ids: ['loc-de'],
      });
    });
  });

  it('blocks the save when the default-locale value is cleared', async () => {
    const user = userEvent.setup();
    await openEditDialog(user);

    await user.clear(screen.getByTestId('ui-strings.dialog.value'));

    expect(
      await screen.findByText('Value is required — the default value cannot be cleared'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.dialog.submit')).toBeDisabled();
    expect(updateUiString).not.toHaveBeenCalled();
  });

  it('renames the key in the same batched PUT', async () => {
    vi.mocked(updateUiString).mockResolvedValue(rowMinRead);
    const user = userEvent.setup();
    await openEditDialog(user);

    const key = screen.getByTestId('ui-strings.field.key');
    await user.clear(key);
    await user.type(key, 'blog.reading_time');
    await user.click(screen.getByTestId('ui-strings.dialog.submit'));

    await waitFor(() => {
      expect(updateUiString).toHaveBeenCalledWith('site-1', 'us-1', {
        key: 'blog.reading_time',
        localizations: [],
        removed_locale_ids: undefined,
      });
    });
  });

  it('keeps submit disabled while nothing changed', async () => {
    const user = userEvent.setup();
    await openEditDialog(user);

    expect(screen.getByTestId('ui-strings.dialog.submit')).toBeDisabled();
    expect(updateUiString).not.toHaveBeenCalled();
  });
});
