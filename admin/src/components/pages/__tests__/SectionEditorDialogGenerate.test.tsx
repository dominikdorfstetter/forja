import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import type {
  PageSectionResponse,
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

// useSiteContextData is consulted by useAiAssist for the ai-module toggle.
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
  moduleState.ai = false;
  vi.mocked(getSiteLocales).mockResolvedValue(mockLocales);
  vi.mocked(getSectionLocalizations).mockResolvedValue([]);
  vi.mocked(getAiConfig).mockReset();
  const mod = await import('../SectionEditorDialog');
  SectionEditorDialog = mod.default;
});

describe('SectionEditorDialog — AI Generate Content', () => {
  it('hides the Generate Content button when the AI module is disabled', async () => {
    moduleState.ai = false;

    renderWithProviders(<SectionEditorDialog open section={mockSection} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('EN')).toBeInTheDocument());
    expect(screen.queryByTestId('section-editor.btn.generate-content')).toBeNull();
  });

  it('hides the Generate Content button when the AI module is on but unconfigured', async () => {
    moduleState.ai = true;
    // No config saved for the site → getAiConfig resolves to null
    vi.mocked(getAiConfig).mockResolvedValue(null as never);

    renderWithProviders(<SectionEditorDialog open section={mockSection} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('EN')).toBeInTheDocument());
    expect(screen.queryByTestId('section-editor.btn.generate-content')).toBeNull();
  });

  it('renders Generate Content when AI is configured and populates fields on success', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue({
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
    } as never);

    const aiResult: AiGenerateResponse = {
      title: 'Pricing built for teams',
      text: 'Pay only for what you use. No surprises, no lock-in.',
      button_text: 'Start free trial',
    };
    vi.mocked(generateAiContent).mockResolvedValue(aiResult);

    renderWithProviders(
      <SectionEditorDialog
        open
        section={mockSection}
        onClose={vi.fn()}
        pageContext={{ route: '/pricing', existingSectionTypes: ['Features'] }}
      />,
    );

    const button = await screen.findByTestId('section-editor.btn.generate-content');
    await userEvent.setup().click(button);

    await waitFor(() => {
      expect(generateAiContent).toHaveBeenCalledWith('site-1', expect.objectContaining({
        action: 'section_content',
        section_context: expect.objectContaining({
          section_type: 'Hero',
          page_route: '/pricing',
          existing_section_types: ['Features'],
        }),
      }));
    });

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Pricing built for teams');
    });

    const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('Pay only for what you use. No surprises, no lock-in.');

    const buttonTextInput = screen.getByLabelText(/button text/i) as HTMLInputElement;
    expect(buttonTextInput.value).toBe('Start free trial');
  });
});
