import { useRef } from 'react';
import {
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import type { NavigationMenu, CreateNavigationMenuRequest, UpdateNavigationMenuRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { formResolver } from '@/utils/validation';
import FormDialog from '@/components/shared/FormDialog';

const menuSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50, 'Slug cannot exceed 50 characters')
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(255).optional().or(z.literal('')),
  max_depth: z.coerce.number().int().min(1).max(10),
  is_active: z.boolean(),
});

type MenuFormData = z.infer<typeof menuSchema>;

interface MenuFormDialogProps {
  open: boolean;
  menu?: NavigationMenu | null;
  onSubmitCreate: (data: CreateNavigationMenuRequest) => void;
  onSubmitUpdate: (data: UpdateNavigationMenuRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function MenuFormDialog({ open, menu, onSubmitCreate, onSubmitUpdate, onClose, loading }: MenuFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<MenuFormData>({
    resolver: formResolver(menuSchema),
    defaultValues: { slug: '', description: '', max_depth: 3, is_active: true },
    mode: 'onChange',
  });

  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    reset(menu ? {
      slug: menu.slug,
      description: menu.description || '',
      max_depth: menu.max_depth,
      is_active: menu.is_active,
    } : { slug: '', description: '', max_depth: 3, is_active: true });
  }
  prevOpenRef.current = open;

  const onFormSubmit = (data: MenuFormData) => {
    if (menu) {
      onSubmitUpdate({
        slug: data.slug,
        description: data.description || undefined,
        max_depth: data.max_depth,
        is_active: data.is_active,
      });
    } else {
      onSubmitCreate({
        slug: data.slug,
        description: data.description || undefined,
        max_depth: data.max_depth,
      });
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="menu_book"
      title={menu ? t('navigation.menus.editTitle', 'Edit Menu') : t('navigation.menus.createTitle', 'Create Menu')}
      submitLabel={menu ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="menu-form.btn.submit"
      cancelTestId="menu-form.btn.cancel"
      loading={loading}
      data-testid="menu-form.dialog"
    >
      <TextField
        autoFocus
        label={t('navigation.menus.fields.slug', 'Slug')}
        fullWidth
        required
        size="small"
        {...register('slug')}
        error={!!errors.slug}
        helperText={errors.slug?.message || t('navigation.menus.fields.slugHelp', 'e.g. primary, footer, sidebar')}
      />
      <TextField
        label={t('navigation.menus.fields.description', 'Description')}
        fullWidth
        size="small"
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
      />
      <TextField
        label={t('navigation.menus.fields.maxDepth', 'Max Depth')}
        type="number"
        fullWidth
        size="small"
        {...register('max_depth')}
        error={!!errors.max_depth}
        helperText={errors.max_depth?.message || t('navigation.menus.fields.maxDepthHelp', 'Maximum nesting depth (1-10)')}
      />
      {menu && (
        <Controller name="is_active" control={control} render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} />}
            label={t('navigation.menus.fields.active', 'Active')}
          />
        )} />
      )}
    </FormDialog>
  );
}
