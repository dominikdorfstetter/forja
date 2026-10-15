import { Checkbox, FormControlLabel } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { MediaListItem } from '@/types/api';

interface MediaDeleteFileDialogProps {
  file: MediaListItem | null;
  /** Admins may force-delete media that is still referenced. */
  isAdmin: boolean;
  forceDelete: boolean;
  onForceDeleteChange: (force: boolean) => void;
  loading: boolean;
  onConfirm: (file: MediaListItem) => void;
  onCancel: () => void;
}

export default function MediaDeleteFileDialog({
  file,
  isAdmin,
  forceDelete,
  onForceDeleteChange,
  loading,
  onConfirm,
  onCancel,
}: MediaDeleteFileDialogProps) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={!!file}
      title={t('media.deleteDialog.title')}
      message={t('media.deleteDialog.message', { filename: file?.original_filename })}
      confirmLabel={t('common.actions.delete')}
      onConfirm={() => file && onConfirm(file)}
      onCancel={onCancel}
      loading={loading}
    >
      {isAdmin && (
        <FormControlLabel
          control={<Checkbox checked={forceDelete} onChange={(e) => onForceDeleteChange(e.target.checked)} size="small" />}
          label={t('media.deleteDialog.forceDelete', 'Force delete (even if in use)')}
          sx={{ mt: 1 }}
        />
      )}
    </ConfirmDialog>
  );
}
