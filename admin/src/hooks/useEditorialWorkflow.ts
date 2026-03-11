import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import type { ContentStatus, SiteRole } from '@/types/api';

const ROLE_RANK: Record<SiteRole, number> = {
  owner: 60,
  admin: 50,
  editor: 40,
  author: 30,
  reviewer: 20,
  viewer: 10,
};

function isAtLeast(role: SiteRole | null, min: SiteRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

interface WorkflowActions {
  workflowEnabled: boolean;
  canSubmitForReview: boolean;
  canApprove: boolean;
  canRequestChanges: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canSchedule: boolean;
}

export function useEditorialWorkflow(currentStatus: ContentStatus): WorkflowActions {
  const { currentSiteRole, canWrite } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const { data: settings } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => apiService.getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
    staleTime: 5 * 60 * 1000,
  });

  const workflowEnabled = settings?.editorial_workflow_enabled ?? false;

  return useMemo(() => {
    const base: WorkflowActions = {
      workflowEnabled,
      canSubmitForReview: false,
      canApprove: false,
      canRequestChanges: false,
      canPublish: false,
      canUnpublish: false,
      canArchive: false,
      canRestore: false,
      canSchedule: false,
    };

    if (!canWrite) return base;

    // ── Workflow DISABLED: all actions based on current status ──
    if (!workflowEnabled) {
      return {
        ...base,
        canPublish: currentStatus === 'Draft' || currentStatus === 'Scheduled',
        canUnpublish: currentStatus === 'Published' || currentStatus === 'Scheduled',
        canArchive: currentStatus === 'Published' || currentStatus === 'Scheduled',
        canRestore: currentStatus === 'Archived',
        canSchedule: currentStatus === 'Draft',
      };
    }

    // ── Workflow ENABLED ──

    // Editor+ bypass: all actions based on current status + workflow actions
    if (isAtLeast(currentSiteRole, 'editor')) {
      return {
        ...base,
        workflowEnabled: true,
        canSubmitForReview: currentStatus === 'Draft',
        canApprove: currentStatus === 'InReview',
        canRequestChanges: currentStatus === 'InReview',
        canPublish: currentStatus === 'Draft' || currentStatus === 'Scheduled',
        canUnpublish: currentStatus === 'Published' || currentStatus === 'Scheduled',
        canArchive: currentStatus === 'Published' || currentStatus === 'Scheduled',
        canRestore: currentStatus === 'Archived',
        canSchedule: currentStatus === 'Draft',
      };
    }

    // Author: can only submit for review from Draft
    if (isAtLeast(currentSiteRole, 'author')) {
      return {
        ...base,
        workflowEnabled: true,
        canSubmitForReview: currentStatus === 'Draft',
      };
    }

    // Reviewer: can approve or request changes on InReview content
    if (isAtLeast(currentSiteRole, 'reviewer')) {
      return {
        ...base,
        workflowEnabled: true,
        canApprove: currentStatus === 'InReview',
        canRequestChanges: currentStatus === 'InReview',
      };
    }

    // Viewer / no role
    return base;
  }, [workflowEnabled, currentSiteRole, currentStatus, canWrite]);
}
