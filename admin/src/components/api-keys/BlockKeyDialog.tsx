import { useEffect, useRef } from 'react';
import { TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { formResolver } from '@/utils/validation';
import FormDialog from '@/components/shared/FormDialog';

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
    resolver: formResolver(blockKeySchema),
    defaultValues: { reason: '' },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({ reason: '' });
    }
    prevOpenRef.current = open;
  });

  const onFormSubmit = (data: BlockKeyFormData) => {
    onConfirm(data.reason.trim());
  };

  return (
    <FormDialog
      open={open}
      onClose={onCancel}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="block"
      title={t('apiKeys.blockDialog.title')}
      submitLabel={t('apiKeys.actionsMenu.block')}
      submitDisabled={!isValid}
      submitDanger
      submitTestId="block-key.btn.submit"
      cancelTestId="block-key.btn.cancel"
      loading={loading}
      maxWidth="xs"
      data-testid="block-key.dialog"
    >
      <TextField
        autoFocus
        fullWidth
        required
        size="small"
        label={t('apiKeys.blockDialog.reason')}
        placeholder={t('apiKeys.blockDialog.reasonPlaceholder')}
        {...register('reason')}
        error={!!errors.reason}
        helperText={errors.reason?.message}
        multiline
        rows={2}
      />
    </FormDialog>
  );
}
