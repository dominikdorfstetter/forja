import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '@/hooks/usePermissions';
import type { MembershipSummary } from '@/types/api';

// usePermissions resolves permissions from AuthContext memberships for the
// SiteContext-selected site, so both contexts are re-mocked here with
// mutable state (setup.ts's global AuthContext mock has no memberships).
const mockAuth = {
  memberships: [] as MembershipSummary[],
  isSystemAdmin: false,
};

const mockSite = {
  selectedSiteId: 'site-1' as string | null,
};

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: mockSite.selectedSiteId,
    setSelectedSiteId: vi.fn(),
    selectedSite: undefined,
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function membership(siteId: string, permissions: string[]): MembershipSummary {
  return {
    site_id: siteId,
    site_name: 'Test Site',
    site_slug: 'test-site',
    role: 'editor',
    permissions,
  };
}

beforeEach(() => {
  mockAuth.memberships = [];
  mockAuth.isSystemAdmin = false;
  mockSite.selectedSiteId = 'site-1';
});

describe('usePermissions', () => {
  describe('scoped-variant matching', () => {
    it('a role holding blog:update:own passes the unscoped can("blog:update") check', () => {
      mockAuth.memberships = [membership('site-1', ['blog:update:own'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:update')).toBe(true);
    });

    it('a role holding blog:update:any passes the unscoped can("blog:update") check', () => {
      mockAuth.memberships = [membership('site-1', ['blog:update:any'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:update')).toBe(true);
    });

    it('an exact permission match passes', () => {
      mockAuth.memberships = [membership('site-1', ['blog:create'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:create')).toBe(true);
    });

    it('an explicitly scoped check is not satisfied by a different scope', () => {
      mockAuth.memberships = [membership('site-1', ['blog:update:own'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:update:any')).toBe(false);
      expect(result.current.canEditAll).toBe(false);
    });
  });

  describe('viewer-style read-only role', () => {
    beforeEach(() => {
      mockAuth.memberships = [membership('site-1', ['blog:read', 'page:read'])];
    });

    it('fails write checks', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:create')).toBe(false);
      expect(result.current.can('blog:update')).toBe(false);
      expect(result.current.canWrite).toBe(false);
      expect(result.current.canPublish).toBe(false);
    });

    it('still passes its own read checks', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:read')).toBe(true);
    });
  });

  describe('canAny / canAll combinations', () => {
    it('canAny passes when at least one listed permission is held', () => {
      mockAuth.memberships = [membership('site-1', ['blog:read'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAny('blog:create', 'blog:read')).toBe(true);
    });

    it('canAny fails when none of the listed permissions are held', () => {
      mockAuth.memberships = [membership('site-1', ['blog:read'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAny('blog:create', 'blog:delete')).toBe(false);
    });

    it('canAll passes only when every listed permission is held (scoped variants count)', () => {
      mockAuth.memberships = [
        membership('site-1', ['blog:read', 'blog:update:own']),
      ];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll('blog:read', 'blog:update')).toBe(true);
    });

    it('canAll fails when any listed permission is missing', () => {
      mockAuth.memberships = [membership('site-1', ['blog:read'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll('blog:read', 'blog:delete')).toBe(false);
    });
  });

  describe('system-admin bypass', () => {
    beforeEach(() => {
      mockAuth.isSystemAdmin = true;
      mockAuth.memberships = [];
    });

    it('can / canAny / canAll all pass without any membership', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:delete')).toBe(true);
      expect(result.current.canAny('settings:update')).toBe(true);
      expect(result.current.canAll('blog:create', 'member:invite')).toBe(true);
    });

    it('convenience booleans report full access', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canWrite).toBe(true);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.canManageMembers).toBe(true);
      expect(result.current.canEditAll).toBe(true);
    });
  });

  describe('site scoping', () => {
    it('a membership on another site grants nothing on the selected site', () => {
      mockAuth.memberships = [membership('site-2', ['blog:create', 'blog:update:any'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:create')).toBe(false);
      expect(result.current.canWrite).toBe(false);
    });

    it('grants nothing when no site is selected', () => {
      mockSite.selectedSiteId = null;
      mockAuth.memberships = [membership('site-1', ['blog:create'])];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('blog:create')).toBe(false);
    });
  });

  describe('convenience booleans', () => {
    it('isAdmin is derived from settings access, canManageMembers from member:invite', () => {
      mockAuth.memberships = [
        membership('site-1', ['settings:read', 'member:invite']),
      ];
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.canManageMembers).toBe(true);
    });
  });
});
