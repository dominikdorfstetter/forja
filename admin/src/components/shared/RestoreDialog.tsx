import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import { useTranslation } from 'react-i18next';

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
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="restore-dialog-title" aria-describedby="restore-dialog-description" data-testid="restore-dialog">
      <Box
        sx={(theme: Theme) => ({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        })}
      >
        <UnarchiveIcon sx={{ fontSize: 40, color: 'primary.main' }} />
      </Box>
      <DialogTitle id="restore-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="restore-dialog-description">{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading} data-testid="restore-dialog.btn.cancel">
          {t('common.actions.cancel')}
        </Button>
        <Button variant="outlined" onClick={onRestoreAsDraft} disabled={loading} data-testid="restore-dialog.btn.restore-draft">
          {t('restoreDialog.restoreAsDraft')}
        </Button>
        <Button variant="contained" onClick={onRestore} disabled={loading} data-testid="restore-dialog.btn.restore">
          {t('restoreDialog.restore')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
