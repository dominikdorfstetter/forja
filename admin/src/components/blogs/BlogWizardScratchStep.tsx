import { Box, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { ScratchFormData } from './useBlogScratchForm';

interface BlogWizardScratchStepProps {
  register: UseFormRegister<ScratchFormData>;
  errors: FieldErrors<ScratchFormData>;
  onSlugEdited: () => void;
}

export default function BlogWizardScratchStep({ register, errors, onSlugEdited }: BlogWizardScratchStepProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField autoFocus label={t('blogs.wizard.fields.title')} fullWidth required {...register('title')} error={!!errors.title} helperText={errors.title?.message} data-testid="create-blog-wizard.input.title" />
      <TextField label={t('blogs.wizard.fields.slug')} fullWidth required {...register('slug', { onChange: onSlugEdited })} error={!!errors.slug} helperText={errors.slug?.message || t('blogs.wizard.fields.slugHint')} data-testid="create-blog-wizard.input.slug" />
      <TextField label={t('blogs.wizard.fields.author')} fullWidth required {...register('author')} error={!!errors.author} helperText={errors.author?.message} data-testid="create-blog-wizard.input.author" />
    </Box>
  );
}
