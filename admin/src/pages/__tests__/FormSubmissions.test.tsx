import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { createSubmissionNote, getForm, getSubmission, getSubmissionStatusCounts, getSubmissions, updateSubmissionStatus } from '@/services/forms';
import { getClerkUsers } from '@/services/clerkUsers';
import type {
  ClerkUserListResponse,
  FormDetailResponse,
  Paginated,
  SubmissionDetailResponse,
  SubmissionListItem,
  SubmissionStatusCounts,
} from '@/types/api';

const mockNavigate = vi.fn();
vi.mock('react-router', async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'form-1' }),
  };
});

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '', updated_at: '' },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    canWrite: true,
    isAdmin: true,
    loading: false,
    canRead: true,
    isMaster: false,
    permission: 'Admin' as const,
    memberships: [],
    isSystemAdmin: false,
    isGuest: false,
    siteId: null,
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    currentSiteRole: 'admin' as const,
    canManageMembers: true,
    canEditAll: true,
    isOwner: false,
    clerkUserId: 'clerk-1',
    userEmail: 'a@b.c',
    userFullName: 'A',
    userImageUrl: null,
    getRoleForSite: () => 'admin' as const,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

import FormSubmissionsPage from '../FormSubmissions';

const form: FormDetailResponse = {
  id: 'form-1',
  site_id: 'site-1',
  name: 'Contact',
  slug: 'contact',
  description: null,
  is_active: true,
  consent_required: false,
  consent_text: null,
  bot_protection: 'none',
  storage_mode: 'simple',
  retention_days: null,
  fields: [],
  created_at: '',
  updated_at: '',
};

const sub: SubmissionListItem = {
  id: 'sub-1',
  reference_code: 'AAAA-BBBB-CCCC',
  status: 'new',
  data: { Email: 'visitor@example.com', Message: 'Hello' },
  created_at: '2026-05-01T10:00:00Z',
};

const counts: SubmissionStatusCounts = { new: 1, in_review: 0, resolved: 0, rejected: 0, archived: 0 };

const empty: Paginated<SubmissionListItem> = {
  data: [],
  meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
};
const onePage: Paginated<SubmissionListItem> = {
  data: [sub],
  meta: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
};

const detail: SubmissionDetailResponse = {
  id: 'sub-1',
  form_id: 'form-1',
  reference_code: 'AAAA-BBBB-CCCC',
  status: 'new',
  data: { Email: 'visitor@example.com', Message: 'Hello' },
  consent_given: false,
  consent_text_at_submission: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
  notes: [],
  status_history: [
    { from_status: null, to_status: 'new', changed_by: null, created_at: '2026-05-01T10:00:00Z' },
  ],
};

describe('FormSubmissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getForm).mockResolvedValue(form);
    vi.mocked(getSubmissionStatusCounts).mockResolvedValue(counts);
    vi.mocked(getSubmissions).mockResolvedValue(onePage);
    vi.mocked(getSubmission).mockResolvedValue(detail);
    vi.mocked(getClerkUsers).mockResolvedValue({ data: [], total_count: 0 });
  });

  it('renders submissions with status chips showing counts', async () => {
    renderWithProviders(<FormSubmissionsPage />);
    await waitFor(() => expect(screen.getByText('AAAA-BBBB-CCCC')).toBeInTheDocument());
    // chip with count for "new"
    expect(screen.getByTestId('forms.submissions.chip.new')).toHaveTextContent(/1/);
  });

  it('renders the empty state when there are no submissions for the active filter', async () => {
    vi.mocked(getSubmissions).mockResolvedValue(empty);
    vi.mocked(getSubmissionStatusCounts).mockResolvedValue({
      new: 0, in_review: 0, resolved: 0, rejected: 0, archived: 0,
    });
    renderWithProviders(<FormSubmissionsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
  });

  it('opens the detail drawer when a row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));
    expect(await screen.findByTestId('forms.submission.detail')).toBeInTheDocument();
    // Field values rendered
    expect(screen.getByText('visitor@example.com')).toBeInTheDocument();
  });

  it('moves a submission forward via the drawer transition buttons', async () => {
    vi.mocked(updateSubmissionStatus).mockResolvedValue({ ...detail, status: 'in_review' });
    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));

    // The drawer offers only the state machine's legal next states for a
    // "new" submission — no free dropdown that bounces back on a 400.
    await user.click(await screen.findByTestId('forms.submission.transition.in_review'));

    await waitFor(() => {
      expect(updateSubmissionStatus).toHaveBeenCalledWith('sub-1', {
        status: 'in_review',
      });
    });
  });

  it('does not offer an illegal transition in the drawer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));
    await screen.findByTestId('forms.submission.transition.in_review');
    // new → resolved is not a legal move, so the affordance must not exist.
    expect(screen.queryByTestId('forms.submission.transition.resolved')).toBeNull();
  });

  it('changes status from the table action menu without opening the drawer', async () => {
    vi.mocked(updateSubmissionStatus).mockResolvedValue({ ...detail, status: 'in_review' });
    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await screen.findByText('AAAA-BBBB-CCCC');

    await user.click(screen.getByTestId('forms.submission.actions.sub-1'));
    await user.click(await screen.findByTestId('forms.submission.actions.sub-1.in_review'));

    await waitFor(() => {
      expect(updateSubmissionStatus).toHaveBeenCalledWith('sub-1', {
        status: 'in_review',
      });
    });
    // stopPropagation must keep the row's detail drawer closed.
    expect(screen.queryByTestId('forms.submission.detail')).not.toBeInTheDocument();
  });

  it('adds a note via the note form', async () => {
    vi.mocked(createSubmissionNote).mockResolvedValue({
      id: 'note-1', author_id: 'clerk-1', body: 'Reached out via email.', created_at: '2026-05-02T00:00:00Z',
    });
    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));

    const noteInput = await screen.findByTestId('forms.submission.note.input');
    await user.type(noteInput, 'Reached out via email.');
    await user.click(screen.getByTestId('forms.submission.note.btn.add'));

    await waitFor(() => {
      expect(createSubmissionNote).toHaveBeenCalledWith('sub-1', {
        body: 'Reached out via email.',
      });
    });
  });

  it('shows the actor display name (not the raw clerk id) in status history', async () => {
    vi.mocked(getSubmission).mockResolvedValue({
      ...detail,
      status_history: [
        { from_status: null, to_status: 'new', changed_by: null, created_at: '2026-05-01T10:00:00Z' },
        { from_status: 'new', to_status: 'in_review', changed_by: 'user_abc', created_at: '2026-05-01T11:00:00Z' },
      ],
    });
    const clerkUsers: ClerkUserListResponse = {
      data: [
        {
          id: 'user_abc',
          name: 'Jane Reviewer',
          email: 'jane@example.com',
          created_at: 0,
          updated_at: 0,
          role: 'admin',
          moderation_status: 'active',
        },
      ],
      total_count: 1,
    };
    vi.mocked(getClerkUsers).mockResolvedValue(clerkUsers);

    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));

    expect(await screen.findByText(/Jane Reviewer/)).toBeInTheDocument();
    expect(screen.queryByText(/user_abc/)).not.toBeInTheDocument();
  });

  it('shows who created a note (resolved name, not the clerk id)', async () => {
    vi.mocked(getSubmission).mockResolvedValue({
      ...detail,
      notes: [
        { id: 'note-1', author_id: 'user_abc', body: 'Testnote', created_at: '2026-05-15T17:30:28Z' },
      ],
    });
    vi.mocked(getClerkUsers).mockResolvedValue({
      data: [
        {
          id: 'user_abc',
          name: 'Jane Reviewer',
          email: 'jane@example.com',
          created_at: 0,
          updated_at: 0,
          role: 'admin',
          moderation_status: 'active',
        },
      ],
      total_count: 1,
    });

    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));

    expect(await screen.findByText(/Jane Reviewer/)).toBeInTheDocument();
    expect(screen.queryByText(/user_abc/)).not.toBeInTheDocument();
  });

  it('renders the sender email as a Re: mailto link quoting the submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormSubmissionsPage />);
    await user.click(await screen.findByText('AAAA-BBBB-CCCC'));

    const link = await screen.findByTestId('forms.submission.mailto');
    const href = link.getAttribute('href') ?? '';
    expect(href).toMatch(/^mailto:visitor%40example\.com\?/);
    // Subject is "Re: [<reference_code>]"
    expect(href).toContain(`subject=${encodeURIComponent('Re: [AAAA-BBBB-CCCC]')}`);
    // Body quotes the original submission fields
    expect(decodeURIComponent(href)).toContain('> Message: Hello');
  });
});
