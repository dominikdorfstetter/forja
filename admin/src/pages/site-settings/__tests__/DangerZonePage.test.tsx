import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import { getSiteMembers, transferOwnership } from '@/services/members';
import {
  deleteSite,
  resetContent,
  startSiteExport,
  getSiteExportJob,
} from '@/services/sites';
import { QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import type { SiteMembership } from '@/types/api';
import DangerZonePage from '../DangerZonePage';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    selectedSite: { id: 'site-1', name: 'Acme Blog' },
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const refreshAuth = vi.fn(async () => {});

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const ownerAuth: ReturnType<typeof useAuth> = {
  permission: 'Admin',
  siteId: 'site-1',
  loading: false,
  memberships: [],
  isSystemAdmin: false,
  isGuest: false,
  demoMode: false,
  logout: vi.fn(async () => {}),
  refreshAuth,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  currentSiteRole: 'owner',
  canManageMembers: true,
  canEditAll: true,
  isOwner: true,
  clerkUserId: 'user_self',
  userEmail: 'me@example.com',
  userFullName: 'Me',
  userImageUrl: null,
  getRoleForSite: () => 'owner',
};

function member(over: Partial<SiteMembership>): SiteMembership {
  return {
    id: crypto.randomUUID(),
    clerk_user_id: 'user_x',
    site_id: 'site-1',
    role: 'editor',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as SiteMembership;
}

const MEMBERS: SiteMembership[] = [
  member({ clerk_user_id: 'user_self', name: 'Me', role: 'owner' }),
  member({ clerk_user_id: 'user_jane', name: 'Jane Doe', role: 'admin' }),
  member({ clerk_user_id: 'user_bob', name: 'Bob Stone', role: 'editor' }),
];

describe('DangerZonePage — Transfer Ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(ownerAuth);
    vi.mocked(getSiteMembers).mockResolvedValue(MEMBERS);
    vi.mocked(transferOwnership).mockResolvedValue(undefined);
  });

  it('tracer: owner picks a member, confirms with the site name, transferOwnership is called and success toast shows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.transferOwnership'));

    // Member picker lists other members, excludes the caller
    const picker = await screen.findByTestId('transfer-ownership.picker');
    expect(picker).toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('option', { name: /^Me$/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: /Jane Doe/ }));

    await user.click(screen.getByTestId('transfer-ownership.continue'));

    // Reused DangerConfirmDialog — type the site name
    const confirmInput = await screen.findByTestId('danger-confirm-dialog.input');
    await user.type(confirmInput, 'Acme Blog');
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    await waitFor(() =>
      expect(transferOwnership).toHaveBeenCalledWith('site-1', {
        new_owner_clerk_user_id: 'user_jane',
      }),
    );
    expect(
      await screen.findByText(/now an editor|ownership transferred/i),
    ).toBeInTheDocument();
  });

  it('permission: a non-owner sees the Transfer button disabled', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...ownerAuth,
      isOwner: false,
      isSystemAdmin: false,
    });

    renderWithProviders(<DangerZonePage />);

    expect(
      screen.getByTestId('site-settings.danger.action.transferOwnership'),
    ).toBeDisabled();
  });

  it('validation: Continue stays disabled until a member is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(
      screen.getByTestId('site-settings.danger.action.transferOwnership'),
    );
    await screen.findByTestId('transfer-ownership.picker');

    expect(screen.getByTestId('transfer-ownership.continue')).toBeDisabled();
    expect(screen.queryByTestId('danger-confirm-dialog')).not.toBeInTheDocument();
  });

  it('side-effects: a successful transfer refreshes auth and closes the dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(
      screen.getByTestId('site-settings.danger.action.transferOwnership'),
    );
    await screen.findByTestId('transfer-ownership.picker');
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Bob Stone/ }));
    await user.click(screen.getByTestId('transfer-ownership.continue'));
    await user.type(
      await screen.findByTestId('danger-confirm-dialog.input'),
      'Acme Blog',
    );
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    await waitFor(() => expect(refreshAuth).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByTestId('danger-confirm-dialog')).not.toBeInTheDocument(),
    );
  });

  it('edge: a 422 from the backend surfaces the not-a-member message', async () => {
    const user = userEvent.setup();
    vi.mocked(transferOwnership).mockRejectedValue({
      type: 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
      code: 'SITE_TRANSFER_TARGET_NOT_MEMBER',
    });

    renderWithProviders(<DangerZonePage />);

    await user.click(
      screen.getByTestId('site-settings.danger.action.transferOwnership'),
    );
    await screen.findByTestId('transfer-ownership.picker');
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Jane Doe/ }));
    await user.click(screen.getByTestId('transfer-ownership.continue'));
    await user.type(
      await screen.findByTestId('danger-confirm-dialog.input'),
      'Acme Blog',
    );
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    expect(
      await screen.findByText(/no longer a member of this site/i),
    ).toBeInTheDocument();
  });
});

describe('DangerZonePage — Delete Site', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(ownerAuth);
    vi.mocked(getSiteMembers).mockResolvedValue(MEMBERS);
    vi.mocked(deleteSite).mockResolvedValue(undefined);
  });

  it('tracer: owner confirms with the site name, deleteSite is called, redirected to the site list, grace-period toast shows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.deleteSite'));

    const confirmInput = await screen.findByTestId('danger-confirm-dialog.input');
    await user.type(confirmInput, 'Acme Blog');
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    await waitFor(() => expect(deleteSite).toHaveBeenCalledWith('site-1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/sites'));
    expect(
      await screen.findByText(/restore it within 30 days/i),
    ).toBeInTheDocument();
  });

  it('permission: a non-owner sees the Delete button disabled', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...ownerAuth,
      isOwner: false,
      isSystemAdmin: false,
    });

    renderWithProviders(<DangerZonePage />);

    expect(
      screen.getByTestId('site-settings.danger.action.deleteSite'),
    ).toBeDisabled();
  });

  it('validation: confirm stays disabled until the exact site name is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.deleteSite'));

    const confirmInput = await screen.findByTestId('danger-confirm-dialog.input');
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();

    await user.type(confirmInput, 'Wrong Name');
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();
    expect(deleteSite).not.toHaveBeenCalled();
  });

  it('edge: a 403 surfaces an error toast and does not navigate away', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteSite).mockRejectedValue({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      code: 'SITE_DELETE_FORBIDDEN',
      detail: 'You do not have permission to delete this site.',
    });

    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.deleteSite'));
    await user.type(
      await screen.findByTestId('danger-confirm-dialog.input'),
      'Acme Blog',
    );
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    expect(
      await screen.findByText(/do not have permission to delete this site/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('DangerZonePage — Reset Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(ownerAuth);
    vi.mocked(getSiteMembers).mockResolvedValue(MEMBERS);
    vi.mocked(resetContent).mockResolvedValue(undefined);
  });

  it('tracer: owner confirms with the site name, resetContent is called and a 30-day-recoverable toast shows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.resetContent'));

    const confirmInput = await screen.findByTestId('danger-confirm-dialog.input');
    await user.type(confirmInput, 'Acme Blog');
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    await waitFor(() => expect(resetContent).toHaveBeenCalledWith('site-1'));
    expect(
      await screen.findByText(/restore them within 30 days/i),
    ).toBeInTheDocument();
  });

  it('permission: a non-owner sees the Reset content button disabled', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...ownerAuth,
      isOwner: false,
      isSystemAdmin: false,
    });

    renderWithProviders(<DangerZonePage />);

    expect(
      screen.getByTestId('site-settings.danger.action.resetContent'),
    ).toBeDisabled();
  });

  it('validation: confirm stays disabled until the exact site name is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.resetContent'));

    const confirmInput = await screen.findByTestId('danger-confirm-dialog.input');
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();

    await user.type(confirmInput, 'Wrong Name');
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();
    expect(resetContent).not.toHaveBeenCalled();
  });

  it('happy path: a successful reset invalidates content caches and closes the dialog', async () => {
    const user = userEvent.setup();
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.resetContent'));
    await user.type(
      await screen.findByTestId('danger-confirm-dialog.input'),
      'Acme Blog',
    );
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    await waitFor(() => expect(resetContent).toHaveBeenCalledWith('site-1'));

    const invalidatedKeys = invalidateSpy.mock.calls
      .map(([arg]) => (arg as { queryKey?: unknown[] })?.queryKey?.[0])
      .filter(Boolean);
    for (const key of ['blogs', 'pages', 'media', 'documents', 'legal']) {
      expect(invalidatedKeys).toContain(key);
    }

    await waitFor(() =>
      expect(screen.queryByTestId('danger-confirm-dialog')).not.toBeInTheDocument(),
    );
    invalidateSpy.mockRestore();
  });

  it('edge: a 403 surfaces an error toast and keeps the dialog open', async () => {
    const user = userEvent.setup();
    vi.mocked(resetContent).mockRejectedValue({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      code: 'AUTH_INSUFFICIENT_ROLE',
      detail: 'You do not have permission to perform this action.',
    });

    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.action.resetContent'));
    await user.type(
      await screen.findByTestId('danger-confirm-dialog.input'),
      'Acme Blog',
    );
    await user.click(screen.getByTestId('danger-confirm-dialog.confirm'));

    expect(
      await screen.findByText(/do not have permission to perform this action/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('danger-confirm-dialog')).toBeInTheDocument();
  });
});

describe('DangerZonePage — Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(ownerAuth);
    vi.mocked(getSiteMembers).mockResolvedValue(MEMBERS);
    vi.mocked(startSiteExport).mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      created_at: '2026-05-18T10:00:00Z',
    });
    vi.mocked(getSiteExportJob).mockResolvedValue({
      id: 'job-1',
      status: 'ready',
      created_at: '2026-05-18T10:00:00Z',
      download_url: '/api/v1/sites/site-1/export/job-1/download?token=tok',
      expires_at: '2026-05-25T10:00:00Z',
    });
  });

  it('tracer: an authorized user can trigger the export from the Danger zone', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DangerZonePage />);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));

    await waitFor(() => expect(startSiteExport).toHaveBeenCalledWith('site-1'));
    expect(
      await screen.findByTestId('site-settings.danger.export.download'),
    ).toBeInTheDocument();
  });

  it('permission: a user below site-admin sees the Export trigger disabled', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...ownerAuth,
      isOwner: false,
      isSystemAdmin: false,
      isAdmin: false,
    });

    renderWithProviders(<DangerZonePage />);

    expect(
      screen.getByTestId('site-settings.danger.export.start'),
    ).toBeDisabled();
    expect(startSiteExport).not.toHaveBeenCalled();
  });
});
