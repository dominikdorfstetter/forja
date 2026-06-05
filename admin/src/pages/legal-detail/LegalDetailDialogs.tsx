import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RestoreDialog from '@/components/shared/RestoreDialog';
import HistoryDrawer from '@/components/shared/HistoryDrawer';

interface LegalDetailDialogsProps {
  legalId: string;
  legalSlug: string;
  isSaving: boolean;

  historyOpen: boolean;
  onHistoryClose: () => void;

  archiveDialogOpen: boolean;
  onArchiveConfirm: () => void;
  onArchiveCancel: () => void;

  restoreDialogOpen: boolean;
  onRestore: () => void;
  onRestoreAsDraft: () => void;
  onRestoreCancel: () => void;
}

export default function LegalDetailDialogs({
  legalId,
  legalSlug,
  isSaving,
  historyOpen,
  onHistoryClose,
  archiveDialogOpen,
  onArchiveConfirm,
  onArchiveCancel,
  restoreDialogOpen,
  onRestore,
  onRestoreAsDraft,
  onRestoreCancel,
}: LegalDetailDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <HistoryDrawer
        open={historyOpen}
        onClose={onHistoryClose}
        entityType="legal"
        entityId={legalId}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        title={t('legalDetail.archiveDialog.title')}
        message={t('legalDetail.archiveDialog.message', { slug: legalSlug })}
        confirmLabel={t('workflow.archive')}
        confirmColor="warning"
        onConfirm={onArchiveConfirm}
        onCancel={onArchiveCancel}
        loading={isSaving}
      />

      <RestoreDialog
        open={restoreDialogOpen}
        title={t('legalDetail.restoreDialog.title')}
        message={t('legalDetail.restoreDialog.message', { slug: legalSlug })}
        onRestore={onRestore}
        onRestoreAsDraft={onRestoreAsDraft}
        onCancel={onRestoreCancel}
        loading={isSaving}
      />
    </>
  );
}
