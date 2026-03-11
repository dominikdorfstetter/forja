import type { UseFormSetValue } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ReviewActionRequest } from '@/types/api';
import type { PageDetailFormData } from './pageDetailSchema';
import type { PageDetailUIAction } from './PageDetailReducer';

interface WorkflowDeps {
  setValue: UseFormSetValue<PageDetailFormData>;
  flush: () => Promise<void> | void;
  uiDispatch: React.Dispatch<PageDetailUIAction>;
  reviewPageMutation: UseMutationResult<{ message: string }, Error, ReviewActionRequest>;
}

export function createWorkflowHandlers({ setValue, flush, uiDispatch, reviewPageMutation }: WorkflowDeps) {
  const handleSubmitForReview = () => {
    setValue('status', 'InReview' as PageDetailFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleApproveClick = () => {
    uiDispatch({ type: 'SET_APPROVE_DIALOG', payload: true });
  };

  const handleApprovePublishNow = () => {
    uiDispatch({ type: 'SET_APPROVE_DIALOG', payload: false });
    reviewPageMutation.mutate({ action: 'approve' });
  };

  const handleApproveSchedule = (date: string) => {
    uiDispatch({ type: 'SET_APPROVE_DIALOG', payload: false });
    setValue('publish_start', date, { shouldDirty: true });
    reviewPageMutation.mutate({ action: 'approve' });
  };

  const handleRequestChanges = () => {
    uiDispatch({ type: 'SET_REVIEW_DIALOG', payload: true });
  };

  const handleReviewCommentSubmit = (comment?: string) => {
    uiDispatch({ type: 'SET_REVIEW_DIALOG', payload: false });
    reviewPageMutation.mutate({ action: 'request_changes', comment });
  };

  const handlePublish = () => {
    setValue('status', 'Published' as PageDetailFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleUnpublish = () => {
    setValue('status', 'Draft' as PageDetailFormData['status'], { shouldDirty: true });
    setValue('publish_start', null, { shouldDirty: true });
    setValue('publish_end', null, { shouldDirty: true });
    flush();
  };

  const handleArchiveClick = () => {
    uiDispatch({ type: 'SET_ARCHIVE_DIALOG', payload: true });
  };

  const handleArchiveConfirm = () => {
    uiDispatch({ type: 'SET_ARCHIVE_DIALOG', payload: false });
    setValue('status', 'Archived' as PageDetailFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleRestoreClick = () => {
    uiDispatch({ type: 'SET_RESTORE_DIALOG', payload: true });
  };

  const handleRestore = () => {
    uiDispatch({ type: 'SET_RESTORE_DIALOG', payload: false });
    setValue('status', 'Published' as PageDetailFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleRestoreAsDraft = () => {
    uiDispatch({ type: 'SET_RESTORE_DIALOG', payload: false });
    setValue('status', 'Draft' as PageDetailFormData['status'], { shouldDirty: true });
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
