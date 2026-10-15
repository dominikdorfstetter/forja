import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteSampleContent } from '@/services/blogs';
import { completeOnboardingStep, getOnboardingProgress } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { queryKeys } from '@/lib/queryKeys';
import { checklistDismissedKey } from './dashboardHomeUtils';

/**
 * Setup-checklist state for the selected site: backend onboarding
 * progress, the step / sample-content mutations, and the per-site
 * "dismissed" flag persisted in localStorage.
 */
export function useDashboardChecklist(selectedSiteId: string) {
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();
  const [dismissedSiteId, setDismissedSiteId] = useState<string | null>(null);

  // Onboarding progress (per-site checklist state from backend)
  const { data: onboardingProgress } = useQuery({
    queryKey: queryKeys.onboardingProgress(selectedSiteId),
    queryFn: () => getOnboardingProgress(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const completeStepMutation = useMutation({
    mutationFn: (stepKey: string) =>
      completeOnboardingStep(selectedSiteId, { step_key: stepKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(selectedSiteId) });
    },
    onError: showError,
  });

  const deleteSamplesMutation = useMutation({
    mutationFn: () => deleteSampleContent(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardBlogs(selectedSiteId) });
    },
    onError: showError,
  });

  const dismissed =
    !!selectedSiteId &&
    (dismissedSiteId === selectedSiteId ||
      localStorage.getItem(checklistDismissedKey(selectedSiteId)) === '1');

  const dismiss = useCallback(() => {
    if (selectedSiteId) {
      localStorage.setItem(checklistDismissedKey(selectedSiteId), '1');
    }
    setDismissedSiteId(selectedSiteId);
  }, [selectedSiteId]);

  return {
    dismissed,
    dismiss,
    completedSteps: onboardingProgress?.completed_steps?.map((s) => s.step_key) ?? [],
    completeStep: (stepKey: string) => completeStepMutation.mutate(stepKey),
    deleteSamples: () => deleteSamplesMutation.mutate(),
  };
}
