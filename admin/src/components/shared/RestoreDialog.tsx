import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

interface RestoreDialogProps {
  open: boolean;
  title: string;
  message: string;
  onRestore: () => void;
  onRestoreAsDraft: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function RestoreDialog({
  open,
  title,
  message,
  onRestore,
  onRestoreAsDraft,
  onCancel,
  loading,
}: RestoreDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={open}
      onClose={onCancel}
      icon="unarchive"
      title={title}
      subtitle={message}
      maxWidth="xs"
      data-testid="restore-dialog"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={onCancel} disabled={loading} data-testid="restore-dialog.btn.cancel">
            {t('common.actions.cancel')}
          </M3Button>
          <M3Button variant="outlined" size="sm" onClick={onRestoreAsDraft} disabled={loading} data-testid="restore-dialog.btn.restore-draft">
            {t('restoreDialog.restoreAsDraft')}
          </M3Button>
          <M3Button variant="filled" size="sm" onClick={onRestore} disabled={loading} data-testid="restore-dialog.btn.restore">
            {t('restoreDialog.restore')}
          </M3Button>
        </>
      }
    >
      {null}
    </FormDialog>
  );
}
