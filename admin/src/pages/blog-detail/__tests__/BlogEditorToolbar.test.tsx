import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import BlogEditorToolbar from '../BlogEditorToolbar';
import { blogContentSchema, type BlogContentFormData } from '../blogDetailSchema';
import type { AutosaveStatus } from '@/hooks/useAutosave';

// Mock @mui/x-date-pickers to avoid ESM resolution issues
vi.mock('@mui/x-date-pickers/DateTimePicker', () => ({
  DateTimePicker: ({ label }: { label: string }) => <input aria-label={label} />,
}));

interface WrapperProps {
  canWrite?: boolean;
  autosaveStatus?: AutosaveStatus;
  onSave?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canSubmitForReview?: boolean;
  canApprove?: boolean;
  canRequestChanges?: boolean;
  onSubmitForReview?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  defaultStatus?: BlogContentFormData['status'];
}

function ToolbarWrapper({
  canWrite = true,
  autosaveStatus = 'idle',
  onSave = vi.fn(),
  canUndo = true,
  canRedo = true,
  onUndo = vi.fn(),
  onRedo = vi.fn(),
  canSubmitForReview,
  canApprove,
  canRequestChanges,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  defaultStatus = 'Draft',
}: WrapperProps) {
  const methods = useForm<BlogContentFormData>({
    resolver: zodResolver(blogContentSchema),
    defaultValues: {
      title: 'Test Blog',
      subtitle: '',
      excerpt: '',
      body: '',
      meta_title: '',
      meta_description: '',
      author: 'Test Author',
      published_date: '2025-01-01',
      status: defaultStatus,
      is_featured: false,
      allow_comments: true,
      reading_time_override: false,
      publish_start: null,
      publish_end: null,
    },
  });

  return (
    <FormProvider {...methods}>
      <BlogEditorToolbar
        control={methods.control}
        watch={methods.watch}
        setValue={methods.setValue}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        autosaveStatus={autosaveStatus}
        onSave={onSave}
        onToggleHistory={vi.fn()}
        isSaving={false}
        canWrite={canWrite}
        canSubmitForReview={canSubmitForReview}
        canApprove={canApprove}
        canRequestChanges={canRequestChanges}
        onSubmitForReview={onSubmitForReview}
        onApprove={onApprove}
        onRequestChanges={onRequestChanges}
      />
    </FormProvider>
  );
}

describe('BlogEditorToolbar', () => {
  it('renders status select with Draft value', () => {
    renderWithProviders(<ToolbarWrapper />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders undo/redo buttons', () => {
    renderWithProviders(<ToolbarWrapper />);
    const undoBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('[data-testid="UndoIcon"]'),
    );
    const redoBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('[data-testid="RedoIcon"]'),
    );
    expect(undoBtn).toBeDefined();
    expect(redoBtn).toBeDefined();
  });

  it('calls onSave on save click', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(<ToolbarWrapper onSave={onSave} />);
    const saveBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('[data-testid="SaveIcon"]'),
    );
    expect(saveBtn).toBeDefined();
    await user.click(saveBtn!);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('disables controls when canWrite=false', () => {
    renderWithProviders(<ToolbarWrapper canWrite={false} />);
    const saveBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('[data-testid="SaveIcon"]'),
    );
    expect(saveBtn).toBeDisabled();
  });

  it('shows autosave saving chip', () => {
    renderWithProviders(<ToolbarWrapper autosaveStatus="saving" />);
    // The chip for "saving" should be rendered (i18n key: blogDetail.toolbar.saving)
    const chips = document.querySelectorAll('.MuiChip-root');
    expect(chips.length).toBeGreaterThan(0);
  });

  it('shows autosave saved chip', () => {
    renderWithProviders(<ToolbarWrapper autosaveStatus="saved" />);
    const chips = document.querySelectorAll('.MuiChip-root');
    expect(chips.length).toBeGreaterThan(0);
  });

  it('shows autosave error chip', () => {
    renderWithProviders(<ToolbarWrapper autosaveStatus="error" />);
    const chips = document.querySelectorAll('.MuiChip-root');
    expect(chips.length).toBeGreaterThan(0);
  });

  it('shows workflow submit button when canSubmitForReview is true and status is Draft', () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ToolbarWrapper
        canSubmitForReview
        onSubmitForReview={onSubmit}
        defaultStatus="Draft"
      />,
    );
    const submitBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('[data-testid="SendIcon"]'),
    );
    expect(submitBtn).toBeDefined();
  });

  it('shows approve button when canApprove and status is InReview', () => {
    const onApprove = vi.fn();
    renderWithProviders(
      <ToolbarWrapper
        canApprove
        onApprove={onApprove}
        defaultStatus="InReview"
      />,
    );
    const approveBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('[data-testid="CheckCircleIcon"]'),
    );
    expect(approveBtn).toBeDefined();
  });
});
