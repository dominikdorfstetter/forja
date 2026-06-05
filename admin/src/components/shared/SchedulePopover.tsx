import {
  Button,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useTranslation } from 'react-i18next';

interface SchedulePopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  publishStart?: string | null;
  publishEnd?: string | null;
  onPublishStartChange: (iso: string | null) => void;
  onPublishEndChange: (iso: string | null) => void;
  onClear: () => void;
}

export default function SchedulePopover({
  anchorEl,
  onClose,
  publishStart,
  publishEnd,
  onPublishStartChange,
  onPublishEndChange,
  onClear,
}: SchedulePopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Stack spacing={2} sx={{ p: 2, minWidth: 300 }}>
        <Typography variant="subtitle2">{t('scheduling.publishAt')}</Typography>
        <DateTimePicker
          label={t('scheduling.publishAt')}
          value={publishStart ? new Date(publishStart) : null}
          onChange={(date) => {
            onPublishStartChange(date ? date.toISOString() : null);
          }}
          slotProps={{ textField: { size: 'small', fullWidth: true } }}
        />
        <DateTimePicker
          label={t('scheduling.unpublishAt')}
          value={publishEnd ? new Date(publishEnd) : null}
          onChange={(date) => {
            onPublishEndChange(date ? date.toISOString() : null);
          }}
          slotProps={{ textField: { size: 'small', fullWidth: true } }}
        />
        <Button
          size="small"
          startIcon={<ClearIcon />}
          onClick={onClear}
          disabled={!publishStart && !publishEnd}
        >
          {t('scheduling.clearSchedule')}
        </Button>
      </Stack>
    </Popover>
  );
}
