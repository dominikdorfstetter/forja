import { useRef } from 'react';
import { TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { requiredString, optionalString, urlField, nonNegativeInt, formResolver} from '@/utils/validation';
import type { SocialLink, CreateSocialLinkRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';

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
    resolver: formResolver(socialLinkSchema),
    defaultValues: { title: '', url: '', icon: '', alt_text: '', display_order: 0 },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    reset(link ? {
      title: link.title,
      url: link.url,
      icon: link.icon,
      alt_text: link.alt_text || '',
      display_order: link.display_order,
    } : { title: '', url: '', icon: '', alt_text: '', display_order: 0 });
  }
  prevOpenRef.current = open;

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
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="share"
      title={link ? t('forms.socialLink.editTitle') : t('forms.socialLink.createTitle')}
      submitLabel={link ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="social-link-form.btn.submit"
      cancelTestId="social-link-form.btn.cancel"
      loading={loading}
      data-testid="social-link-form.dialog"
    >
      <TextField label={t('forms.socialLink.fields.title')} fullWidth required size="small" {...register('title')} error={!!errors.title} helperText={errors.title?.message} autoFocus />
      <TextField label={t('forms.socialLink.fields.url')} fullWidth required size="small" {...register('url')} error={!!errors.url} helperText={errors.url?.message} />
      <TextField label={t('forms.socialLink.fields.icon')} fullWidth required size="small" {...register('icon')} error={!!errors.icon} helperText={errors.icon?.message || 'e.g. github, linkedin, twitter'} />
      <TextField label={t('forms.socialLink.fields.ariaLabel')} fullWidth size="small" {...register('alt_text')} error={!!errors.alt_text} helperText={errors.alt_text?.message} />
      <TextField label={t('forms.section.fields.displayOrder')} type="number" fullWidth size="small" {...register('display_order')} error={!!errors.display_order} helperText={errors.display_order?.message} />
    </FormDialog>
  );
}
