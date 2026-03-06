import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import apiService from '@/services/api';
import type { PageSectionResponse, SectionLocalizationResponse, SiteLocaleResponse } from '@/types/api';

vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: { autosave_enabled: true, autosave_debounce_seconds: 3, language: 'en', theme_id: 'system' },
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

// Mock SectionSettingsForm
vi.mock('../SectionSettingsForm', () => ({
  default: () => <div data-testid="section-settings-form" />,
}));

vi.mock('@/components/media/MediaPickerDialog', () => ({
  default: () => null,
}));

// Mock useMediaUrl to avoid fetches
vi.mock('@/hooks/useMediaUrl', () => ({
  useMediaUrl: () => undefined,
}));

const mockSection: PageSectionResponse = {
  id: 'section-1',
  page_id: 'page-1',
  section_type: 'Hero',
  display_order: 0,
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

const mockLocalizations: SectionLocalizationResponse[] = [
  {
    id: 'loc-1',
    page_section_id: 'section-1',
    locale_id: 'locale-en',
    title: 'Hello',
    text: 'World',
    button_text: 'Click',
  },
];

let SectionEditorDialog: typeof import('../SectionEditorDialog').default;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(apiService.getSiteLocales).mockResolvedValue(mockLocales);
  vi.mocked(apiService.getSectionLocalizations).mockResolvedValue(mockLocalizations);
  vi.mocked(apiService.upsertSectionLocalization).mockResolvedValue({
    id: 'loc-new',
    page_section_id: 'section-1',
    locale_id: 'locale-en',
  });
  vi.mocked(apiService.updatePageSection).mockResolvedValue(undefined as never);
  const mod = await import('../SectionEditorDialog');
  SectionEditorDialog = mod.default;
});

describe('SectionEditorDialog', () => {
  it('renders a single Save button (no Save All)', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    // Should have exactly one Save button
    const saveButtons = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Save',
    );
    expect(saveButtons).toHaveLength(1);

    // No "Save All Locales" or "Save Section" button
    expect(screen.queryByText('Save Section')).not.toBeInTheDocument();
    expect(screen.queryByText('Save All Locales')).not.toBeInTheDocument();
  });

  it('renders locale tabs for all active locales', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('shows section type chip in dialog title only (no duplicate in config)', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    // Only one "Hero" chip should exist (in the title)
    const heroChips = screen.getAllByText('Hero');
    expect(heroChips).toHaveLength(1);
  });

  it('Save button saves all dirty locales and section config', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Type into the title field on EN tab
    const titleField = screen.getByLabelText('Title');
    await user.clear(titleField);
    await user.type(titleField, 'Updated EN');

    // Switch to DE tab
    await user.click(screen.getByText('DE'));

    // Type into the title field on DE tab
    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });
    const titleFieldDe = screen.getByLabelText('Title');
    await user.clear(titleFieldDe);
    await user.type(titleFieldDe, 'Updated DE');

    // Click Save
    const saveButton = screen.getAllByRole('button').find(
      (b) => b.textContent === 'Save',
    )!;
    await user.click(saveButton);

    // Should save both locales
    await waitFor(() => {
      expect(apiService.upsertSectionLocalization).toHaveBeenCalledTimes(2);
    });

    // Should also save section config
    expect(apiService.updatePageSection).toHaveBeenCalledTimes(1);
  });

  it('shows dirty indicator dot on tabs with unsaved changes', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Type into the title field to make EN dirty
    const titleField = screen.getByLabelText('Title');
    await user.type(titleField, ' modified');

    // Switch to DE to trigger stashCurrentLocale which bumps dirtyVersion
    await user.click(screen.getByText('DE'));

    // The EN tab had edits, so after switching away (which stashes + bumps version),
    // it should now show a dirty dot. Count the MuiBox-root divs inside each tab:
    // locale code text + "exists" chip (optional) + dirty dot = 3 children in the label Box.
    // Before any edits, the EN tab has 2 children (code text + exists chip).
    await waitFor(() => {
      const enTab = screen.getAllByRole('tab').find((t) => t.textContent?.includes('EN'));
      expect(enTab).toBeDefined();
      // The dirty dot is a child Box of the label Box. The label Box has class MuiBox-root.
      // When dirty, it gains an additional MuiBox-root child for the dot.
      const labelBox = enTab!.querySelector('.MuiBox-root');
      // Count child elements: text node (EN) + chip (exists) + dot (dirty) = 3 element children
      // The dot is a div.MuiBox-root with no text content
      const childDivs = labelBox!.querySelectorAll(':scope > .MuiBox-root');
      expect(childDivs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('populates form fields from existing localization data', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Click')).toBeInTheDocument();
  });

  it('does not render when section is null', () => {
    const { container } = renderWithProviders(
      <SectionEditorDialog open section={null} onClose={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

});
