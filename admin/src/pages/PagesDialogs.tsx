import { useTranslation } from 'react-i18next';
import type { PageListItem } from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';

interface PagesDialogsProps {
  // Single-item dialogs
  publishingPage: PageListItem | null;
  onPublishConfirm: () => void;
  onPublishCancel: () => void;

  unpublishingPage: PageListItem | null;
  onUnpublishConfirm: () => void;
  onUnpublishCancel: () => void;

  archivingPage: PageListItem | null;
  onArchiveConfirm: () => void;
  onArchiveCancel: () => void;

  restoringPage: PageListItem | null;
  onRestorePublish: () => void;
  onRestoreAsDraft: () => void;
  onRestoreCancel: () => void;

  deletingPage: PageListItem | null;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  deleteLoading: boolean;

  // Bulk dialogs
  bulkCount: number;
  bulkDeleteOpen: boolean;
  bulkPublishOpen: boolean;
  bulkUnpublishOpen: boolean;
  bulkArchiveOpen: boolean;
  bulkRestoreOpen: boolean;
  onBulkDeleteConfirm: () => void;
  onBulkPublishConfirm: () => void;
  onBulkUnpublishConfirm: () => void;
  onBulkArchiveConfirm: () => void;
  onBulkRestoreConfirm: () => void;
  onBulkCancel: () => void;
  bulkLoading: boolean;
}

export default function PagesDialogs({
  publishingPage,
  onPublishConfirm,
  onPublishCancel,
  unpublishingPage,
  onUnpublishConfirm,
  onUnpublishCancel,
  archivingPage,
  onArchiveConfirm,
  onArchiveCancel,
  restoringPage,
  onRestorePublish,
  onRestoreAsDraft,
  onRestoreCancel,
  deletingPage,
  onDeleteConfirm,
  onDeleteCancel,
  deleteLoading,
  bulkCount,
  bulkDeleteOpen,
  bulkPublishOpen,
  bulkUnpublishOpen,
  bulkArchiveOpen,
  bulkRestoreOpen,
  onBulkDeleteConfirm,
  onBulkPublishConfirm,
  onBulkUnpublishConfirm,
  onBulkArchiveConfirm,
  onBulkRestoreConfirm,
  onBulkCancel,
  bulkLoading,
}: PagesDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <ConfirmDialog open={!!deletingPage} title={t('pages.deleteDialog.title')} message={t('pages.deleteDialog.message', { route: deletingPage?.route })} confirmLabel={t('common.actions.delete')} onConfirm={onDeleteConfirm} onCancel={onDeleteCancel} loading={deleteLoading} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={!!publishingPage} title={t('pages.publishDialog.title')} message={t('pages.publishDialog.message', { route: publishingPage?.route })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={onPublishConfirm} onCancel={onPublishCancel} />
      <ConfirmDialog open={!!unpublishingPage} title={t('pages.unpublishDialog.title')} message={t('pages.unpublishDialog.message', { route: unpublishingPage?.route })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={onUnpublishConfirm} onCancel={onUnpublishCancel} />
      <ConfirmDialog open={!!archivingPage} title={t('pages.archiveDialog.title')} message={t('pages.archiveDialog.message', { route: archivingPage?.route })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={onArchiveConfirm} onCancel={onArchiveCancel} />
      <RestoreDialog open={!!restoringPage} title={t('pages.restoreDialog.title')} message={t('pages.restoreDialog.message', { route: restoringPage?.route })} onRestore={onRestorePublish} onRestoreAsDraft={onRestoreAsDraft} onCancel={onRestoreCancel} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulkCount })} confirmLabel={t('common.actions.delete')} onConfirm={onBulkDeleteConfirm} onCancel={onBulkCancel} loading={bulkLoading} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={bulkPublishOpen} title={t('bulk.publishDialog.title')} message={t('bulk.publishDialog.message', { count: bulkCount })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={onBulkPublishConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
      <ConfirmDialog open={bulkUnpublishOpen} title={t('bulk.unpublishDialog.title')} message={t('bulk.unpublishDialog.message', { count: bulkCount })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={onBulkUnpublishConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
      <ConfirmDialog open={bulkArchiveOpen} title={t('bulk.archiveDialog.title')} message={t('bulk.archiveDialog.message', { count: bulkCount })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={onBulkArchiveConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
      <ConfirmDialog open={bulkRestoreOpen} title={t('bulk.restoreDialog.title')} message={t('bulk.restoreDialog.message', { count: bulkCount })} confirmLabel={t('bulk.restore')} confirmColor="primary" onConfirm={onBulkRestoreConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
    </>
  );
}
