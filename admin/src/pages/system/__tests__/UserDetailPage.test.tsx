import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router';
import { renderWithProviders, screen } from '@/test/test-utils';
import { getClerkUser, getUserAuditLogs } from '@/services/clerkUsers';
import type { ClerkUser, PaginatedAuditLogs } from '@/types/api';
import UserDetailPage from '../UserDetailPage';

const bannedUser = {
  id: 'clerk-user-7',
  email: 'bob@example.com',
  name: 'Banned Bob',
  image_url: null,
  role: 'editor',
  created_at: 1700000000,
  last_sign_in_at: null,
  moderation_status: 'banned',
  moderation_reason: 'abuse',
} as unknown as ClerkUser;

const auditPage = (data: PaginatedAuditLogs['data']) =>
  ({
    data,
    meta: { page: 1, page_size: 20, total_items: data.length, total_pages: 1 },
  }) as unknown as PaginatedAuditLogs;

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/system/users/:id" element={<UserDetailPage />} />
    </Routes>,
    { route: '/system/users/clerk-user-7' },
  );

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getClerkUser).mockResolvedValue(bannedUser);
    vi.mocked(getUserAuditLogs).mockResolvedValue(
      auditPage([
        {
          id: 'a-1',
          action: 'Update',
          entity_type: 'blog',
          entity_id: 'b-1',
          ip_address: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ] as unknown as PaginatedAuditLogs['data']),
    );
  });

  it('shows the profile with moderation state and reason', async () => {
    renderPage();

    const profile = await screen.findByTestId('user-detail.profile');
    expect(profile).toHaveTextContent('bob@example.com');
    expect(profile).toHaveTextContent('Reason: abuse');
    expect(getClerkUser).toHaveBeenCalledWith('clerk-user-7');
  });

  it('lists the user activity, falling back to a dash for unknown IPs', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('user-detail.activity-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Update');
    expect(rows[0]).toHaveTextContent('—');
    expect(getUserAuditLogs).toHaveBeenCalledWith('clerk-user-7', { page: 1, page_size: 20 });
  });

  it('says so when there is no recorded activity', async () => {
    vi.mocked(getUserAuditLogs).mockResolvedValue(auditPage([]));
    renderPage();

    expect(await screen.findByText('No activity recorded')).toBeInTheDocument();
  });
});
