import { useState } from 'react';
import { TextField, Alert } from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { downloadDocument, verifyDocumentAccess } from '@/services/documents';
import type { DocumentListItem } from '@/types/api';
import { formResolver } from '@/utils/validation';
import FormDialog from '@/components/shared/FormDialog';

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface DocumentPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  document: DocumentListItem | null;
}

export default function DocumentPasswordDialog({
  open,
  onClose,
  document,
}: DocumentPasswordDialogProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: formResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  const onSubmit = async (data: PasswordFormData) => {
    if (!document) return;

    setLoading(true);
    setError(null);

    try {
      const response = await verifyDocumentAccess(document.id, {
        password: data.password,
      });
      const blob = await downloadDocument(document.id, response.token);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name || 'download';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      handleClose();
    } catch {
      setError(t('documents.privacy.incorrectPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit(onSubmit)}
      icon="lock"
      title={t('documents.privacy.enterPassword')}
      submitLabel={t('documents.privacy.download')}
      submitTestId="document-password-dialog.btn.submit"
      loading={loading}
      maxWidth="xs"
      data-testid="document-password-dialog"
    >
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label={t('documents.privacy.password')}
        type="password"
        fullWidth
        size="small"
        autoFocus
        {...register('password')}
        error={!!errors.password}
        helperText={errors.password?.message}
        disabled={loading}
        data-testid="document-password-dialog.input"
      />
    </FormDialog>
  );
}
