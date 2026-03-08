import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { slugify } from '@/utils/slugify';
import { PAGE_TYPE_CONFIG } from './pageTypeConfig';
import { wizardSchema, type WizardFormData } from './createPageWizardSchema';
import type { CreatePageRequest, PageType } from '@/types/api';

interface CreatePageWizardProps {
  open: boolean;
  onSubmit: (data: CreatePageRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const STEP_KEYS = ['pages.wizard.steps.pageType', 'pages.wizard.steps.identity', 'pages.wizard.steps.options'] as const;

const STEP_FIELDS: (keyof WizardFormData)[][] = [
  ['page_type'],
  ['route', 'slug'],
  ['site_ids', 'is_in_navigation', 'navigation_order'],
];

export default function CreatePageWizard({ open, onSubmit, onClose, loading }: CreatePageWizardProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [activeStep, setActiveStep] = useState(0);
  const slugManuallyEdited = useRef(false);

  const { register, handleSubmit, control, watch, setValue, trigger, reset, formState: { errors } } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      page_type: 'Static' as PageType,
      route: '',
      slug: '',
      site_ids: selectedSiteId ? [selectedSiteId] : [],
      is_in_navigation: false,
      navigation_order: '',
    },
    mode: 'onChange',
  });

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  const selectedPageType = watch('page_type');
  const isInNavigation = watch('is_in_navigation');
  const route = watch('route');

  // Auto-generate slug from route
  useEffect(() => {
    if (!slugManuallyEdited.current && route) {
      const generated = slugify(route.replace(/^\//, ''));
      setValue('slug', generated, { shouldValidate: true });
    }
  }, [route, setValue]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      slugManuallyEdited.current = false;
      reset({
        page_type: 'Static' as PageType,
        route: '',
        slug: '',
        site_ids: selectedSiteId ? [selectedSiteId] : [],
        is_in_navigation: false,
        navigation_order: '',
      });
    }
  }, [open, reset, selectedSiteId]);

  const handleNext = async () => {
    const valid = await trigger(STEP_FIELDS[activeStep]);
    if (valid) setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    if (activeStep === 1) {
      slugManuallyEdited.current = false;
    }
    setActiveStep((s) => s - 1);
  };

  const onFormSubmit = (data: WizardFormData) => {
    const route = data.route.startsWith('/') ? data.route : `/${data.route}`;
    onSubmit({
      route,
      slug: data.slug,
      page_type: data.page_type,
      status: 'Draft',
      is_in_navigation: data.is_in_navigation,
      navigation_order: data.is_in_navigation && data.navigation_order !== '' ? Number(data.navigation_order) : undefined,
      site_ids: data.site_ids,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={activeStep === 0 ? 'md' : 'sm'} fullWidth aria-labelledby="create-page-wizard-title" data-testid="create-page-wizard">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="create-page-wizard-title">{t('forms.page.createTitle')}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
            {STEP_KEYS.map((key) => (
              <Step key={key}>
                <StepLabel>{t(key)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {PAGE_TYPE_CONFIG.map(({ type, icon, labelKey, descriptionKey }) => (
                <Card
                  key={type}
                  variant="outlined"
                  sx={{
                    border: 2,
                    borderColor: selectedPageType === type ? 'primary.main' : 'divider',
                    bgcolor: selectedPageType === type ? 'action.selected' : 'background.paper',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    display: 'flex',
                  }}
                >
                  <CardActionArea
                    onClick={() => setValue('page_type', type)}
                    sx={{ p: 1.5, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                  >
                    <Box sx={{ color: selectedPageType === type ? 'primary.main' : 'text.secondary', mb: 0.5 }}>
                      {icon}
                    </Box>
                    <Typography variant="body2" fontWeight={600}>{t(labelKey)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {t(descriptionKey)}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('forms.page.fields.route')}
                fullWidth
                required
                autoFocus
                {...register('route')}
                error={!!errors.route}
                helperText={errors.route?.message || t('pages.wizard.routeHint')}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">/</InputAdornment>,
                  },
                }}
              />
              <Controller
                name="slug"
                control={control}
                render={({ field }) => (
                  <TextField
                    label={t('pageDetail.fields.slug')}
                    fullWidth
                    required
                    {...field}
                    onChange={(e) => {
                      slugManuallyEdited.current = true;
                      field.onChange(e);
                    }}
                    error={!!errors.slug}
                    helperText={errors.slug?.message || t('pages.wizard.slugHint')}
                  />
                )}
              />
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Controller
                name="site_ids"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label={t('pages.wizard.site')}
                    fullWidth
                    required
                    SelectProps={{ multiple: true }}
                    {...field}
                    error={!!errors.site_ids}
                    helperText={errors.site_ids?.message}
                  >
                    {sites?.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </TextField>
                )}
              />
              <Controller
                name="is_in_navigation"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={field.onChange} />}
                    label={t('pages.wizard.inNavigation')}
                  />
                )}
              />
              {isInNavigation && (
                <TextField
                  label={t('forms.page.fields.navOrder')}
                  type="number"
                  fullWidth
                  {...register('navigation_order')}
                  error={!!errors.navigation_order}
                  helperText={errors.navigation_order?.message}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && (
            <Button type="button" onClick={handleBack} disabled={loading} data-testid="create-page-wizard.btn.back">{t('pages.wizard.back')}</Button>
          )}
          {activeStep < 2 ? (
            <Button type="button" variant="contained" onClick={handleNext} data-testid="create-page-wizard.btn.next">{t('pages.wizard.next')}</Button>
          ) : (
            <Button type="submit" variant="contained" disabled={loading} data-testid="create-page-wizard.btn.create">
              {loading ? t('pages.wizard.creating') : t('pages.wizard.createPage')}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
