import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import {
  deleteUserAccountOnBehalf,
  exportUserDataOnBehalf,
  getClerkUsers,
} from '@/services/clerkUsers';
import type { ClerkUser } from '@/types/api';
import ClerkUsersPage from '@/pages/ClerkUsers';

// The global mock pins isMaster to false; DSR fulfilment is a master/system
// admin surface, so this suite runs with the master view.
vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    permission: 'Master',
    siteId: null,
    loading: false,
    memberships: [],
    isSystemAdmin: true,
    isGuest: false,
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: true,
    currentSiteRole: 'admin',
    canManageMembers: true,
    canEditAll: true,
    isOwner: false,
    clerkUserId: 'clerk-admin-1',
    userEmail: 'admin@example.com',
    userFullName: 'Admin User',
    userImageUrl: null,
    getRoleForSite: () => 'admin',
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const activeUser: ClerkUser = {
  id: 'clerk-user-42',
  email: 'jane@example.com',
  name: 'Jane Doe',
  image_url: null,
  role: 'editor',
  created_at: 1700000000000,
  updated_at: 1700000000000,
  last_sign_in_at: 1700000000000,
  moderation_status: 'active',
  moderation_reason: null,
} as unknown as ClerkUser;

const bannedUser: ClerkUser = {
  ...activeUser,
  id: 'clerk-user-banned',
  name: 'Banned Bob',
  moderation_status: 'banned',
  moderation_reason: 'abuse',
} as unknown as ClerkUser;

async function openActionMenu(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByTestId('clerk-users-table')).toBeInTheDocument();
  });
  await user.click(screen.getByTestId('clerk-users.action-menu'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClerkUsers).mockResolvedValue({
    data: [activeUser],
    total_count: 1,
  });
});

describe('ClerkUsersPage DSR fulfilment (GDPR)', () => {
  it('exports a user\'s data as a JSON download from the action menu', async () => {
    vi.mocked(exportUserDataOnBehalf).mockResolvedValue({} as never);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithProviders(<ClerkUsersPage />);

    await openActionMenu(user);
    await user.click(screen.getByText('Export data (GDPR)'));

    await waitFor(() => {
      expect(exportUserDataOnBehalf).toHaveBeenCalledWith('clerk-user-42');
    });
    expect(createObjectURL).toHaveBeenCalled();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('deletes a user\'s account after typed confirmation', async () => {
    vi.mocked(deleteUserAccountOnBehalf).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderWithProviders(<ClerkUsersPage />);

    await openActionMenu(user);
    await user.click(screen.getByText('Delete account (GDPR)'));

    // Destructive: the confirm dialog requires typing the confirmation word.
    const field = await screen.findByTestId('confirm-input');
    const input = field.querySelector('input') as HTMLInputElement;
    await user.type(input, 'Delete');
    await user.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(deleteUserAccountOnBehalf).toHaveBeenCalledWith('clerk-user-42');
    });
  });

  it('does not offer the GDPR delete for banned users (moderation purge owns them)', async () => {
    vi.mocked(getClerkUsers).mockResolvedValue({
      data: [bannedUser],
      total_count: 1,
    });
    const user = userEvent.setup();
    renderWithProviders(<ClerkUsersPage />);

    await openActionMenu(user);

    expect(screen.getByText('Export data (GDPR)')).toBeInTheDocument();
    expect(screen.queryByText('Delete account (GDPR)')).not.toBeInTheDocument();
    expect(screen.getByText('Delete User')).toBeInTheDocument();
  });
});
