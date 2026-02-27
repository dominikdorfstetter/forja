import { useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { optionalUrl, optionalString, nonNegativeInt } from '@/utils/validation';
import type { NavigationItem, CreateNavigationItemRequest, NavigationItemLocalizationInput, Locale } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';

const navigationSchema = z.object({
  link_type: z.enum(['page', 'external']),
  page_id: z.string().optional().or(z.literal('')),
  external_url: optionalUrl,
  icon: optionalString(50),
  display_order: nonNegativeInt,
  open_in_new_tab: z.boolean(),
  parent_id: z.string().optional().or(z.literal('')),
}).refine(
  (data) => {
    if (data.link_type === 'page') return !!data.page_id;
    return !!data.external_url;
  },
  { message: 'Page ID or External URL is required', path: ['page_id'] },
);

type NavigationFormData = z.infer<typeof navigationSchema>;

interface NavigationFormDialogProps {
  open: boolean;
  siteId: string;
  menuId: string;
  item?: NavigationItem | null;
  allItems?: NavigationItem[];
  maxDepth?: number;
  locales?: Locale[];
  onSubmit: (data: CreateNavigationItemRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function NavigationFormDialog({
  open,
  siteId,
  menuId,
  item,
  allItems = [],
  maxDepth = 3,
  locales = [],
  onSubmit,
  onClose,
  loading,
}: NavigationFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, watch, formState: { errors, isValid } } = useForm<NavigationFormData>({
    resolver: zodResolver(navigationSchema) as any,
    defaultValues: { link_type: 'page', page_id: '', external_url: '', icon: '', display_order: 0, open_in_new_tab: false, parent_id: '' },
    mode: 'onChange',
  });

  const linkType = watch('link_type');

  // Fetch existing localizations when editing
  const { data: existingLocalizations } = useQuery({
    queryKey: ['navigation-localizations', item?.id],
    queryFn: () => apiService.getNavigationItemLocalizations(item!.id),
    enabled: !!item?.id && open,
  });

  useEffect(() => {
    if (open) {
      reset(item ? {
        link_type: item.external_url ? 'external' : 'page',
        page_id: item.page_id || '',
        external_url: item.external_url || '',
        icon: item.icon || '',
        display_order: item.display_order,
        open_in_new_tab: item.open_in_new_tab,
        parent_id: item.parent_id || '',
      } : { link_type: 'page', page_id: '', external_url: '', icon: '', display_order: 0, open_in_new_tab: false, parent_id: '' });
    }
  }, [open, item, reset]);

  // Build parent options with indentation (excluding current item and its descendants)
  const parentOptions = useMemo(() => {
    if (!allItems.length) return [];

    const excludeIds = new Set<string>();
    if (item) {
      excludeIds.add(item.id);
      // Recursively find descendants
      const findDescendants = (parentId: string) => {
        allItems.filter(i => i.parent_id === parentId).forEach(child => {
          excludeIds.add(child.id);
          findDescendants(child.id);
        });
      };
      findDescendants(item.id);
    }

    // Build tree depth map
    const depthMap = new Map<string, number>();
    const calculateDepth = (itemId: string): number => {
      if (depthMap.has(itemId)) return depthMap.get(itemId)!;
      const i = allItems.find(x => x.id === itemId);
      if (!i || !i.parent_id) {
        depthMap.set(itemId, 0);
        return 0;
      }
      const depth = calculateDepth(i.parent_id) + 1;
      depthMap.set(itemId, depth);
      return depth;
    };

    return allItems
      .filter(i => !excludeIds.has(i.id))
      .map(i => {
        const depth = calculateDepth(i.id);
        // Enforce max_depth: item being edited would be at depth+1
        if (depth >= maxDepth - 1) return null;
        const indent = '\u00A0\u00A0'.repeat(depth);
        const label = `${indent}${i.title || i.page_id || i.external_url || i.id}`;
        return { value: i.id, label, depth };
      })
      .filter(Boolean) as { value: string; label: string; depth: number }[];
  }, [allItems, item, maxDepth]);

  const onFormSubmit = (data: NavigationFormData) => {
    // Collect localization inputs from DOM
    const localizationInputs: NavigationItemLocalizationInput[] = [];
    locales.forEach(locale => {
      const input = document.getElementById(`loc-title-${locale.id}`) as HTMLInputElement;
      if (input && input.value.trim()) {
        localizationInputs.push({ locale_id: locale.id, title: input.value.trim() });
      }
    });

    onSubmit({
      page_id: data.link_type === 'page' && data.page_id ? data.page_id : undefined,
      external_url: data.link_type === 'external' && data.external_url ? data.external_url : undefined,
      icon: data.icon || undefined,
      display_order: data.display_order,
      open_in_new_tab: data.open_in_new_tab,
      parent_id: data.parent_id || undefined,
      site_id: siteId,
      menu_id: menuId,
      localizations: localizationInputs.length > 0 ? localizationInputs : undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="navigation-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="navigation-form-title">{item ? t('forms.navigation.editTitle') : t('forms.navigation.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Localization title fields */}
            {locales.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('navigation.fields.titles', 'Titles')}
                </Typography>
                {locales.map(locale => {
                  const existingLoc = existingLocalizations?.find(l => l.locale_id === locale.id);
                  return (
                    <TextField
                      key={locale.id}
                      id={`loc-title-${locale.id}`}
                      label={`${t('navigation.fields.title', 'Title')} (${locale.code})`}
                      fullWidth
                      defaultValue={existingLoc?.title || ''}
                      sx={{ mb: 1 }}
                      size="small"
                    />
                  );
                })}
              </Box>
            )}

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('forms.navigation.fields.type')}</Typography>
              <Controller name="link_type" control={control} render={({ field }) => (
                <ToggleButtonGroup exclusive value={field.value} onChange={(_, v) => v && field.onChange(v)} size="small" fullWidth>
                  <ToggleButton value="page">{t('common.labels.internal')}</ToggleButton>
                  <ToggleButton value="external">{t('common.labels.external')}</ToggleButton>
                </ToggleButtonGroup>
              )} />
            </Box>
            {linkType === 'page' ? (
              <TextField label={t('forms.navigation.fields.page')} fullWidth required {...register('page_id')} error={!!errors.page_id} helperText={errors.page_id?.message || 'UUID of the target page'} />
            ) : (
              <TextField label={t('forms.navigation.fields.externalUrl')} fullWidth required {...register('external_url')} error={!!errors.external_url} helperText={errors.external_url?.message} />
            )}
            <TextField label={t('forms.navigation.fields.icon')} fullWidth {...register('icon')} helperText="Optional icon name" />
            <TextField label={t('forms.section.fields.displayOrder')} type="number" fullWidth {...register('display_order')} error={!!errors.display_order} helperText={errors.display_order?.message} />

            {/* Parent picker dropdown */}
            <Controller name="parent_id" control={control} render={({ field }) => (
              <TextField
                select
                label={t('navigation.fields.parent', 'Parent')}
                fullWidth
                value={field.value || ''}
                onChange={field.onChange}
                helperText={t('navigation.fields.parentHelp', 'Select a parent item or leave as root')}
              >
                <MenuItem value="">
                  <em>{t('navigation.fields.noParent', 'None (root level)')}</em>
                </MenuItem>
                {parentOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )} />

            <Controller name="open_in_new_tab" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('forms.navigation.fields.openInNewTab')} />
            )} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>
            {loading ? t('common.actions.saving') : (item ? t('common.actions.save') : t('common.actions.create'))}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
