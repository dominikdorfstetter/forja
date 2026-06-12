import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { updateSubmissionStatus } from '@/services/forms';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { FormSubmissionStatus } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface StatusChange {
  submissionId: string;
  status: FormSubmissionStatus;
}

/**
 * Shared submission-status mutation used by both the inbox action menu and
 * the detail drawer. Centralising it here keeps the list rows, the
 * status-count chips, and an open detail view consistent after a transition
 * regardless of where it was triggered — and keeps the state machine a
 * single concern instead of two divergent copies.
 */
export function useSubmissionStatusMutation(formId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { showError, showSuccess } = useErrorSnackbar();

  return useMutation({
    mutationFn: ({ submissionId, status }: StatusChange) =>
      updateSubmissionStatus(submissionId, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.submission(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions(formId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissionStatusCounts(formId),
      });
      showSuccess(
        t('formsModule.submissions.messages.statusUpdated', 'Status updated.'),
      );
    },
    onError: showError,
  });
}
