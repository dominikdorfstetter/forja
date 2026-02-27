import { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requiredString, optionalString, urlField, nonNegativeInt } from '@/utils/validation';
import type { SocialLink, CreateSocialLinkRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';

const socialLinkSchema = z.object({
  title: requiredString(100),
  url: urlField,
  icon: requiredString(50),
  alt_text: optionalString(200),
  display_order: nonNegativeInt,
});

type SocialLinkFormData = z.infer<typeof socialLinkSchema>;

interface SocialLinkFormDialogProps {
  open: boolean;
  siteId: string;
  link?: SocialLink | null;
  onSubmit: (data: CreateSocialLinkRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function SocialLinkFormDialog({ open, siteId, link, onSubmit, onClose, loading }: SocialLinkFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<SocialLinkFormData>({
    resolver: zodResolver(socialLinkSchema),
    defaultValues: { title: '', url: '', icon: '', alt_text: '', display_order: 0 },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(link ? {
        title: link.title,
        url: link.url,
        icon: link.icon,
        alt_text: link.alt_text || '',
        display_order: link.display_order,
      } : { title: '', url: '', icon: '', alt_text: '', display_order: 0 });
    }
  }, [open, link, reset]);

  const onFormSubmit = (data: SocialLinkFormData) => {
    onSubmit({
      title: data.title,
      url: data.url,
      icon: data.icon,
      alt_text: data.alt_text || undefined,
      display_order: data.display_order,
      site_id: siteId,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="social-link-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="social-link-form-title">{link ? t('forms.socialLink.editTitle') : t('forms.socialLink.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('forms.socialLink.fields.title')} fullWidth required {...register('title')} error={!!errors.title} helperText={errors.title?.message} autoFocus />
            <TextField label={t('forms.socialLink.fields.url')} fullWidth required {...register('url')} error={!!errors.url} helperText={errors.url?.message} />
            <TextField label={t('forms.socialLink.fields.icon')} fullWidth required {...register('icon')} error={!!errors.icon} helperText={errors.icon?.message || 'e.g. github, linkedin, twitter'} />
            <TextField label={t('forms.socialLink.fields.ariaLabel')} fullWidth {...register('alt_text')} error={!!errors.alt_text} helperText={errors.alt_text?.message} />
            <TextField label={t('forms.section.fields.displayOrder')} type="number" fullWidth {...register('display_order')} error={!!errors.display_order} helperText={errors.display_order?.message} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>
            {loading ? t('common.actions.saving') : (link ? t('common.actions.save') : t('common.actions.create'))}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
