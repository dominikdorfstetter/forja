import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'error' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmationText?: string;
}

const severityConfig = {
  error: {
    Icon: ErrorOutlineIcon,
    paletteKey: 'error' as const,
    bgAlpha: 0.08,
    borderAlpha: 0.3,
  },
  warning: {
    Icon: WarningAmberIcon,
    paletteKey: 'warning' as const,
    bgAlpha: 0.08,
    borderAlpha: 0.3,
  },
  primary: null,
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmColor = 'error',
  onConfirm,
  onCancel,
  loading,
  confirmationText,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (!open) setTypedValue('');
  }, [open]);

  const isConfirmDisabled = loading || (!!confirmationText && typedValue.toLowerCase() !== confirmationText.toLowerCase());
  const severity = severityConfig[confirmColor];

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" data-testid="confirm-dialog">
      {severity && (
        <Box sx={(theme: Theme) => {
          const color = theme.palette[severity.paletteKey].main;
          return {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 2,
            bgcolor: alpha(color, severity.bgAlpha),
            borderBottom: `1px solid ${alpha(color, severity.borderAlpha)}`,
          };
        }}>
          <severity.Icon sx={{ fontSize: 40, color: `${severity.paletteKey}.main` }} />
        </Box>
      )}
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">{message}</DialogContentText>
        {confirmationText && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 2 }}
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            helperText={t('common.confirmDialog.typeToConfirm', { word: confirmationText })}
            aria-label={t('shared.confirmDialog.confirmationInput')}
            data-testid="confirm-dialog.input.confirmation"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading} data-testid="confirm-dialog.btn.cancel">{t('common.actions.cancel')}</Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={isConfirmDisabled} data-testid="confirm-dialog.btn.confirm">
          {loading ? t('common.actions.loading') : (confirmLabel || t('common.actions.confirm'))}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
