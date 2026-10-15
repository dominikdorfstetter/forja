import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import BlogWizardAiStep from '../BlogWizardAiStep';

const defaultProps = {
  aiPhase: 'idea' as const,
  aiIdea: '',
  aiTitle: '',
  aiSubtitle: '',
  aiOutline: [],
  aiBody: '',
  aiExcerpt: '',
  aiMetaTitle: '',
  aiMetaDescription: '',
  aiError: null,
  isGenerating: false,
  isCreating: false,
  regeneratingField: null,
  onIdeaChange: vi.fn(),
  onTitleChange: vi.fn(),
  onSubtitleChange: vi.fn(),
  onOutlineChange: vi.fn(),
  onBodyChange: vi.fn(),
  onExcerptChange: vi.fn(),
  onMetaTitleChange: vi.fn(),
  onMetaDescriptionChange: vi.fn(),
  onErrorDismiss: vi.fn(),
  onAddOutlineItem: vi.fn(),
  onInsertOutlineItem: vi.fn(),
  onRegenerateOutline: vi.fn(),
  onRegenerate: vi.fn(),
};

describe('BlogWizardAiStep', () => {
  describe('language notice', () => {
    it('shows language notice when defaultLocaleName is provided in idea phase', () => {
      renderWithProviders(
        <BlogWizardAiStep {...defaultProps} defaultLocaleName="English" />,
      );
      expect(screen.getByTestId('ai-language-notice')).toBeInTheDocument();
      expect(screen.getByTestId('ai-language-notice')).toHaveTextContent('English');
    });

    it('does not show language notice when defaultLocaleName is not provided', () => {
      renderWithProviders(<BlogWizardAiStep {...defaultProps} />);
      expect(screen.queryByTestId('ai-language-notice')).not.toBeInTheDocument();
    });

    it('does not show language notice in outline phase', () => {
      renderWithProviders(
        <BlogWizardAiStep
          {...defaultProps}
          aiPhase="outline"
          aiTitle="Title"
          aiOutline={[{ id: 1, value: 'Point 1' }]}
          defaultLocaleName="German"
        />,
      );
      expect(screen.queryByTestId('ai-language-notice')).not.toBeInTheDocument();
    });
  });

  describe('outline editing', () => {
    const outlineProps = {
      ...defaultProps,
      aiPhase: 'outline' as const,
      aiTitle: 'Test Title',
      aiSubtitle: 'Test Subtitle',
      aiOutline: [
        { id: 1, value: 'Point 1' },
        { id: 2, value: 'Point 2' },
        { id: 3, value: 'Point 3' },
      ],
    };

    it('renders insert buttons for each outline item', () => {
      renderWithProviders(<BlogWizardAiStep {...outlineProps} />);
      expect(screen.getByTestId('outline-insert-0')).toBeInTheDocument();
      expect(screen.getByTestId('outline-insert-1')).toBeInTheDocument();
      expect(screen.getByTestId('outline-insert-2')).toBeInTheDocument();
    });

    it('calls onInsertOutlineItem with correct index when insert button clicked', async () => {
      const onInsert = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <BlogWizardAiStep {...outlineProps} onInsertOutlineItem={onInsert} />,
      );
      await user.click(screen.getByTestId('outline-insert-1'));
      expect(onInsert).toHaveBeenCalledWith(1);
    });

    it('renders regenerate outline button', () => {
      renderWithProviders(<BlogWizardAiStep {...outlineProps} />);
      expect(screen.getByTestId('regenerate-outline-btn')).toBeInTheDocument();
    });

    it('calls onRegenerateOutline when regenerate button clicked', async () => {
      const onRegen = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <BlogWizardAiStep {...outlineProps} onRegenerateOutline={onRegen} />,
      );
      await user.click(screen.getByTestId('regenerate-outline-btn'));
      expect(onRegen).toHaveBeenCalled();
    });

    it('updates and removes outline items', async () => {
      const onOutlineChange = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <BlogWizardAiStep {...outlineProps} onOutlineChange={onOutlineChange} />,
      );
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
      expect(onOutlineChange).toHaveBeenLastCalledWith([
        { id: 1, value: 'Point 1' },
        { id: 3, value: 'Point 3' },
      ]);
    });

    it('disables insert and regenerate buttons when generating', () => {
      renderWithProviders(
        <BlogWizardAiStep {...outlineProps} isGenerating={true} />,
      );
      expect(screen.getByTestId('outline-insert-0')).toBeDisabled();
      expect(screen.getByTestId('regenerate-outline-btn')).toBeDisabled();
    });
  });
});

describe('BlogWizardAiStep post phase', () => {
  const postProps = {
    ...defaultProps,
    aiPhase: 'post' as const,
    aiTitle: 'Post Title',
    aiBody: 'Body',
    aiExcerpt: 'Excerpt',
    aiMetaTitle: 'Meta',
    aiMetaDescription: 'Meta description',
  };

  const field = (value: string) => screen.getByDisplayValue(value);

  it('enables every field and regenerate control when idle', () => {
    renderWithProviders(<BlogWizardAiStep {...postProps} />);
    for (const value of ['Post Title', 'Body', 'Excerpt', 'Meta', 'Meta description']) {
      expect(field(value)).toBeEnabled();
    }
    for (const button of screen.getAllByRole('button', { name: 'Regenerate' })) {
      expect(button).toBeEnabled();
    }
    expect(screen.getByRole('button', { name: 'Regenerate All' })).toBeEnabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('keeps unrelated fields editable while one section regenerates', () => {
    renderWithProviders(<BlogWizardAiStep {...postProps} regeneratingField="seo" />);
    expect(field('Post Title')).toBeDisabled();
    expect(field('Body')).toBeEnabled();
    expect(field('Excerpt')).toBeEnabled();
    expect(field('Meta')).toBeDisabled();
    expect(field('Meta description')).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: 'Regenerate' })) {
      expect(button).toBeDisabled();
    }
  });

  it('locks body while excerpt regenerates and seo stays editable while body regenerates', () => {
    const { unmount } = renderWithProviders(<BlogWizardAiStep {...postProps} regeneratingField="excerpt" />);
    expect(field('Body')).toBeEnabled();
    expect(field('Excerpt')).toBeDisabled();
    expect(field('Meta')).toBeEnabled();
    unmount();

    renderWithProviders(<BlogWizardAiStep {...postProps} regeneratingField="body" />);
    expect(field('Body')).toBeDisabled();
    expect(field('Excerpt')).toBeEnabled();
    expect(field('Meta')).toBeEnabled();
  });

  it('shows a progress bar and disables everything while regenerating all', () => {
    renderWithProviders(<BlogWizardAiStep {...postProps} regeneratingField="all" />);
    // linear bar on top + spinner inside the Regenerate All button
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    for (const value of ['Post Title', 'Body', 'Excerpt', 'Meta', 'Meta description']) {
      expect(field(value)).toBeDisabled();
    }
  });

  it('requests regeneration for the clicked section', async () => {
    const onRegenerate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<BlogWizardAiStep {...postProps} onRegenerate={onRegenerate} />);
    const [body, excerpt, seo] = screen.getAllByRole('button', { name: 'Regenerate' });
    await user.click(body);
    await user.click(excerpt);
    await user.click(seo);
    await user.click(screen.getByRole('button', { name: 'Regenerate All' }));
    expect(onRegenerate.mock.calls.map(([f]) => f)).toEqual(['body', 'excerpt', 'seo', 'all']);
  });
});
