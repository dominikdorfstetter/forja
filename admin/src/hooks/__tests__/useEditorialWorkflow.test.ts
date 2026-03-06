import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useEditorialWorkflow } from '../useEditorialWorkflow';

const mockAuth = {
  permission: 'Admin' as const,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  memberships: [],
  isSystemAdmin: false,
  siteId: null,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  currentSiteRole: 'admin' as string | null,
  canManageMembers: true,
  canEditAll: true,
  isOwner: false,
  clerkUserId: 'clerk-1',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: () => 'admin' as const,
};

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
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

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // Reset to defaults
  mockAuth.canWrite = true;
  mockAuth.currentSiteRole = 'admin';
});

describe('useEditorialWorkflow', () => {
  describe('workflow disabled', () => {
    beforeEach(() => {
      vi.mocked(apiService.getSiteSettings).mockResolvedValue({
        editorial_workflow_enabled: false,
      } as never);
    });

    it('allows publish from Draft', async () => {
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.canPublish).toBe(true);
      });
      expect(result.current.canSchedule).toBe(true);
      expect(result.current.workflowEnabled).toBe(false);
    });

    it('allows unpublish and archive from Published', async () => {
      const { result } = renderHook(() => useEditorialWorkflow('Published'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.canUnpublish).toBe(true);
      });
      expect(result.current.canArchive).toBe(true);
    });

    it('allows restore from Archived', async () => {
      const { result } = renderHook(() => useEditorialWorkflow('Archived'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.canRestore).toBe(true);
      });
    });
  });

  describe('workflow enabled', () => {
    beforeEach(() => {
      vi.mocked(apiService.getSiteSettings).mockResolvedValue({
        editorial_workflow_enabled: true,
      } as never);
    });

    it('editor can do all actions', async () => {
      mockAuth.currentSiteRole = 'editor';
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canSubmitForReview).toBe(true);
      expect(result.current.canPublish).toBe(true);
      expect(result.current.canSchedule).toBe(true);
    });

    it('author can only submit for review', async () => {
      mockAuth.currentSiteRole = 'author';
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canSubmitForReview).toBe(true);
      expect(result.current.canPublish).toBe(false);
      expect(result.current.canApprove).toBe(false);
    });

    it('reviewer can approve and request changes on InReview', async () => {
      mockAuth.currentSiteRole = 'reviewer';
      const { result } = renderHook(() => useEditorialWorkflow('InReview'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canApprove).toBe(true);
      expect(result.current.canRequestChanges).toBe(true);
      expect(result.current.canPublish).toBe(false);
    });

    it('viewer cannot do anything', async () => {
      mockAuth.currentSiteRole = 'viewer';
      mockAuth.canWrite = false;
      const { result } = renderHook(() => useEditorialWorkflow('Draft'), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.workflowEnabled).toBe(true);
      });
      expect(result.current.canSubmitForReview).toBe(false);
      expect(result.current.canPublish).toBe(false);
    });
  });
});
