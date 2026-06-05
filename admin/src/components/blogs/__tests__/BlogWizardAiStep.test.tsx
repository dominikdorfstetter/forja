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

    it('disables insert and regenerate buttons when generating', () => {
      renderWithProviders(
        <BlogWizardAiStep {...outlineProps} isGenerating={true} />,
      );
      expect(screen.getByTestId('outline-insert-0')).toBeDisabled();
      expect(screen.getByTestId('regenerate-outline-btn')).toBeDisabled();
    });
  });
});
