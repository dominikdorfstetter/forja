import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSiteSettings } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { ContentStatus } from '@/types/api';

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
  const { can, canWrite, canReview } = usePermissions();
  const { selectedSiteId } = useSiteContext();

  const { data: settings } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => getSiteSettings(selectedSiteId),
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

    if (!canWrite && !canReview) return base;

    // Workflow DISABLED: all actions based on current status
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

    // Workflow ENABLED — use granular permissions

    // Editor+ (has blog:publish): all workflow actions
    if (can('blog:publish')) {
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

    // Reviewer (has blog:review): can approve/reject InReview content
    if (can('blog:review')) {
      return {
        ...base,
        workflowEnabled: true,
        canSubmitForReview: currentStatus === 'Draft',
        canApprove: currentStatus === 'InReview',
        canRequestChanges: currentStatus === 'InReview',
      };
    }

    // Author (has blog:create but not review/publish): can only submit for review
    if (can('blog:create')) {
      return {
        ...base,
        workflowEnabled: true,
        canSubmitForReview: currentStatus === 'Draft',
      };
    }

    return base;
  }, [workflowEnabled, currentStatus, canWrite, canReview, can]);
}
