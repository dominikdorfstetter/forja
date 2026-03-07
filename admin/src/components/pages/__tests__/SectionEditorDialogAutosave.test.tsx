import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import type { PageSectionResponse, SiteLocaleResponse } from '@/types/api';
import type { AutosaveStatus } from '@/hooks/useAutosave';

// Controllable mock for useAutosave — lets us set status per test
const mockFlush = vi.fn().mockResolvedValue(undefined);
let mockStatus: AutosaveStatus = 'idle';

vi.mock('@/hooks/useAutosave', () => ({
  useAutosave: () => ({
    status: mockStatus,
    lastSavedAt: null,
    flush: mockFlush,
  }),
}));

vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: { autosave_enabled: true, autosave_debounce_seconds: 3, language: 'en', theme_id: 'system', page_size: 25 },
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

import apiService from '@/services/api';

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
];

let SectionEditorDialog: typeof import('../SectionEditorDialog').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockStatus = 'idle';
  vi.mocked(apiService.getSiteLocales).mockResolvedValue(mockLocales);
  vi.mocked(apiService.getSectionLocalizations).mockResolvedValue([]);
  const mod = await import('../SectionEditorDialog');
  SectionEditorDialog = mod.default;
});

describe('SectionEditorDialog autosave status', () => {
  it('shows "Saving..." chip when autosave status is saving', async () => {
    mockStatus = 'saving';

    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    // Both the chip and button show "Saving..." — verify the chip exists
    // MUI Dialog renders in a portal, so search the whole document
    const chips = document.querySelectorAll('.MuiChip-root');
    const savingChip = Array.from(chips).find((c) => c.textContent === 'Saving...');
    expect(savingChip).toBeTruthy();
  });

  it('shows "All changes saved" chip when autosave status is saved', async () => {
    mockStatus = 'saved';

    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('shows "Save failed" chip when autosave status is error', async () => {
    mockStatus = 'error';

    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });

  it('shows no status chip when autosave is idle', async () => {
    mockStatus = 'idle';

    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    expect(screen.queryByText('All changes saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
  });

  it('disables Save button when autosave is saving', async () => {
    mockStatus = 'saving';

    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    // The Save button shows "Saving..." and is disabled
    const saveButtons = screen.getAllByText('Saving...');
    const saveButton = saveButtons.map((el) => el.closest('button')).find(
      (btn) => btn && btn.classList.contains('MuiButton-contained'),
    );
    expect(saveButton).toBeDefined();
    expect(saveButton).toBeDisabled();
  });

  it('calls flush on close', async () => {
    renderWithProviders(
      <SectionEditorDialog open section={mockSection} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('EN')).toBeInTheDocument();
    });

    // Click the close X button
    const closeButton = screen.getByLabelText('Close');
    closeButton.click();

    await waitFor(() => {
      expect(mockFlush).toHaveBeenCalled();
    });
  });
});
