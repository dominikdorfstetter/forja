import { useState } from 'react';
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useTranslation } from 'react-i18next';

interface ApproveDialogProps {
  open: boolean;
  onPublishNow: () => void;
  onSchedule: (date: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ApproveDialog({
  open,
  onPublishNow,
  onSchedule,
  onCancel,
  loading,
}: ApproveDialogProps) {
  const { t } = useTranslation();
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleClose = () => {
    setScheduleDate(null);
    setShowDatePicker(false);
    onCancel();
  };

  const handleScheduleConfirm = () => {
    if (scheduleDate) {
      onSchedule(scheduleDate.toISOString());
      setScheduleDate(null);
      setShowDatePicker(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth aria-labelledby="approve-dialog-title" aria-describedby="approve-dialog-description" data-testid="approve-dialog">
      <Box
        sx={(theme: Theme) => ({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
          bgcolor: alpha(theme.palette.success.main, 0.08),
          borderBottom: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
        })}
      >
        <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
      </Box>
      <DialogTitle id="approve-dialog-title">{t('approveDialog.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="approve-dialog-description">{t('approveDialog.message')}</DialogContentText>
        {showDatePicker && (
          <Box sx={{ mt: 2 }}>
            <DateTimePicker
              label={t('approveDialog.selectDate')}
              value={scheduleDate}
              onChange={setScheduleDate}
              minDateTime={new Date()}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading} data-testid="approve-dialog.btn.cancel">
          {t('common.actions.cancel')}
        </Button>
        {showDatePicker ? (
          <Button
            variant="contained"
            onClick={handleScheduleConfirm}
            disabled={loading || !scheduleDate}
          >
            {t('common.actions.confirm')}
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              onClick={() => setShowDatePicker(true)}
              disabled={loading}
              data-testid="approve-dialog.btn.schedule"
            >
              {t('approveDialog.schedule')}
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={onPublishNow}
              disabled={loading}
              data-testid="approve-dialog.btn.publish-now"
            >
              {t('approveDialog.publishNow')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
