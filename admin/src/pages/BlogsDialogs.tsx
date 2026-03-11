import { useTranslation } from 'react-i18next';
import type { BlogListItem } from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';

interface BlogsDialogsProps {
  // Single-item dialogs
  publishingBlog: BlogListItem | null;
  onPublishConfirm: () => void;
  onPublishCancel: () => void;

  unpublishingBlog: BlogListItem | null;
  onUnpublishConfirm: () => void;
  onUnpublishCancel: () => void;

  archivingBlog: BlogListItem | null;
  onArchiveConfirm: () => void;
  onArchiveCancel: () => void;

  restoringBlog: BlogListItem | null;
  onRestorePublish: () => void;
  onRestoreAsDraft: () => void;
  onRestoreCancel: () => void;

  deletingBlog: BlogListItem | null;
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

export default function BlogsDialogs({
  publishingBlog,
  onPublishConfirm,
  onPublishCancel,
  unpublishingBlog,
  onUnpublishConfirm,
  onUnpublishCancel,
  archivingBlog,
  onArchiveConfirm,
  onArchiveCancel,
  restoringBlog,
  onRestorePublish,
  onRestoreAsDraft,
  onRestoreCancel,
  deletingBlog,
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
}: BlogsDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <ConfirmDialog open={!!deletingBlog} title={t('blogs.deleteDialog.title')} message={t('blogs.deleteDialog.message', { slug: deletingBlog?.slug })} confirmLabel={t('common.actions.delete')} onConfirm={onDeleteConfirm} onCancel={onDeleteCancel} loading={deleteLoading} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={!!publishingBlog} title={t('blogs.publishDialog.title')} message={t('blogs.publishDialog.message', { slug: publishingBlog?.slug })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={onPublishConfirm} onCancel={onPublishCancel} />
      <ConfirmDialog open={!!unpublishingBlog} title={t('blogs.unpublishDialog.title')} message={t('blogs.unpublishDialog.message', { slug: unpublishingBlog?.slug })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={onUnpublishConfirm} onCancel={onUnpublishCancel} />
      <ConfirmDialog open={!!archivingBlog} title={t('blogs.archiveDialog.title')} message={t('blogs.archiveDialog.message', { slug: archivingBlog?.slug })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={onArchiveConfirm} onCancel={onArchiveCancel} />
      <RestoreDialog open={!!restoringBlog} title={t('blogs.restoreDialog.title')} message={t('blogs.restoreDialog.message', { slug: restoringBlog?.slug })} onRestore={onRestorePublish} onRestoreAsDraft={onRestoreAsDraft} onCancel={onRestoreCancel} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulkCount })} confirmLabel={t('common.actions.delete')} onConfirm={onBulkDeleteConfirm} onCancel={onBulkCancel} loading={bulkLoading} confirmationText={t('common.actions.delete')} />
      <ConfirmDialog open={bulkPublishOpen} title={t('bulk.publishDialog.title')} message={t('bulk.publishDialog.message', { count: bulkCount })} confirmLabel={t('bulk.publish')} confirmColor="primary" onConfirm={onBulkPublishConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
      <ConfirmDialog open={bulkUnpublishOpen} title={t('bulk.unpublishDialog.title')} message={t('bulk.unpublishDialog.message', { count: bulkCount })} confirmLabel={t('bulk.unpublish')} confirmColor="warning" onConfirm={onBulkUnpublishConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
      <ConfirmDialog open={bulkArchiveOpen} title={t('bulk.archiveDialog.title')} message={t('bulk.archiveDialog.message', { count: bulkCount })} confirmLabel={t('bulk.archive')} confirmColor="warning" onConfirm={onBulkArchiveConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
      <ConfirmDialog open={bulkRestoreOpen} title={t('bulk.restoreDialog.title')} message={t('bulk.restoreDialog.message', { count: bulkCount })} confirmLabel={t('bulk.restore')} confirmColor="primary" onConfirm={onBulkRestoreConfirm} onCancel={onBulkCancel} loading={bulkLoading} />
    </>
  );
}
