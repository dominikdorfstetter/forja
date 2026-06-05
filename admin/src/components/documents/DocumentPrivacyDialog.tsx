import { useMemo, useState } from 'react';
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Alert,
  Tooltip,
  Typography,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { removeDocumentPrivacy, setDocumentPrivacy } from '@/services/documents';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { DocumentResponse } from '@/types/api';
import { generatePassword, validatePassword, type PasswordPolicy } from './passwordUtils';
import { TTL_PRESETS, ttlPresetToIso } from './privacyState';
import { formResolver } from '@/utils/validation';
import FormDialog from '@/components/shared/FormDialog';

function createSetPrivacySchema(policy?: PasswordPolicy) {
  const minLen = policy?.minLength ?? 8;
  return z
    .object({
      password: z.string().min(minLen, `Password must be at least ${minLen} characters`),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })
    .superRefine((data, ctx) => {
      const err = validatePassword(data.password, policy);
      if (err) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ['password'] });
      }
    });
}

const removePrivacySchema = z.object({
  password: z.string().optional(),
});

type SetPrivacyFormData = { password: string; confirmPassword: string };
type RemovePrivacyFormData = z.infer<typeof removePrivacySchema>;

interface DocumentPrivacyDialogProps {
  open: boolean;
  onClose: () => void;
  document: DocumentResponse | null;
  onSuccess: () => void;
  passwordPolicy?: PasswordPolicy;
}

function SetPrivacyForm({
  open,
  document,
  onClose,
  onSuccess,
  passwordPolicy,
}: {
  open: boolean;
  document: DocumentResponse;
  onClose: () => void;
  onSuccess: () => void;
  passwordPolicy?: PasswordPolicy;
}) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useErrorSnackbar();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [ttlPreset, setTtlPreset] = useState<string>('never');

  const initialPassword = generatePassword(passwordPolicy);
  const schema = useMemo(() => createSetPrivacySchema(passwordPolicy), [passwordPolicy]);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<SetPrivacyFormData>({
    resolver: formResolver(schema),
    defaultValues: { password: initialPassword, confirmPassword: initialPassword },
    mode: 'onChange',
  });

  const handleGenerate = () => {
    const pw = generatePassword(passwordPolicy);
    setValue('password', pw, { shouldValidate: true });
    setValue('confirmPassword', pw, { shouldValidate: true });
    setShowPassword(true);
  };

  const onSubmit = async (data: SetPrivacyFormData) => {
    setLoading(true);
    try {
      const expires_at = ttlPresetToIso(ttlPreset);
      await setDocumentPrivacy(document.id, {
        password: data.password,
        expires_at,
      });
      showSuccess(t('documents.privacy.setSuccess'));
      onSuccess();
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      icon="lock"
      title={t('documents.privacy.setTitle')}
      submitLabel={t('documents.privacy.setButton')}
      submitDisabled={!isValid}
      submitTestId="document-privacy-dialog.btn.submit"
      loading={loading}
      maxWidth="xs"
      data-testid="document-privacy-dialog"
    >
      <Typography variant="body2" color="text.secondary">
        {t('documents.privacy.setDescription')}
      </Typography>
      <TextField
        label={t('documents.privacy.password')}
        type={showPassword ? 'text' : 'password'}
        fullWidth
        size="small"
        autoFocus
        {...register('password')}
        error={!!errors.password}
        helperText={errors.password?.message}
        disabled={loading}
        data-testid="document-privacy-dialog.password"
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
                <Tooltip title={t('documents.privacy.generate')}>
                  <IconButton size="small" onClick={handleGenerate}>
                    <AutorenewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        label={t('documents.privacy.confirmPassword')}
        type={showPassword ? 'text' : 'password'}
        fullWidth
        size="small"
        {...register('confirmPassword')}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
        disabled={loading}
        data-testid="document-privacy-dialog.confirm-password"
      />
      <FormControl fullWidth size="small" disabled={loading}>
        <InputLabel id="document-privacy-ttl-label">
          {t('documents.privacy.ttl.label')}
        </InputLabel>
        <Select
          labelId="document-privacy-ttl-label"
          label={t('documents.privacy.ttl.label')}
          value={ttlPreset}
          onChange={(e) => setTtlPreset(e.target.value as string)}
          inputProps={{ 'data-testid': 'document-privacy-dialog.ttl' }}
        >
          {TTL_PRESETS.map((preset) => (
            <MenuItem
              key={preset.key}
              value={preset.key}
              data-testid={`document-privacy-dialog.ttl.${preset.key}`}
            >
              {t(`documents.privacy.ttl.${preset.key}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </FormDialog>
  );
}

function RemovePrivacyForm({
  open,
  document,
  onClose,
  onSuccess,
}: {
  open: boolean;
  document: DocumentResponse;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useErrorSnackbar();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
  } = useForm<RemovePrivacyFormData>({
    resolver: formResolver(removePrivacySchema),
    defaultValues: { password: '' },
  });

  const onSubmit = async (data: RemovePrivacyFormData) => {
    setLoading(true);
    try {
      await removeDocumentPrivacy(document.id, {
        password: data.password || undefined,
      });
      showSuccess(t('documents.privacy.removeSuccess'));
      onSuccess();
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      icon="lock_open"
      title={t('documents.privacy.removeTitle')}
      submitLabel={t('documents.privacy.removeButton')}
      submitDanger
      submitTestId="document-privacy-dialog.btn.submit"
      loading={loading}
      maxWidth="xs"
      data-testid="document-privacy-dialog"
    >
      <Typography variant="body2" color="text.secondary">
        {t('documents.privacy.removeDescription')}
      </Typography>
      <TextField
        label={t('documents.privacy.password')}
        type="password"
        fullWidth
        size="small"
        autoFocus
        {...register('password')}
        disabled={loading}
        data-testid="document-privacy-dialog.password"
      />
      <Alert severity="info">{t('documents.privacy.adminRecoveryNote')}</Alert>
    </FormDialog>
  );
}

export default function DocumentPrivacyDialog({
  open,
  onClose,
  document,
  onSuccess,
  passwordPolicy,
}: DocumentPrivacyDialogProps) {
  if (!document) return null;

  return document.is_private ? (
    <RemovePrivacyForm open={open} document={document} onClose={onClose} onSuccess={onSuccess} />
  ) : (
    <SetPrivacyForm open={open} document={document} onClose={onClose} onSuccess={onSuccess} passwordPolicy={passwordPolicy} />
  );
}
