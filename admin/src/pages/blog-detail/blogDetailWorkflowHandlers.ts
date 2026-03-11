import type { UseFormSetValue } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ReviewActionRequest } from '@/types/api';
import type { BlogContentFormData } from './blogDetailSchema';
import type { UIAction } from './BlogDetailReducer';

interface WorkflowDeps {
  setValue: UseFormSetValue<BlogContentFormData>;
  flush: () => Promise<void> | void;
  dispatch: React.Dispatch<UIAction>;
  reviewBlogMutation: UseMutationResult<{ message: string }, Error, ReviewActionRequest>;
}

export function createBlogWorkflowHandlers({ setValue, flush, dispatch, reviewBlogMutation }: WorkflowDeps) {
  const handleSubmitForReview = () => {
    setValue('status', 'InReview' as BlogContentFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleApproveClick = () => dispatch({ type: 'setApproveDialogOpen', value: true });

  const handleApprovePublishNow = () => {
    dispatch({ type: 'setApproveDialogOpen', value: false });
    reviewBlogMutation.mutate({ action: 'approve' });
  };

  const handleApproveSchedule = (date: string) => {
    dispatch({ type: 'setApproveDialogOpen', value: false });
    setValue('publish_start', date, { shouldDirty: true });
    reviewBlogMutation.mutate({ action: 'approve' });
  };

  const handleRequestChanges = () => dispatch({ type: 'setReviewDialogOpen', value: true });

  const handleReviewCommentSubmit = (comment?: string) => {
    dispatch({ type: 'setReviewDialogOpen', value: false });
    reviewBlogMutation.mutate({ action: 'request_changes', comment });
  };

  const handlePublish = () => {
    setValue('status', 'Published' as BlogContentFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleUnpublish = () => {
    setValue('status', 'Draft' as BlogContentFormData['status'], { shouldDirty: true });
    setValue('publish_start', null, { shouldDirty: true });
    setValue('publish_end', null, { shouldDirty: true });
    flush();
  };

  const handleArchiveClick = () => dispatch({ type: 'setArchiveDialogOpen', value: true });

  const handleArchiveConfirm = () => {
    dispatch({ type: 'setArchiveDialogOpen', value: false });
    setValue('status', 'Archived' as BlogContentFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleRestoreClick = () => dispatch({ type: 'setRestoreDialogOpen', value: true });

  const handleRestore = () => {
    dispatch({ type: 'setRestoreDialogOpen', value: false });
    setValue('status', 'Published' as BlogContentFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleRestoreAsDraft = () => {
    dispatch({ type: 'setRestoreDialogOpen', value: false });
    setValue('status', 'Draft' as BlogContentFormData['status'], { shouldDirty: true });
    flush();
  };

  return {
    handleSubmitForReview,
    handleApproveClick,
    handleApprovePublishNow,
    handleApproveSchedule,
    handleRequestChanges,
    handleReviewCommentSubmit,
    handlePublish,
    handleUnpublish,
    handleArchiveClick,
    handleArchiveConfirm,
    handleRestoreClick,
    handleRestore,
    handleRestoreAsDraft,
  };
}
