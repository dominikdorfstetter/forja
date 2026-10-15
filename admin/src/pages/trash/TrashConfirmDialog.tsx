import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export type TrashConfirmAction = 'delete' | 'deleteAll';

interface TrashConfirmDialogProps {
  action: TrashConfirmAction | null;
  /** Items on the current page — what "empty trash" will remove. */
  itemCount: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for the irreversible deletes: the selection, or the whole (loaded) trash. */
export default function TrashConfirmDialog({
  action,
  itemCount,
  loading,
  onConfirm,
  onCancel,
}: TrashConfirmDialogProps) {
  const { t } = useTranslation();
  const emptyAll = action === 'deleteAll';
  const actionLabel = emptyAll ? t('trash.emptyTrash') : t('trash.permanentDelete');

  return (
    <ConfirmDialog
      open={!!action}
      title={actionLabel}
      message={
        emptyAll
          ? t('trash.emptyTrashConfirm', { count: itemCount })
          : t('trash.permanentDeleteConfirm')
      }
      confirmLabel={actionLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
