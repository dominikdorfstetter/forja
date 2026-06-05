import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSiteSettings } from '@/services/sites';
import { useEditorialWorkflow } from '../useEditorialWorkflow';

// Mock permissions returned by usePermissions
const mockPermissions = {
  permissions: new Set<string>(),
  can: vi.fn((p: string) => mockPermissions.permissions.has(p)),
  canAny: vi.fn((...ps: string[]) => ps.some((p) => mockPermissions.permissions.has(p))),
  canAll: vi.fn((...ps: string[]) => ps.every((p) => mockPermissions.permissions.has(p))),
  canWrite: true,
  isAdmin: false,
  canManageMembers: false,
  canEditAll: false,
  canPublish: false,
  canReview: false,
};

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => mockPermissions,
}));

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: undefined,
    sites: [],
    isLoading: false,
  }),
}));

const EDITOR_PERMS = [
  'blog:create', 'blog:read', 'blog:update:own', 'blog:update:any',
  'blog:delete:own', 'blog:delete:any', 'blog:publish', 'blog:review',
  'blog:update:published',
];
const AUTHOR_PERMS = ['blog:create', 'blog:read', 'blog:update:own', 'blog:delete:own'];
const REVIEWER_PERMS = ['blog:read', 'blog:review'];

function setPermissions(perms: string[]) {
  mockPermissions.permissions = new Set(perms);
  mockPermissions.canWrite = perms.includes('blog:create');
  mockPermissions.canPublish = perms.includes('blog:publish');
  mockPermissions.canReview = perms.includes('blog:review');
}

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  setPermissions(EDITOR_PERMS);
});

describe('useEditorialWorkflow', () => {
  describe('workflow disabled', () => {
    beforeEach(() => {
      vi.mocked(getSiteSettings).mockResolvedValue({
        editorial_workflow_enabled: false,
      } as never);
    });

    it('allows publish from Draft', async () => {
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), { wrapper });
      await waitFor(() => {
        expect(result.current.canPublish).toBe(true);
      });
      expect(result.current.canSchedule).toBe(true);
      expect(result.current.workflowEnabled).toBe(false);
    });

    it('allows unpublish and archive from Published', async () => {
      const { result } = renderHook(() => useEditorialWorkflow('Published'), { wrapper });
      await waitFor(() => {
        expect(result.current.canUnpublish).toBe(true);
      });
      expect(result.current.canArchive).toBe(true);
    });

    it('allows restore from Archived', async () => {
      const { result } = renderHook(() => useEditorialWorkflow('Archived'), { wrapper });
      await waitFor(() => {
        expect(result.current.canRestore).toBe(true);
      });
    });
  });

  describe('workflow enabled', () => {
    beforeEach(() => {
      vi.mocked(getSiteSettings).mockResolvedValue({
        editorial_workflow_enabled: true,
      } as never);
    });

    it('editor can do all actions', async () => {
      setPermissions(EDITOR_PERMS);
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), { wrapper });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canSubmitForReview).toBe(true);
      expect(result.current.canPublish).toBe(true);
      expect(result.current.canSchedule).toBe(true);
    });

    it('author can only submit for review', async () => {
      setPermissions(AUTHOR_PERMS);
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), { wrapper });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canSubmitForReview).toBe(true);
      expect(result.current.canPublish).toBe(false);
      expect(result.current.canApprove).toBe(false);
    });

    it('reviewer can approve and request changes on InReview', async () => {
      setPermissions(REVIEWER_PERMS);
      const { result } = renderHook(() => useEditorialWorkflow('InReview'), { wrapper });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canApprove).toBe(true);
      expect(result.current.canRequestChanges).toBe(true);
      expect(result.current.canPublish).toBe(false);
    });

    it('viewer cannot do anything', async () => {
      setPermissions([]);
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), { wrapper });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canSubmitForReview).toBe(false);
      expect(result.current.canPublish).toBe(false);
    });
  });
});
