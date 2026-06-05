import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import { useForm } from 'react-hook-form';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: {
      id: 'site-1',
      name: 'Test Site',
      slug: 'test-site',
      base_url: 'https://example.com',
      timezone: 'UTC',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import PageSeoTab from '../PageSeoTab';
import { pageDetailSchema, type PageDetailFormData } from '../pageDetailSchema';
import { formResolver } from '@/utils/validation';
import type { SectionLocalizationResponse } from '@/types/api';

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
interface WrapperProps {
  defaultValues?: Partial<PageDetailFormData>;
  route?: string;
  onSnapshot?: () => void;
  sectionLocalizations?: SectionLocalizationResponse[];
  activeLocales?: { id: string; code: string }[];
}

function SeoTabWrapper({
  defaultValues = {},
  route = '/about',
  onSnapshot = vi.fn(),
  sectionLocalizations,
  activeLocales = [{ id: 'locale-1', code: 'en' }],
}: WrapperProps) {
  const { control, watch, setValue } = useForm<PageDetailFormData>({
    resolver: formResolver(pageDetailSchema),
    defaultValues: {
      route: '/about',
      slug: 'about',
      page_type: 'Static',
      template: '',
      status: 'Draft',
      is_in_navigation: false,
      navigation_order: '',
      parent_page_id: '',
      publish_start: null,
      publish_end: null,
      meta_title: '',
      meta_description: '',
      excerpt: '',
      ...defaultValues,
    },
  });

  return (
    <PageSeoTab
      control={control}
      watch={watch}
      setValue={setValue}
      onSnapshot={onSnapshot}
      route={route}
      pageId="page-1"
      activeLocales={activeLocales}
      sectionLocalizations={sectionLocalizations}
    />
  );
}

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

beforeEach(() => {
  vi.clearAllMocks();
  moduleState.ai = false;
  vi.mocked(getAiConfig).mockReset();
});

describe('PageSeoTab', () => {
  it('renders all SEO fields', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByLabelText('Meta Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Meta Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Excerpt')).toBeInTheDocument();
  });

  it('renders SERP preview', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByText('Search Engine Preview')).toBeInTheDocument();
  });

  it('renders Social card preview', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByTestId('social-preview-title')).toBeInTheDocument();
    expect(screen.getByTestId('social-preview-description')).toBeInTheDocument();
    expect(screen.getByTestId('social-preview-domain')).toBeInTheDocument();
  });

  it('shows character counters for each field', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByText('0/60')).toBeInTheDocument();
    expect(screen.getByText('0/160')).toBeInTheDocument();
    expect(screen.getByText('0/300')).toBeInTheDocument();
  });

  it('displays populated values', () => {
    renderWithProviders(
      <SeoTabWrapper
        defaultValues={{
          meta_title: 'My Page Title',
          meta_description: 'A description of my page',
          excerpt: 'Page excerpt here',
        }}
      />,
    );

    expect(screen.getByDisplayValue('My Page Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A description of my page')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Page excerpt here')).toBeInTheDocument();
  });

  it('updates character counter on input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SeoTabWrapper />);

    const metaTitleInput = screen.getByLabelText('Meta Title');
    await user.type(metaTitleInput, 'Hello');

    expect(screen.getByText('5/60')).toBeInTheDocument();
  });

  it('calls onSnapshot on field blur', async () => {
    const onSnapshot = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SeoTabWrapper onSnapshot={onSnapshot} />);

    const metaTitleInput = screen.getByLabelText('Meta Title');
    await user.click(metaTitleInput);
    await user.tab();

    expect(onSnapshot).toHaveBeenCalled();
  });

  it('shows page route in SERP preview URL', () => {
    renderWithProviders(<SeoTabWrapper route="/contact-us" />);

    expect(screen.getByText('example.com/contact-us')).toBeInTheDocument();
  });

  it('uses meta title in SERP preview when provided', () => {
    renderWithProviders(
      <SeoTabWrapper defaultValues={{ meta_title: 'Custom SEO Title' }} />,
    );

    // Appears in both SERP and Social previews
    expect(screen.getAllByText('Custom SEO Title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('social-preview-title').textContent).toBe('Custom SEO Title');
  });
});

describe('PageSeoTab — AI buttons (closes #76)', () => {
  const longSectionLocalizations: SectionLocalizationResponse[] = [
    {
      id: 'loc-en-hero',
      page_section_id: 'section-hero',
      locale_id: 'locale-1',
      title: 'A bold pricing promise',
      text: 'We charge for usage and nothing else. No seats, no contracts, no hidden fees. '
        + 'You can cancel any time and your data stays yours forever.',
      button_text: 'Start free trial',
    },
    {
      id: 'loc-en-features',
      page_section_id: 'section-features',
      locale_id: 'locale-1',
      title: 'Built for fast teams',
      text: 'Provision a workspace in under a minute, invite teammates by email, and get to work.',
      button_text: undefined,
    },
  ];

  it('hides Generate buttons when the AI module is disabled', () => {
    moduleState.ai = false;

    renderWithProviders(
      <SeoTabWrapper sectionLocalizations={longSectionLocalizations} />,
    );

    expect(screen.queryByTestId('page-seo.btn.generate-seo')).toBeNull();
    expect(screen.queryByTestId('page-seo.btn.generate-excerpt')).toBeNull();
  });

  it('disables Generate buttons when no section content is available', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue(aiConfig as never);

    renderWithProviders(<SeoTabWrapper sectionLocalizations={[]} />);

    const seoBtn = await screen.findByTestId('page-seo.btn.generate-seo');
    const exBtn = await screen.findByTestId('page-seo.btn.generate-excerpt');
    expect(seoBtn).toBeDisabled();
    expect(exBtn).toBeDisabled();
  });

  it('populates meta_title and meta_description from section content', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue(aiConfig as never);
    vi.mocked(generateAiContent).mockResolvedValue({
      meta_title: 'Usage-based pricing for teams',
      meta_description: 'Pay for what you use. Cancel any time. Get a workspace up in under a minute.',
    });

    const user = userEvent.setup();
    renderWithProviders(
      <SeoTabWrapper sectionLocalizations={longSectionLocalizations} />,
    );

    const btn = await screen.findByTestId('page-seo.btn.generate-seo');
    await waitFor(() => expect(btn).not.toBeDisabled());
    await user.click(btn);

    await waitFor(() => {
      expect(generateAiContent).toHaveBeenCalledWith('site-1', expect.objectContaining({
        action: 'seo',
      }));
    });
    const payload = vi.mocked(generateAiContent).mock.calls.at(-1)?.[1];
    expect(payload?.content).toContain('A bold pricing promise');
    expect(payload?.content).toContain('Built for fast teams');

    await waitFor(() => {
      const metaTitleInput = screen.getByLabelText('Meta Title') as HTMLInputElement;
      expect(metaTitleInput.value).toBe('Usage-based pricing for teams');
    });
    const metaDescInput = screen.getByLabelText('Meta Description') as HTMLInputElement;
    expect(metaDescInput.value).toBe('Pay for what you use. Cancel any time. Get a workspace up in under a minute.');
  });

  it('populates excerpt from section content', async () => {
    moduleState.ai = true;
    vi.mocked(getAiConfig).mockResolvedValue(aiConfig as never);
    vi.mocked(generateAiContent).mockResolvedValue({
      excerpt: 'A short summary of the page.',
    });

    const user = userEvent.setup();
    renderWithProviders(
      <SeoTabWrapper sectionLocalizations={longSectionLocalizations} />,
    );

    const btn = await screen.findByTestId('page-seo.btn.generate-excerpt');
    await waitFor(() => expect(btn).not.toBeDisabled());
    await user.click(btn);

    await waitFor(() => {
      const excerptInput = screen.getByLabelText('Excerpt') as HTMLInputElement;
      expect(excerptInput.value).toBe('A short summary of the page.');
    });
  });
});
