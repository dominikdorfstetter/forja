import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import type {
  PageSectionResponse,
  SectionLocalizationResponse,
  SiteLocaleResponse,
  AiGenerateResponse,
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
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/editor', () => ({
  ForjaEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="mock-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('../SectionSettingsForm', () => ({ default: () => <div data-testid="section-settings-form" /> }));
vi.mock('@/components/media/MediaPickerDialog', () => ({ default: () => null }));
vi.mock('@/hooks/useMediaUrl', () => ({ useMediaUrl: () => undefined }));

const moduleState = { ai: false };
vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    modules: { ai: moduleState.ai, blog: true, pages: true, portfolio: false, legal: false, documents: false, forms: false },
    features: { editorial_workflow: false, scheduling: true, versioning: true, analytics: false },
    suggestions: { show_team_workflow_prompt: false },
    integration: {},
    isLoading: false,
  }),
}));

import { generateAiContent, getAiConfig } from '@/services/ai';
import { getSectionLocalizations } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
const mockSection: PageSectionResponse = {
  id: 'section-1',
  page_id: 'page-1',
  section_type: 'Hero',
  display_order: 0,
};

const mockLocalesMulti: SiteLocaleResponse[] = [
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

const mockEnLocalization: SectionLocalizationResponse = {
  id: 'loc-en-1',
  page_section_id: 'section-1',
  locale_id: 'locale-en',
  title: 'Pricing built for teams',
  text: 'Pay only for what you use. No surprises, no lock-in.',
  button_text: 'Start free trial',
};

const aiConfig = {
  id: 'cfg-1',
  site_id: 'site-1',
  provider_name: 'openai',
  base_url: 'https://api.openai.com',
  api_key_masked: 'sk-****',
  model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 1024,
  system_prompts: {},
  task_configs: {},
  updated_at: '2025-01-01T00:00:00Z',
};

let SectionEditorDialog: typeof import('../SectionEditorDialog').default;

beforeEach(async () => {
  vi.clearAllMocks();
  moduleState.ai = false;
  vi.mocked(getSiteLocales).mockResolvedValue(mockLocalesMulti);
  vi.mocked(getSectionLocalizations).mockResolvedValue([mockEnLocalization]);
  vi.mocked(getAiConfig).mockReset();
  const mod = await import('../SectionEditorDialog');
  SectionEditorDialog = mod.default;
});

describe('SectionEditorDialog — AI Suggest Translation', () => {
  it('hides the Suggest Translation button when the AI module is disabled', async () => {
    moduleState.ai = false;

    renderWithProviders(<SectionEditorDialog open section={mockSection} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('DE')).toBeInTheDocument());
    expect(screen.queryByTestId('section-editor.btn.suggest-translation')).toBeNull();
  });

  it('hides the Suggest Translation button on the default locale tab', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue(aiConfig as never);

    renderWithProviders(<SectionEditorDialog open section={mockSection} onClose={vi.fn()} />);

    // Default tab (EN) is selected on open — translation makes no sense here.
    await waitFor(() => expect(screen.getByText('EN')).toBeInTheDocument());
    expect(screen.queryByTestId('section-editor.btn.suggest-translation')).toBeNull();
  });

  it('shows Suggest Translation on non-default locale tab and translates section fields end-to-end', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue(aiConfig as never);

    const aiResult: AiGenerateResponse = {
      title: 'Preise, gemacht für Teams',
      text: 'Zahle nur, was du nutzt. Keine Überraschungen.',
      button_text: 'Jetzt starten',
    };
    vi.mocked(generateAiContent).mockResolvedValue(aiResult);

    const user = userEvent.setup();
    renderWithProviders(<SectionEditorDialog open section={mockSection} onClose={vi.fn()} />);

    // Switch to DE tab
    const deTab = await screen.findByText('DE');
    await user.click(deTab);

    // Button now visible
    const suggestButton = await screen.findByTestId('section-editor.btn.suggest-translation');
    await user.click(suggestButton);

    // Dialog opens — Generate button visible
    const generateButton = await screen.findByTestId('section-translate-dialog.btn.generate');
    await user.click(generateButton);

    // Apply when preview populated
    await waitFor(() =>
      expect(generateAiContent).toHaveBeenCalledWith('site-1', expect.objectContaining({
        action: 'translate',
        target_locale: 'de',
      })),
    );

    // Source content (from EN localization) must be in the request payload
    const lastCall = vi.mocked(generateAiContent).mock.calls.at(-1);
    const payload = JSON.parse(lastCall?.[1].content ?? '{}');
    expect(payload.title).toBe('Pricing built for teams');
    expect(payload.text).toBe('Pay only for what you use. No surprises, no lock-in.');
    expect(payload.button_text).toBe('Start free trial');

    const applyButton = await screen.findByTestId('section-translate-dialog.btn.apply');
    await user.click(applyButton);

    // DE locale form populated with the translated values
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Preise, gemacht für Teams');
    });
    const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('Zahle nur, was du nutzt. Keine Überraschungen.');
    const buttonTextInput = screen.getByLabelText(/button text/i) as HTMLInputElement;
    expect(buttonTextInput.value).toBe('Jetzt starten');
  });

  it('disables generation when the default locale has no source content', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue(aiConfig as never);
    // No EN localization → nothing to translate from
    vi.mocked(getSectionLocalizations).mockResolvedValue([]);

    const user = userEvent.setup();
    renderWithProviders(<SectionEditorDialog open section={mockSection} onClose={vi.fn()} />);

    const deTab = await screen.findByText('DE');
    await user.click(deTab);

    const suggestButton = await screen.findByTestId('section-editor.btn.suggest-translation');
    await user.click(suggestButton);

    const generateButton = await screen.findByTestId('section-translate-dialog.btn.generate');
    expect(generateButton).toBeDisabled();
  });
});
