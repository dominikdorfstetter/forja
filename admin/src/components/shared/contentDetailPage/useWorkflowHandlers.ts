import { useCallback, useMemo, type Dispatch } from 'react';
import type { FieldValues, UseFormSetValue } from 'react-hook-form';
import type { ContentStatus } from '@/types/api';
import type { ContentDetailUIAction } from './contentDetailReducer';
import type { ContentDetailMutations } from './useContentDetailMutations';
import type { WorkflowHandlers } from './types';

interface WorkflowHandlerOptions<TFormData extends FieldValues> {
  setValue: UseFormSetValue<TFormData>;
  /** Persists the form (fire-and-forget). */
  save: () => Promise<void>;
  dispatch: Dispatch<ContentDetailUIAction>;
  reviewMutation: ContentDetailMutations['reviewMutation'];
  markPublishing: () => void;
  onPublishStart?: () => void;
}

/**
 * Editorial workflow transitions for the editor toolbar and dialogs. Status
 * changes are written into the form and saved; review decisions go through
 * the review endpoint; confirm-style actions open their dialog first.
 */
export function useWorkflowHandlers<TFormData extends FieldValues>({
  setValue,
  save,
  dispatch,
  reviewMutation,
  markPublishing,
  onPublishStart,
}: WorkflowHandlerOptions<TFormData>): WorkflowHandlers {
  const setStatusAndSave = useCallback(
    (status: ContentStatus) => {
      setValue('status' as never, status as never, { shouldDirty: true });
      void save();
    },
    [setValue, save],
  );

  return useMemo(
    () => ({
      handleSubmitForReview: () => setStatusAndSave('InReview'),
      handleApproveClick: () => dispatch({ type: 'setApproveDialogOpen', value: true }),
      handleApprovePublishNow: () => {
        dispatch({ type: 'setApproveDialogOpen', value: false });
        reviewMutation.mutate({ action: 'approve' });
      },
      handleApproveSchedule: (date: string) => {
        dispatch({ type: 'setApproveDialogOpen', value: false });
        setValue('publish_start' as never, date as never, { shouldDirty: true });
        reviewMutation.mutate({ action: 'approve' });
      },
      handleRequestChanges: () => dispatch({ type: 'setReviewDialogOpen', value: true }),
      handleReviewCommentSubmit: (comment?: string) => {
        dispatch({ type: 'setReviewDialogOpen', value: false });
        reviewMutation.mutate({ action: 'request_changes', comment });
      },
      handlePublish: () => {
        markPublishing();
        onPublishStart?.();
        setStatusAndSave('Published');
      },
      handleUnpublish: () => {
        setValue('status' as never, 'Draft' as never, { shouldDirty: true });
        setValue('publish_start' as never, null as never, { shouldDirty: true });
        setValue('publish_end' as never, null as never, { shouldDirty: true });
        void save();
      },
      handleArchiveClick: () => dispatch({ type: 'setArchiveDialogOpen', value: true }),
      handleArchiveConfirm: () => {
        dispatch({ type: 'setArchiveDialogOpen', value: false });
        setStatusAndSave('Archived');
      },
      handleRestoreClick: () => dispatch({ type: 'setRestoreDialogOpen', value: true }),
      handleRestore: () => {
        dispatch({ type: 'setRestoreDialogOpen', value: false });
        setStatusAndSave('Published');
      },
      handleRestoreAsDraft: () => {
        dispatch({ type: 'setRestoreDialogOpen', value: false });
        setStatusAndSave('Draft');
      },
    }),
    [dispatch, setValue, setStatusAndSave, save, reviewMutation, markPublishing, onPublishStart],
  );
}
