import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getSectionLocalizations, updatePageSection, upsertSectionLocalization } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import type {
  PageSectionResponse,
  SectionLocalizationResponse,
  SiteLocaleResponse,
  UpdatePageSectionRequest,
  UpsertSectionLocalizationRequest,
} from '@/types/api';

vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: { language: 'en', theme_id: 'system', page_size: 25 },
    isLoading: false,
    updatePreferences: vi.fn(),
    isUpdating: false,
  }),
}));

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

// Mock ForjaEditor to avoid Tiptap/MUI interaction issues in jsdom
vi.mock('@/components/editor', () => ({
  ForjaEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="mock-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('../SectionSettingsForm', () => ({
  default: () => <div data-testid="section-settings-form" />,
}));

vi.mock('@/components/media/MediaPickerDialog', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useMediaUrl', () => ({
  useMediaUrl: () => undefined,
}));

const defaultItems = [{ title: 'Fast', text: 'Ships quick', icon: '⚡' }];

const mockSection: PageSectionResponse = {
  id: 'section-1',
  page_id: 'page-1',
  section_type: 'Features',
  display_order: 0,
  settings: { columns: 2, items: defaultItems },
};

const mockLocales: SiteLocaleResponse[] = [
  {
    site_id: 'site-1',
    locale_id: 'locale-en',
    is_default: true,
    is_active: true,
    url_prefix: 'en',
    created_at: '2025-01-01T00:00:00Z',
    code: 'en',
    name: 'English',
    native_name: 'English',
    direction: 'Ltr',
  },
  {
    site_id: 'site-1',
    locale_id: 'locale-de',
    is_default: false,
    is_active: true,
    url_prefix: 'de',
    created_at: '2025-01-01T00:00:00Z',
    code: 'de',
    name: 'German',
    native_name: 'Deutsch',
    direction: 'Ltr',
  },
];

const enLocalization: SectionLocalizationResponse = {
  id: 'loc-1',
  page_section_id: 'section-1',
  locale_id: 'locale-en',
  title: 'Hello',
  text: 'World',
  button_text: 'Click',
  items: null,
};

let SectionEditorDialog: typeof import('../SectionEditorDialog').default;

function upsertPayloads(): UpsertSectionLocalizationRequest[] {
  return vi.mocked(upsertSectionLocalization).mock.calls.map(([, data]) => data);
}

function lastSectionUpdate(): UpdatePageSectionRequest {
  const calls = vi.mocked(updatePageSection).mock.calls;
  return calls[calls.length - 1][1];
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getSiteLocales).mockResolvedValue(mockLocales);
  vi.mocked(getSectionLocalizations).mockResolvedValue([enLocalization]);
  vi.mocked(upsertSectionLocalization).mockResolvedValue(enLocalization);
  vi.mocked(updatePageSection).mockResolvedValue(mockSection);
  const mod = await import('../SectionEditorDialog');
  SectionEditorDialog = mod.default;
});

async function renderAndWaitForTabs() {
  renderWithProviders(
    <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
  );
  await waitFor(() => {
    expect(screen.getByText('EN')).toBeInTheDocument();
  });
}

describe('SectionEditorDialog — per-locale items localization', () => {
  it('default locale edits settings.items as before and saves them on the section', async () => {
    await renderAndWaitForTabs();
    const user = userEvent.setup();

    const itemTitle = screen.getByDisplayValue('Fast');
    expect(itemTitle).not.toBeDisabled();
    await user.clear(itemTitle);
    await user.type(itemTitle, 'Rapid');

    await user.click(screen.getByTestId('section-editor.btn.submit'));

    await waitFor(() => {
      expect(updatePageSection).toHaveBeenCalled();
    });
    const settings = lastSectionUpdate().settings as { items: Record<string, unknown>[] };
    expect(settings.items).toEqual([{ title: 'Rapid', text: 'Ships quick', icon: '⚡' }]);

    // The default locale never writes an items override.
    for (const payload of upsertPayloads()) {
      expect(payload.items).toBeUndefined();
    }
  });

  it('non-default locale without an override shows the default items read-only with a localize action', async () => {
    await renderAndWaitForTabs();
    const user = userEvent.setup();

    await user.click(screen.getByText('DE'));

    expect(await screen.findByTestId('section-editor.items.fallback-notice')).toBeInTheDocument();
    expect(screen.getByTestId('section-editor.items.btn.localize')).toBeInTheDocument();
    expect(screen.queryByTestId('section-editor.items.btn.remove-localization')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Fast')).toBeDisabled();
  });

  it('localize copies the default items into an editable per-locale override and persists it for that locale only', async () => {
    await renderAndWaitForTabs();
    const user = userEvent.setup();

    await user.click(screen.getByText('DE'));
    await user.click(await screen.findByTestId('section-editor.items.btn.localize'));

    const itemTitle = await screen.findByDisplayValue('Fast');
    expect(itemTitle).not.toBeDisabled();
    await user.clear(itemTitle);
    await user.type(itemTitle, 'Schnell');

    await user.click(screen.getByTestId('section-editor.btn.submit'));

    await waitFor(() => {
      expect(upsertSectionLocalization).toHaveBeenCalled();
    });
    const dePayload = upsertPayloads().find((p) => p.locale_id === 'locale-de');
    expect(dePayload?.items).toEqual([{ title: 'Schnell', text: 'Ships quick', icon: '⚡' }]);

    // The default items are untouched by localizing another locale.
    const settings = lastSectionUpdate().settings as { items: Record<string, unknown>[] };
    expect(settings.items).toEqual(defaultItems);
  });

  it('remove localization clears the override so the locale falls back to the default items', async () => {
    const deLocalization: SectionLocalizationResponse = {
      id: 'loc-2',
      page_section_id: 'section-1',
      locale_id: 'locale-de',
      title: 'Hallo',
      text: null,
      button_text: null,
      items: [{ title: 'Alt', text: 'Alte Fassung', icon: '⚡' }],
    };
    vi.mocked(getSectionLocalizations).mockResolvedValue([enLocalization, deLocalization]);

    await renderAndWaitForTabs();
    const user = userEvent.setup();

    await user.click(screen.getByText('DE'));

    expect(await screen.findByTestId('section-editor.items.override-notice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alt')).not.toBeDisabled();

    await user.click(screen.getByTestId('section-editor.items.btn.remove-localization'));

    expect(await screen.findByTestId('section-editor.items.fallback-notice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fast')).toBeDisabled();

    await user.click(screen.getByTestId('section-editor.btn.submit'));

    await waitFor(() => {
      expect(upsertSectionLocalization).toHaveBeenCalled();
    });
    const dePayload = upsertPayloads().find((p) => p.locale_id === 'locale-de');
    expect(dePayload).toBeDefined();
    expect(dePayload?.items).toBeUndefined();
  });
});
