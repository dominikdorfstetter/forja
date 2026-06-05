import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';
import type { DialogsSlotProps } from './types';

/**
 * How an entity's restore row-action behaves:
 * - `publishOrDraft`: a {@link RestoreDialog} offering "restore (published)"
 *   and "restore as draft" (blogs, pages).
 * - `confirmDraft`: a single {@link ConfirmDialog} that restores to draft,
 *   reusing the bulk restore copy (legal documents).
 */
export type RestoreVariant = 'publishOrDraft' | 'confirmDraft';

export interface ContentEntityDescriptor<TItem> {
  /** i18n namespace owning the per-row dialog copy (`<ns>.{action}Dialog.*`). */
  i18nNamespace: string;
  /** Item field whose value names the entity in the confirm message. */
  identifierField: keyof TItem & string;
  /** Restore row-action shape — see {@link RestoreVariant}. */
  restore: RestoreVariant;
}

interface ContentEntityDialogsProps<TItem> extends DialogsSlotProps<TItem> {
  descriptor: ContentEntityDescriptor<TItem>;
}

/**
 * The single home for the publish / unpublish / archive / restore / delete
 * (+ bulk) confirm dialogs of a content entity, driven directly by the dialog
 * state `EntityListPage` already owns ({@link DialogsSlotProps}).
 *
 * Replaces the per-entity `*Dialogs.tsx` files, which were a ~41-prop
 * cross-product identical except namespace, identifier field, and restore
 * shape — the three knobs now carried by {@link ContentEntityDescriptor}.
 *
 * The single-item confirm copy interpolates the entity identifier. Locale
 * templates use different variable names per entity (`slug`/`route`/
 * `cookieName`/`name`), so the resolved value is passed under every alias —
 * i18next ignores the ones a given template doesn't reference, keeping the
 * copy unchanged with no locale churn.
 */
export default function ContentEntityDialogs<TItem>({
  rowState,
  rowActions,
  bulkState,
  bulkActions,
  bulkCount,
  bulkLoading,
  onRowConfirmStatus,
  onRowConfirmDelete,
  onBulkConfirm,
  deletingItem,
  onDeleteCancel,
  deleteLoading,
  descriptor,
}: ContentEntityDialogsProps<TItem>) {
  const { t } = useTranslation();
  const { i18nNamespace: ns, identifierField, restore } = descriptor;

  const idVars = (item: TItem | null) => {
    const value = item ? String(item[identifierField] ?? '') : '';
    return { slug: value, route: value, name: value, cookieName: value };
  };

  const confirmStatus = (item: TItem | null, status: 'Published' | 'Draft' | 'Archived', close: () => void) => {
    if (item) {
      onRowConfirmStatus(item, status);
      close();
    }
  };

  return (
    <>
      <ConfirmDialog
        open={!!deletingItem}
        title={t(`${ns}.deleteDialog.title`)}
        message={t(`${ns}.deleteDialog.message`, idVars(deletingItem))}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingItem && onRowConfirmDelete(deletingItem)}
        onCancel={onDeleteCancel}
        loading={deleteLoading}
      />
      <ConfirmDialog
        open={!!rowState.publishingItem}
        title={t(`${ns}.publishDialog.title`)}
        message={t(`${ns}.publishDialog.message`, idVars(rowState.publishingItem))}
        confirmLabel={t('bulk.publish')}
        confirmColor="primary"
        onConfirm={() => confirmStatus(rowState.publishingItem, 'Published', rowActions.closePublish)}
        onCancel={rowActions.closePublish}
      />
      <ConfirmDialog
        open={!!rowState.unpublishingItem}
        title={t(`${ns}.unpublishDialog.title`)}
        message={t(`${ns}.unpublishDialog.message`, idVars(rowState.unpublishingItem))}
        confirmLabel={t('bulk.unpublish')}
        confirmColor="warning"
        onConfirm={() => confirmStatus(rowState.unpublishingItem, 'Draft', rowActions.closeUnpublish)}
        onCancel={rowActions.closeUnpublish}
      />
      <ConfirmDialog
        open={!!rowState.archivingItem}
        title={t(`${ns}.archiveDialog.title`)}
        message={t(`${ns}.archiveDialog.message`, idVars(rowState.archivingItem))}
        confirmLabel={t('bulk.archive')}
        confirmColor="warning"
        onConfirm={() => confirmStatus(rowState.archivingItem, 'Archived', rowActions.closeArchive)}
        onCancel={rowActions.closeArchive}
      />

      {restore === 'publishOrDraft' ? (
        <RestoreDialog
          open={!!rowState.restoringItem}
          title={t(`${ns}.restoreDialog.title`)}
          message={t(`${ns}.restoreDialog.message`, idVars(rowState.restoringItem))}
          onRestore={() => confirmStatus(rowState.restoringItem, 'Published', rowActions.closeRestore)}
          onRestoreAsDraft={() => confirmStatus(rowState.restoringItem, 'Draft', rowActions.closeRestore)}
          onCancel={rowActions.closeRestore}
        />
      ) : (
        <ConfirmDialog
          open={!!rowState.restoringItem}
          title={t('bulk.restoreDialog.title')}
          message={t('bulk.restoreDialog.message', { count: 1 })}
          confirmLabel={t('bulk.restore')}
          confirmColor="primary"
          onConfirm={() => confirmStatus(rowState.restoringItem, 'Draft', rowActions.closeRestore)}
          onCancel={rowActions.closeRestore}
        />
      )}

      <ConfirmDialog
        open={bulkState.bulkDeleteOpen}
        title={t('bulk.deleteDialog.title')}
        message={t('bulk.deleteDialog.message', { count: bulkCount })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => onBulkConfirm('delete')}
        onCancel={bulkActions.closeAllBulk}
        loading={bulkLoading}
      />
      <ConfirmDialog
        open={bulkState.bulkPublishOpen}
        title={t('bulk.publishDialog.title')}
        message={t('bulk.publishDialog.message', { count: bulkCount })}
        confirmLabel={t('bulk.publish')}
        confirmColor="primary"
        onConfirm={() => onBulkConfirm('publish')}
        onCancel={bulkActions.closeAllBulk}
        loading={bulkLoading}
      />
      <ConfirmDialog
        open={bulkState.bulkUnpublishOpen}
        title={t('bulk.unpublishDialog.title')}
        message={t('bulk.unpublishDialog.message', { count: bulkCount })}
        confirmLabel={t('bulk.unpublish')}
        confirmColor="warning"
        onConfirm={() => onBulkConfirm('unpublish')}
        onCancel={bulkActions.closeAllBulk}
        loading={bulkLoading}
      />
      <ConfirmDialog
        open={bulkState.bulkArchiveOpen}
        title={t('bulk.archiveDialog.title')}
        message={t('bulk.archiveDialog.message', { count: bulkCount })}
        confirmLabel={t('bulk.archive')}
        confirmColor="warning"
        onConfirm={() => onBulkConfirm('archive')}
        onCancel={bulkActions.closeAllBulk}
        loading={bulkLoading}
      />
      <ConfirmDialog
        open={bulkState.bulkRestoreOpen}
        title={t('bulk.restoreDialog.title')}
        message={t('bulk.restoreDialog.message', { count: bulkCount })}
        confirmLabel={t('bulk.restore')}
        confirmColor="primary"
        onConfirm={() => onBulkConfirm('restore')}
        onCancel={bulkActions.closeAllBulk}
        loading={bulkLoading}
      />
    </>
  );
}
