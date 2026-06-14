import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { getTrash } from '@/services/sites';
import TrashPage from '../TrashPage';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Viewer: read-only — canWrite false, isAdmin false.
vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: false,
    isMaster: false,
    canWrite: false,
    canRead: true,
    permission: 'Read',
  }),
}));

const trash = {
  items: [
    {
      id: 'content-1',
      entity_type: 'blog',
      title: 'Deleted Blog Post',
      slug: 'deleted-blog',
      deleted_at: '2026-03-20T10:00:00Z',
      site_id: 'site-1',
    },
  ],
  total: 1,
};

describe('TrashPage read-only (viewer) (#6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTrash).mockResolvedValue(trash);
  });

  it('shows trash items (read) but offers a viewer no restore or delete affordance', async () => {
    renderWithProviders(<TrashPage />);

    // Read access is unaffected — the item is visible.
    expect(await screen.findByText('Deleted Blog Post')).toBeInTheDocument();

    // Restore is canWrite-gated and permanent-delete is isAdmin-gated, so a
    // viewer's row has no actionable menu at all (it collapses to null).
    expect(screen.queryByTestId('trash.actions.content-1')).toBeNull();

    // ...and no empty-trash / delete-all header action.
    expect(screen.queryByTestId('trash.delete-all')).toBeNull();
  });
});
