import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { useForm, FormProvider } from 'react-hook-form';
import BlogEditorToolbar from '../BlogEditorToolbar';
import { blogContentSchema, type BlogContentFormData } from '../blogDetailSchema';
import { formResolver } from '@/utils/validation';

// Mock @mui/x-date-pickers to avoid ESM resolution issues
vi.mock('@mui/x-date-pickers/DateTimePicker', () => ({
  DateTimePicker: ({ label }: { label: string }) => <input aria-label={label} />,
}));

interface WrapperProps {
  canWrite?: boolean;
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
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

function ToolbarWrapper({
  canWrite = true,
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
  sidebarOpen = true,
  onToggleSidebar = vi.fn(),
}: WrapperProps) {
  const methods = useForm<BlogContentFormData>({
    resolver: formResolver(blogContentSchema),
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
        onToggleHistory={vi.fn()}
        isSaving={false}
        canWrite={canWrite}
        canSubmitForReview={canSubmitForReview}
        canApprove={canApprove}
        canRequestChanges={canRequestChanges}
        onSubmitForReview={onSubmitForReview}
        onApprove={onApprove}
        onRequestChanges={onRequestChanges}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />
    </FormProvider>
  );
}

// Shared finders. M3Button renders a native <button>; M3IconButton exposes
// an aria-label derived from its tooltip prop. Tests locate by accessible
// name to avoid coupling to SVG testids that no longer exist.
const buttonByLabelRegex = (re: RegExp) =>
  screen.getAllByRole('button').find((b) => re.test(b.getAttribute('aria-label') || ''));

const buttonByText = (text: string) =>
  screen.getAllByRole('button').find((b) => b.textContent?.includes(text));

describe('BlogEditorToolbar', () => {
  it('renders status select with Draft value', () => {
    renderWithProviders(<ToolbarWrapper />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders undo/redo buttons', () => {
    renderWithProviders(<ToolbarWrapper />);
    expect(buttonByLabelRegex(/undo/i)).toBeDefined();
    expect(buttonByLabelRegex(/redo/i)).toBeDefined();
  });

  it('does not render its own Save button — the global save bar owns Save (#46)', () => {
    renderWithProviders(<ToolbarWrapper />);
    expect(screen.queryByTestId('save-post')).toBeNull();
  });

  it('still renders status + edit tools (without a Save button) when canWrite=false', () => {
    renderWithProviders(<ToolbarWrapper canWrite={false} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByTestId('save-post')).toBeNull();
  });

  it('shows workflow submit button when canSubmitForReview is true and status is Draft', () => {
    renderWithProviders(
      <ToolbarWrapper canSubmitForReview onSubmitForReview={vi.fn()} defaultStatus="Draft" />,
    );
    expect(buttonByText('Submit for Review') || buttonByText('Zur Prüfung')).toBeDefined();
  });

  it('renders sidebar toggle button', () => {
    renderWithProviders(<ToolbarWrapper />);
    expect(buttonByLabelRegex(/sidebar|seitenleiste/i)).toBeDefined();
  });

  it('calls onToggleSidebar when sidebar button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleSidebar = vi.fn();
    renderWithProviders(<ToolbarWrapper onToggleSidebar={onToggleSidebar} />);
    const sidebarBtn = buttonByLabelRegex(/sidebar|seitenleiste/i);
    expect(sidebarBtn).toBeDefined();
    await user.click(sidebarBtn!);
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it('shows approve button when canApprove and status is InReview', () => {
    renderWithProviders(
      <ToolbarWrapper canApprove onApprove={vi.fn()} defaultStatus="InReview" />,
    );
    expect(
      buttonByText('workflow.approve') ||
        buttonByText('Approve') ||
        buttonByText('Genehmigen'),
    ).toBeDefined();
  });
});
