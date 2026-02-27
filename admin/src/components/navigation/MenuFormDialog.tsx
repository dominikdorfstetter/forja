import { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NavigationMenu, CreateNavigationMenuRequest, UpdateNavigationMenuRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';

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
    resolver: zodResolver(menuSchema),
    defaultValues: { slug: '', description: '', max_depth: 3, is_active: true },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open) {
      reset(menu ? {
        slug: menu.slug,
        description: menu.description || '',
        max_depth: menu.max_depth,
        is_active: menu.is_active,
      } : { slug: '', description: '', max_depth: 3, is_active: true });
    }
  }, [open, menu, reset]);

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="menu-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="menu-form-title">
          {menu ? t('navigation.menus.editTitle', 'Edit Menu') : t('navigation.menus.createTitle', 'Create Menu')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('navigation.menus.fields.slug', 'Slug')}
              fullWidth
              required
              {...register('slug')}
              error={!!errors.slug}
              helperText={errors.slug?.message || 'e.g. primary, footer, sidebar'}
            />
            <TextField
              label={t('navigation.menus.fields.description', 'Description')}
              fullWidth
              {...register('description')}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
            <TextField
              label={t('navigation.menus.fields.maxDepth', 'Max Depth')}
              type="number"
              fullWidth
              {...register('max_depth')}
              error={!!errors.max_depth}
              helperText={errors.max_depth?.message || 'Maximum nesting depth (1-10)'}
            />
            {menu && (
              <Controller name="is_active" control={control} render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={field.onChange} />}
                  label={t('navigation.menus.fields.active', 'Active')}
                />
              )} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>
            {loading ? t('common.actions.saving') : (menu ? t('common.actions.save') : t('common.actions.create'))}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
