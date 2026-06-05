import { useState } from 'react';
import { Box } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

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
    <FormDialog
      open={open}
      onClose={handleClose}
      icon="check_circle"
      title={t('approveDialog.title')}
      subtitle={t('approveDialog.message')}
      maxWidth="xs"
      data-testid="approve-dialog"
      actions={
        <>
          <M3Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={loading}
            data-testid="approve-dialog.btn.cancel"
          >
            {t('common.actions.cancel')}
          </M3Button>
          {showDatePicker ? (
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleScheduleConfirm}
              disabled={loading || !scheduleDate}
            >
              {t('common.actions.confirm')}
            </M3Button>
          ) : (
            <>
              <M3Button
                variant="outlined"
                size="sm"
                onClick={() => setShowDatePicker(true)}
                disabled={loading}
                data-testid="approve-dialog.btn.schedule"
              >
                {t('approveDialog.schedule')}
              </M3Button>
              <M3Button
                variant="filled"
                size="sm"
                onClick={onPublishNow}
                disabled={loading}
                data-testid="approve-dialog.btn.publish-now"
              >
                {t('approveDialog.publishNow')}
              </M3Button>
            </>
          )}
        </>
      }
    >
      {showDatePicker && (
        <Box>
          <DateTimePicker
            label={t('approveDialog.selectDate')}
            value={scheduleDate}
            onChange={setScheduleDate}
            minDateTime={new Date()}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
        </Box>
      )}
    </FormDialog>
  );
}
