import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getAuthMe } from '@/services/auth';
import { getSites } from '@/services/sites';

vi.unmock('@/store/AuthContext');
vi.unmock('@/store/SiteContext');

import { AuthProvider, useAuth } from '../AuthContext';
import { SiteProvider } from '../SiteContext';
const TEST_SITE_ID = '183dab71-645f-4504-b208-29985e0e4132';
const TEST_CLERK_USER = 'user_3DRMoB9fDduGyJJXwSjtHp4Jjve';

const mockedApi = {
  getAuthMe: vi.mocked(getAuthMe),
  getSites: vi.mocked(getSites),
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SiteProvider>{children}</SiteProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('AuthContext — newly-created site owner visibility (#574)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('exposes isOwner=true when /auth/me returns the selected site as owner', async () => {
    window.localStorage.setItem('selectedSiteId', TEST_SITE_ID);

    mockedApi.getAuthMe.mockResolvedValue({
      permission: 'Read',
      auth_method: 'clerk_jwt',
      clerk_user_id: TEST_CLERK_USER,
      memberships: [
        {
          site_id: TEST_SITE_ID,
          site_name: 'test',
          site_slug: 'test',
          role: 'owner',
          permissions: [],
        },
      ],
      is_system_admin: false,
      demo_mode: true,
    });

    mockedApi.getSites.mockResolvedValue([
      {
        id: TEST_SITE_ID,
        name: 'test',
        slug: 'test',
        is_active: true,
        is_deleted: false,
        timezone: 'Europe/Zurich',
        created_at: '2026-05-08T13:20:40Z',
        updated_at: '2026-05-08T13:20:40Z',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ]);

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.memberships).toHaveLength(1);
    });

    await waitFor(() => {
      expect(result.current.currentSiteRole).toBe('owner');
      expect(result.current.isOwner).toBe(true);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.canWrite).toBe(true);
    });
  });
});
