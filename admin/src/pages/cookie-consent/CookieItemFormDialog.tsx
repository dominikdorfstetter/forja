import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import FormDialog from '@/components/shared/FormDialog';
import type { LegalItemResponse, CreateLegalItemRequest } from '@/types/api';
import CookieFormFields from './CookieFormFields';
import { EMPTY_COOKIE_FORM, type CookieFormData } from './cookieForm';

interface CookieItemFormDialogProps {
  open: boolean;
  item?: LegalItemResponse | null;
  itemCount: number;
  onSubmit: (data: CreateLegalItemRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function CookieItemFormDialog({ open, item, itemCount, onSubmit, onClose, loading }: CookieItemFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CookieFormData>({
    defaultValues: EMPTY_COOKIE_FORM,
  });

  useEffect(() => {
    if (!open) return;
    reset(item ? { ...EMPTY_COOKIE_FORM, cookie_name: item.cookie_name, is_required: item.is_required } : EMPTY_COOKIE_FORM);
  }, [open, item, reset]);

  const onFormSubmit = (data: CookieFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      display_order: item ? item.display_order : itemCount,
      is_required: data.is_required,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="cookie"
      title={item ? t('legalDetail.dialog.editItem') : t('legalDetail.dialog.addItem')}
      submitLabel={item ? t('common.actions.save') : t('common.actions.create')}
      loading={loading}
    >
      <CookieFormFields register={register} control={control} errors={errors} testIdPrefix="cookie-item-form" />
    </FormDialog>
  );
}
