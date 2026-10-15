import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import type { ContentTemplate, SiteLocaleResponse } from '@/types/api';
import { createBlog, createBlogLocalization } from '@/services/blogs';
import CreateBlogWizard from '../CreateBlogWizard';

const aiAssist = {
  isConfigured: false,
  isGenerating: false,
  generate: vi.fn(),
};
vi.mock('@/hooks/useAiAssist', () => ({ useAiAssist: () => aiAssist }));
vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
}));

const siteLocales = [
  { locale_id: 'loc-en', code: 'en', name: 'English', is_default: true },
] as unknown as SiteLocaleResponse[];

const customTemplate = {
  id: 'ct-1',
  name: 'Weekly Digest',
  description: 'Recurring summary',
  icon: 'Star',
  slug_prefix: 'digest',
  is_active: true,
  is_featured: true,
  allow_comments: false,
  title: 'Digest title',
  subtitle: 'Digest subtitle',
  excerpt: 'Digest excerpt',
  body: '## Digest body',
  meta_title: 'Digest meta',
  meta_description: 'Digest meta description',
} as unknown as ContentTemplate;

function renderWizard(overrides: Partial<React.ComponentProps<typeof CreateBlogWizard>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    siteLocales,
    siteTemplates: [] as ContentTemplate[],
    siteTemplatesLoading: false,
    ...overrides,
  };
  renderWithProviders(<CreateBlogWizard {...props} />);
  return props;
}

describe('CreateBlogWizard', () => {
  beforeEach(() => {
    aiAssist.isConfigured = false;
    aiAssist.isGenerating = false;
    aiAssist.generate.mockReset();
    vi.mocked(createBlog).mockReset().mockResolvedValue({ id: 'blog-1' } as never);
    vi.mocked(createBlogLocalization).mockReset().mockResolvedValue({} as never);
  });

  it('creates a blog from scratch with the slug synced from the title', async () => {
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(screen.getByText('From Scratch'));
    await user.type(screen.getByTestId('create-blog-wizard.input.title').querySelector('input')!, 'Hello World');
    expect(screen.getByTestId('create-blog-wizard.input.slug').querySelector('input')).toHaveValue('hello-world');

    await user.click(screen.getByTestId('create-blog-wizard.btn.create'));

    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith('blog-1'));
    expect(vi.mocked(createBlog).mock.calls[0][0]).toMatchObject({
      slug: 'hello-world',
      title: 'Hello World',
      author: 'Test User',
      status: 'Draft',
      site_ids: ['site-1'],
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('goes back to the method step from the details step', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByText('From Scratch'));
    expect(screen.getByTestId('create-blog-wizard.input.title')).toBeInTheDocument();

    await user.click(screen.getByTestId('create-blog-wizard.btn.back'));
    expect(screen.queryByTestId('create-blog-wizard.input.title')).not.toBeInTheDocument();
    expect(screen.getByText('From Template')).toBeInTheDocument();
  });

  it('creates a blog from a custom template and seeds the default localization', async () => {
    const user = userEvent.setup();
    const props = renderWizard({ siteTemplates: [customTemplate] });

    await user.click(screen.getByText('From Template'));
    expect(screen.getByRole('button', { name: 'Manage Templates' })).toBeInTheDocument();
    const useTemplate = screen.getByRole('button', { name: 'Use Template' });
    expect(useTemplate).toBeDisabled();

    // 4 built-ins + 1 custom => 2 pages of 4
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/search/i), 'digest');
    await user.click(screen.getByText('Weekly Digest'));
    await user.click(useTemplate);

    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith('blog-1'));
    expect(vi.mocked(createBlog).mock.calls[0][0]).toMatchObject({ is_featured: true, allow_comments: false });
    expect(vi.mocked(createBlog).mock.calls[0][0].slug).toMatch(/^digest-\d+$/);
    expect(createBlogLocalization).toHaveBeenCalledWith('blog-1', expect.objectContaining({
      locale_id: 'loc-en',
      title: 'Digest title',
      body: '## Digest body',
    }));
  });

  it('imports a markdown file, previews it, and returns to upload on back', async () => {
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(screen.getByText('Import Markdown'));
    const file = new File(['# Imported Post\n\nSome body text.'], 'post.md', { type: 'text/markdown' });
    await user.upload(screen.getByLabelText('Select file'), file);

    const titleInput = await screen.findByLabelText('Title');
    expect(titleInput).toHaveValue('Imported Post');

    await user.click(screen.getByTestId('create-blog-wizard.btn.back'));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByText('post.md (0.0 KB)')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Select file'), file);
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith('blog-1'));
    expect(vi.mocked(createBlog).mock.calls[0][0].slug).toMatch(/^imported-post-\d+$/);
    expect(createBlogLocalization).toHaveBeenCalledWith('blog-1', expect.objectContaining({ title: 'Imported Post' }));
  });

  it('shows an error for a non-markdown file', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWizard();

    await user.click(screen.getByText('Import Markdown'));
    await user.upload(screen.getByLabelText('Select file'), new File(['x'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByText('Only .md and .markdown files are accepted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('walks the AI flow idea -> outline -> post and creates the blog', async () => {
    aiAssist.isConfigured = true;
    aiAssist.generate
      .mockResolvedValueOnce({ title: 'AI Title', subtitle: 'AI Sub', outline: ['Intro', 'Wrap-up'] })
      .mockResolvedValueOnce({ body: 'AI body', excerpt: 'AI excerpt', meta_title: 'AI meta', meta_description: 'AI desc' });
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(screen.getByText('AI Assist'));
    const generateOutline = screen.getByRole('button', { name: 'Generate Outline' });
    expect(generateOutline).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/Describe your blog post idea/), 'A post about testing');
    await user.click(generateOutline);

    expect(aiAssist.generate).toHaveBeenCalledWith('draft_outline', 'A post about testing', 'en');
    expect(await screen.findByDisplayValue('AI Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Intro')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate Post' }));
    expect(aiAssist.generate).toHaveBeenLastCalledWith(
      'draft_post',
      JSON.stringify({ title: 'AI Title', subtitle: 'AI Sub', outline: ['Intro', 'Wrap-up'] }),
      'en',
    );
    expect(await screen.findByDisplayValue('AI body')).toBeInTheDocument();

    // Back from post returns to the outline phase, forward again via Generate Post
    await user.click(screen.getByTestId('create-blog-wizard.btn.back'));
    expect(screen.getByRole('button', { name: 'Generate Post' })).toBeInTheDocument();
    aiAssist.generate.mockResolvedValueOnce({ body: 'AI body', excerpt: 'AI excerpt', meta_title: 'AI meta', meta_description: 'AI desc' });
    await user.click(screen.getByRole('button', { name: 'Generate Post' }));
    await screen.findByDisplayValue('AI body');

    await user.click(screen.getByRole('button', { name: 'Create Blog' }));
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith('blog-1'));
    expect(vi.mocked(createBlog).mock.calls[0][0].slug).toBe('ai-title');
    expect(createBlogLocalization).toHaveBeenCalledWith('blog-1', expect.objectContaining({
      title: 'AI Title',
      subtitle: 'AI Sub',
      body: 'AI body',
      excerpt: 'AI excerpt',
      meta_title: 'AI meta',
      meta_description: 'AI desc',
    }));
  });

  it('surfaces an AI outline failure as an error alert', async () => {
    aiAssist.isConfigured = true;
    aiAssist.generate.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByText('AI Assist'));
    await user.type(screen.getByPlaceholderText(/Describe your blog post idea/), 'idea');
    await user.click(screen.getByRole('button', { name: 'Generate Outline' }));

    expect(await screen.findByText('Failed to generate outline. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Outline' })).toBeInTheDocument();
  });
});
