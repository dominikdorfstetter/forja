import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import FormDialog from '@/components/shared/FormDialog';
import type { LegalGroupResponse, CreateLegalGroupRequest } from '@/types/api';
import CookieFormFields from './CookieFormFields';
import { EMPTY_COOKIE_FORM, type CookieFormData } from './cookieForm';

interface CookieGroupFormDialogProps {
  open: boolean;
  group?: LegalGroupResponse | null;
  nextOrder: number;
  onSubmit: (data: CreateLegalGroupRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function CookieGroupFormDialog({ open, group, nextOrder, onSubmit, onClose, loading }: CookieGroupFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CookieFormData>({
    defaultValues: EMPTY_COOKIE_FORM,
  });

  useEffect(() => {
    if (!open) return;
    reset(group ? {
      cookie_name: group.cookie_name,
      is_required: group.is_required,
      default_enabled: group.default_enabled,
    } : EMPTY_COOKIE_FORM);
  }, [open, group, reset]);

  const onFormSubmit = (data: CookieFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      display_order: group?.display_order ?? nextOrder,
      is_required: data.is_required,
      default_enabled: data.default_enabled,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="cookie"
      title={group ? t('legalDetail.dialog.editGroup') : t('legalDetail.dialog.addGroup')}
      submitLabel={group ? t('common.actions.save') : t('common.actions.create')}
      loading={loading}
    >
      <CookieFormFields register={register} control={control} errors={errors} testIdPrefix="cookie-group-form" showDefaultEnabled />
    </FormDialog>
  );
}
