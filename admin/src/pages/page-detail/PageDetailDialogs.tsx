import { useTranslation } from 'react-i18next';
import ReviewCommentDialog from '@/components/shared/ReviewCommentDialog';
import ApproveDialog from '@/components/shared/ApproveDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';
import HistoryDrawer from '@/components/shared/HistoryDrawer';

interface PageDetailDialogsProps {
  pageId: string;
  pageRoute: string;
  isSaving: boolean;

  historyOpen: boolean;
  onHistoryClose: () => void;

  reviewDialogOpen: boolean;
  onReviewDialogClose: () => void;
  onReviewCommentSubmit: (comment?: string) => void;
  reviewLoading: boolean;

  approveDialogOpen: boolean;
  onApprovePublishNow: () => void;
  onApproveSchedule: (date: string) => void;
  onApproveCancel: () => void;
  approveLoading: boolean;

  archiveDialogOpen: boolean;
  onArchiveConfirm: () => void;
  onArchiveCancel: () => void;

  restoreDialogOpen: boolean;
  onRestore: () => void;
  onRestoreAsDraft: () => void;
  onRestoreCancel: () => void;
}

export default function PageDetailDialogs({
  pageId,
  pageRoute,
  isSaving,
  historyOpen,
  onHistoryClose,
  reviewDialogOpen,
  onReviewDialogClose,
  onReviewCommentSubmit,
  reviewLoading,
  approveDialogOpen,
  onApprovePublishNow,
  onApproveSchedule,
  onApproveCancel,
  approveLoading,
  archiveDialogOpen,
  onArchiveConfirm,
  onArchiveCancel,
  restoreDialogOpen,
  onRestore,
  onRestoreAsDraft,
  onRestoreCancel,
}: PageDetailDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <HistoryDrawer
        open={historyOpen}
        onClose={onHistoryClose}
        entityType="page"
        entityId={pageId}
      />

      <ReviewCommentDialog
        open={reviewDialogOpen}
        title={t('workflow.requestChanges')}
        onClose={onReviewDialogClose}
        onSubmit={onReviewCommentSubmit}
        loading={reviewLoading}
      />

      <ApproveDialog
        open={approveDialogOpen}
        onPublishNow={onApprovePublishNow}
        onSchedule={onApproveSchedule}
        onCancel={onApproveCancel}
        loading={approveLoading}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        title={t('pages.archiveDialog.title')}
        message={t('pages.archiveDialog.message', { route: pageRoute })}
        confirmLabel={t('workflow.archive')}
        confirmColor="warning"
        onConfirm={onArchiveConfirm}
        onCancel={onArchiveCancel}
        loading={isSaving}
      />

      <RestoreDialog
        open={restoreDialogOpen}
        title={t('pages.restoreDialog.title')}
        message={t('pages.restoreDialog.message', { route: pageRoute })}
        onRestore={onRestore}
        onRestoreAsDraft={onRestoreAsDraft}
        onCancel={onRestoreCancel}
        loading={isSaving}
      />
    </>
  );
}
