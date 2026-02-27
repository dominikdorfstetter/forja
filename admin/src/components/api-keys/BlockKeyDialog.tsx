import { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

const blockKeySchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

type BlockKeyFormData = z.infer<typeof blockKeySchema>;

interface BlockKeyDialogProps {
  open: boolean;
  keyName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function BlockKeyDialog({ open, keyName: _keyName, onConfirm, onCancel, loading }: BlockKeyDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<BlockKeyFormData>({
    resolver: zodResolver(blockKeySchema),
    defaultValues: { reason: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset({ reason: '' });
    }
  }, [open, reset]);

  const onFormSubmit = (data: BlockKeyFormData) => {
    onConfirm(data.reason.trim());
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="block-key-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="block-key-title">{t('apiKeys.blockDialog.title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            required
            label={t('apiKeys.blockDialog.reason')}
            placeholder={t('apiKeys.blockDialog.reasonPlaceholder')}
            {...register('reason')}
            error={!!errors.reason}
            helperText={errors.reason?.message}
            multiline
            rows={2}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button
            type="submit"
            color="warning"
            variant="contained"
            disabled={loading || !isValid}
          >
            {loading ? t('common.actions.loading') : t('apiKeys.actionsMenu.block')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
