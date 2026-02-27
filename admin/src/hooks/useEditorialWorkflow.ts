import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import type { ContentStatus, SiteRole } from '@/types/api';

const ALL_STATUSES: ContentStatus[] = ['Draft', 'InReview', 'Scheduled', 'Published', 'Archived'];

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

export function useEditorialWorkflow(currentStatus: ContentStatus) {
  const { currentSiteRole } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const { data: settings } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => apiService.getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
    staleTime: 5 * 60 * 1000,
  });

  const workflowEnabled = settings?.editorial_workflow_enabled ?? false;

  return useMemo(() => {
    // Workflow disabled: no restrictions
    if (!workflowEnabled) {
      return {
        workflowEnabled: false,
        allowedStatuses: ALL_STATUSES,
        canSubmitForReview: false,
        canApprove: false,
        canRequestChanges: false,
      };
    }

    // Editors/Admins/Owners bypass
    if (isAtLeast(currentSiteRole, 'editor')) {
      return {
        workflowEnabled: true,
        allowedStatuses: ALL_STATUSES,
        canSubmitForReview: currentStatus === 'Draft',
        canApprove: currentStatus === 'InReview',
        canRequestChanges: currentStatus === 'InReview',
      };
    }

    // Author rules
    if (isAtLeast(currentSiteRole, 'author')) {
      const allowedStatuses: ContentStatus[] = ['Draft', 'InReview'];
      return {
        workflowEnabled: true,
        allowedStatuses,
        canSubmitForReview: currentStatus === 'Draft',
        canApprove: false,
        canRequestChanges: false,
      };
    }

    // Reviewer rules
    if (isAtLeast(currentSiteRole, 'reviewer')) {
      const allowedStatuses: ContentStatus[] = currentStatus === 'InReview'
        ? ['Draft', 'Published', 'Scheduled']
        : [currentStatus];
      return {
        workflowEnabled: true,
        allowedStatuses,
        canSubmitForReview: false,
        canApprove: currentStatus === 'InReview',
        canRequestChanges: currentStatus === 'InReview',
      };
    }

    // Viewer / no role
    return {
      workflowEnabled: true,
      allowedStatuses: [currentStatus] as ContentStatus[],
      canSubmitForReview: false,
      canApprove: false,
      canRequestChanges: false,
    };
  }, [workflowEnabled, currentSiteRole, currentStatus]);
}
