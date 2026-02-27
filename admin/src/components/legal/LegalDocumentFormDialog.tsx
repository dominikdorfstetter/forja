import { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { requiredString, siteIdsField } from '@/utils/validation';
import type { LegalDocumentResponse, CreateLegalDocumentRequest, LegalDocType } from '@/types/api';
import { useTranslation } from 'react-i18next';

const legalDocSchema = z.object({
  cookie_name: requiredString(100).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  document_type: z.enum(['CookieConsent', 'PrivacyPolicy', 'TermsOfService', 'Imprint', 'Disclaimer']),
  status: z.enum(['Draft', 'InReview', 'Scheduled', 'Published', 'Archived']),
  site_ids: siteIdsField,
});

type LegalDocFormData = z.infer<typeof legalDocSchema>;

interface LegalDocumentFormDialogProps {
  open: boolean;
  siteId: string;
  document?: LegalDocumentResponse | null;
  onSubmit: (data: CreateLegalDocumentRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function LegalDocumentFormDialog({ open, siteId: _siteId, document, onSubmit, onClose, loading }: LegalDocumentFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<LegalDocFormData>({
    resolver: zodResolver(legalDocSchema),
    defaultValues: { cookie_name: '', document_type: 'CookieConsent' as LegalDocType, status: 'Draft' as const, site_ids: [] },
    mode: 'onChange',
  });

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  useEffect(() => {
    if (open) {
      reset(document ? {
        cookie_name: document.cookie_name,
        document_type: document.document_type,
        status: 'Draft' as const,
        site_ids: [],
      } : { cookie_name: '', document_type: 'CookieConsent' as LegalDocType, status: 'Draft' as const, site_ids: [] });
    }
  }, [open, document, reset]);

  const onFormSubmit = (data: LegalDocFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      document_type: data.document_type,
      status: data.status,
      site_ids: data.site_ids,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="legal-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="legal-form-title">{document ? t('forms.legal.editTitle') : t('forms.legal.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('forms.legal.fields.cookieName')} fullWidth required {...register('cookie_name')} error={!!errors.cookie_name} helperText={errors.cookie_name?.message} />
            <Controller name="document_type" control={control} render={({ field }) => (
              <TextField select label={t('forms.legal.fields.documentType')} fullWidth {...field}>
                <MenuItem value="CookieConsent">Cookie Consent</MenuItem>
                <MenuItem value="PrivacyPolicy">Privacy Policy</MenuItem>
                <MenuItem value="TermsOfService">Terms of Service</MenuItem>
                <MenuItem value="Imprint">Imprint</MenuItem>
                <MenuItem value="Disclaimer">Disclaimer</MenuItem>
              </TextField>
            )} />
            {!document && (
              <Controller name="status" control={control} render={({ field }) => (
                <TextField select label={t('forms.blog.fields.status')} fullWidth {...field}>
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="InReview">In Review</MenuItem>
                  <MenuItem value="Scheduled">Scheduled</MenuItem>
                  <MenuItem value="Published">Published</MenuItem>
                  <MenuItem value="Archived">Archived</MenuItem>
                </TextField>
              )} />
            )}
            {!document && (
              <Controller name="site_ids" control={control} render={({ field }) => (
                <TextField select label={t('forms.blog.fields.siteId')} fullWidth required SelectProps={{ multiple: true }} {...field} error={!!errors.site_ids} helperText={errors.site_ids?.message}>
                  {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              )} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>{loading ? t('common.actions.saving') : (document ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
