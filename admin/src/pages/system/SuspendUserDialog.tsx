import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextField, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { suspendUser } from '@/services/clerkUsers';
import FormDialog from '@/components/shared/FormDialog';

const DURATION_PRESETS = [
  { label: '24h', hours: 24 },
  { label: '72h', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export default function SuspendUserDialog({ open, onClose, userId, userName }: Props) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [durationHours, setDurationHours] = useState(72);

  const mutation = useMutation({
    mutationFn: () => suspendUser(userId, { reason, duration_hours: durationHours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clerk-users'] });
      enqueueSnackbar(t('system.users.suspend.success'), { variant: 'success' });
      setReason('');
      onClose();
    },
    onError: () => enqueueSnackbar(t('system.users.suspend.error'), { variant: 'error' }),
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      icon="pause_circle"
      title={`${t('system.users.suspend.title')}: ${userName}`}
      submitLabel={mutation.isPending ? t('system.users.suspend.pending') : t('system.users.suspend.confirm')}
      submitDisabled={!reason.trim()}
      submitDanger
      submitTestId="clerk-users.suspend-confirm"
      loading={mutation.isPending}
      data-testid="clerk-users.suspend-dialog"
    >
      <TextField
        label={t('system.users.suspend.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth required multiline minRows={2} size="small"
        data-testid="clerk-users.suspend-reason"
      />
      <Typography variant="subtitle2">{t('system.users.suspend.duration')}</Typography>
      <ToggleButtonGroup
        value={durationHours} exclusive
        onChange={(_, v) => { if (v !== null) setDurationHours(v); }}
        size="small"
      >
        {DURATION_PRESETS.map((p) => (
          <ToggleButton key={p.hours} value={p.hours} data-testid={`clerk-users.duration-${p.label}`}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {t('system.users.suspend.until')}: {new Date(Date.now() + durationHours * 3600000).toLocaleString()}
      </Typography>
    </FormDialog>
  );
}
