import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { banUser } from '@/services/clerkUsers';
import FormDialog from '@/components/shared/FormDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export default function BanUserDialog({ open, onClose, userId, userName }: Props) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => banUser(userId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clerk-users'] });
      enqueueSnackbar(t('system.users.ban.success'), { variant: 'warning' });
      setReason('');
      onClose();
    },
    onError: () => enqueueSnackbar(t('system.users.ban.error'), { variant: 'error' }),
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      icon="block"
      title={`${t('system.users.ban.title')}: ${userName}`}
      submitLabel={mutation.isPending ? t('system.users.ban.pending') : t('system.users.ban.confirm')}
      submitDisabled={!reason.trim()}
      submitDanger
      submitTestId="clerk-users.ban-confirm"
      loading={mutation.isPending}
      data-testid="clerk-users.ban-dialog"
    >
      <Typography variant="body2" color="error">
        {t('system.users.ban.warning')}
      </Typography>
      <TextField
        label={t('system.users.suspend.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth required multiline minRows={2} size="small"
        data-testid="clerk-users.ban-reason"
      />
    </FormDialog>
  );
}
