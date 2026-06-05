import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import { generateAiContent, getAiConfig } from '@/services/ai';
import { assignTagToContent, createTag, getTags } from '@/services/taxonomy';
import type { Tag } from '@/types/api';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: {
      id: 'site-1',
      name: 'Test Site',
      slug: 'test-site',
      created_at: '',
      updated_at: '',
    },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    modules: {
      blog: true,
      pages: true,
      portfolio: false,
      legal: false,
      documents: false,
      ai: true,
      forms: false,
    },
    context: {
      modules: {
        blog: true,
        pages: true,
        portfolio: false,
        legal: false,
        documents: false,
        ai: true,
        forms: false,
      },
    },
  }),
}));

// Import after mocks so the component picks up the mocked hooks.
import BlogTagCard from '../BlogTagCard';

const tagOne: Tag = {
  id: 'tag-1',
  slug: 'rust',
  is_global: false,
  created_at: '2026-01-01T00:00:00Z',
};

const longBody =
  'Axum is an async web framework for Rust built on top of Tower. ' +
  'This post walks through routing, extractors, error handling, and how to ' +
  'compose middleware so you can ship production-grade web servers without ' +
  'wrestling with the underlying I/O machinery. We will cover tracing as well.';

function configureAiAvailable() {
  vi.mocked(getAiConfig).mockResolvedValue({
    id: 'cfg-1',
    site_id: 'site-1',
    provider_name: 'openai',
    base_url: 'https://api.openai.com/v1',
    api_key_masked: 'sk-****',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1024,
    system_prompts: {},
    task_configs: {},
    updated_at: '2026-05-01T00:00:00Z',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTags).mockResolvedValue({
    data: [tagOne],
    meta: { page: 1, page_size: 50, total_items: 1, total_pages: 1 },
  });
});

describe('BlogTagCard — AI Suggest', () => {
  it('hides the Suggest button when aiAvailable is false', () => {
    configureAiAvailable();
    renderWithProviders(
      <BlogTagCard
        contentId="content-1"
        tags={[]}
        blogBody={longBody}
        aiAvailable={false}
      />,
    );
    expect(
      screen.queryByTestId('blog-tag-card.btn.suggest'),
    ).not.toBeInTheDocument();
  });

  it('hides the Suggest button when AI is available but unconfigured', () => {
    vi.mocked(getAiConfig).mockRejectedValue(
      new Error('AI not configured'),
    );
    renderWithProviders(
      <BlogTagCard
        contentId="content-1"
        tags={[]}
        blogBody={longBody}
        aiAvailable
      />,
    );
    expect(
      screen.queryByTestId('blog-tag-card.btn.suggest'),
    ).not.toBeInTheDocument();
  });

  it('disables the Suggest button when the blog body is too short', async () => {
    configureAiAvailable();
    renderWithProviders(
      <BlogTagCard
        contentId="content-1"
        tags={[]}
        blogBody="too short"
        aiAvailable
      />,
    );
    const btn = await screen.findByTestId('blog-tag-card.btn.suggest');
    expect(btn).toBeDisabled();
  });

  it('fetches AI suggestions and lets the user apply a subset', async () => {
    configureAiAvailable();
    vi.mocked(generateAiContent).mockResolvedValue({
      tags: ['rust', 'axum', 'web-development'],
    });
    vi.mocked(createTag).mockResolvedValue({
      id: 'tag-new',
      slug: 'axum',
      is_global: false,
      created_at: '2026-05-14T00:00:00Z',
    });
    vi.mocked(assignTagToContent).mockResolvedValue(undefined);

    renderWithProviders(
      <BlogTagCard
        contentId="content-1"
        tags={[]}
        blogBody={longBody}
        aiAvailable
      />,
    );

    await userEvent.click(await screen.findByTestId('blog-tag-card.btn.suggest'));

    const chipRust = await screen.findByTestId('blog-tag-suggest.chip.rust');
    const chipAxum = await screen.findByTestId('blog-tag-suggest.chip.axum');
    expect(
      await screen.findByTestId('blog-tag-suggest.chip.web-development'),
    ).toBeInTheDocument();

    // The existing 'rust' tag appears unprefixed; new ones get a leading "+".
    expect(chipRust).toHaveTextContent(/^rust$/);
    expect(chipAxum).toHaveTextContent(/^\+ axum$/);

    await userEvent.click(chipAxum);
    const applyBtn = screen.getByTestId('blog-tag-suggest.btn.apply');
    expect(applyBtn).not.toBeDisabled();

    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'axum' }),
      );
      expect(assignTagToContent).toHaveBeenCalledWith('content-1', {
        tag_id: 'tag-new',
      });
    });

    expect(generateAiContent).toHaveBeenCalledWith(
      'site-1',
      expect.objectContaining({
        action: 'blog_tags',
        content: longBody,
        blog_tag_context: { existing_tags: ['rust'] },
      }),
    );
  });

  it('reuses an existing tag rather than creating a duplicate', async () => {
    configureAiAvailable();
    vi.mocked(generateAiContent).mockResolvedValue({
      tags: ['rust'],
    });
    vi.mocked(assignTagToContent).mockResolvedValue(undefined);

    renderWithProviders(
      <BlogTagCard
        contentId="content-1"
        tags={[]}
        blogBody={longBody}
        aiAvailable
      />,
    );

    await userEvent.click(await screen.findByTestId('blog-tag-card.btn.suggest'));
    await userEvent.click(await screen.findByTestId('blog-tag-suggest.chip.rust'));
    await userEvent.click(screen.getByTestId('blog-tag-suggest.btn.apply'));

    await waitFor(() => {
      expect(assignTagToContent).toHaveBeenCalledWith('content-1', {
        tag_id: 'tag-1',
      });
    });
    expect(createTag).not.toHaveBeenCalled();
  });
});
