import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Radio,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
  Autocomplete,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ArticleIcon from '@mui/icons-material/Article';
import WebIcon from '@mui/icons-material/Web';
import WorkIcon from '@mui/icons-material/Work';
import GavelIcon from '@mui/icons-material/Gavel';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { slugField, requiredString, optionalString } from '@/utils/validation';
import type { Locale } from '@/types/api';

const STEP_KEYS = [
  'sites.wizard.steps.basics',
  'sites.wizard.steps.modules',
  'sites.wizard.steps.workflow',
  'sites.wizard.steps.languages',
] as const;

const wizardSchema = z.object({
  name: requiredString(200),
  slug: slugField,
  description: optionalString(1000),
  timezone: optionalString(50),
  modules: z.object({
    blog: z.boolean(),
    pages: z.boolean(),
    cv: z.boolean(),
    legal: z.boolean(),
    documents: z.boolean(),
    ai: z.boolean(),
  }),
  workflowMode: z.enum(['solo', 'team']),
});

type WizardFormData = z.infer<typeof wizardSchema>;

const MODULE_DEFS = [
  { key: 'blog' as const, icon: <ArticleIcon />, defaultOn: true },
  { key: 'pages' as const, icon: <WebIcon />, defaultOn: true },
  { key: 'cv' as const, icon: <WorkIcon />, defaultOn: false },
  { key: 'legal' as const, icon: <GavelIcon />, defaultOn: false },
  { key: 'documents' as const, icon: <DescriptionIcon />, defaultOn: false },
  { key: 'ai' as const, icon: <AutoAwesomeIcon />, defaultOn: false },
] as const;

interface ModuleDefaults {
  blog: boolean;
  pages: boolean;
  cv: boolean;
  legal: boolean;
  documents: boolean;
  ai: boolean;
}

interface SiteCreationWizardProps {
  open: boolean;
  onClose: () => void;
  defaultModules?: ModuleDefaults;
  defaultWorkflowMode?: 'solo' | 'team';
}

export default function SiteCreationWizard({
  open,
  onClose,
  defaultModules,
  defaultWorkflowMode,
}: SiteCreationWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { setSelectedSiteId } = useSiteContext();
  const { refreshAuth } = useAuth();
  const { showError, showSuccess } = useErrorSnackbar();

  const [activeStep, setActiveStep] = useState(0);

  // Locale state (managed outside react-hook-form for Autocomplete compatibility)
  const [selectedLocales, setSelectedLocales] = useState<Locale[]>([]);
  const [defaultLocaleId, setDefaultLocaleId] = useState<string | null>(null);
  const [localeError, setLocaleError] = useState<string | null>(null);

  const { data: allLocales = [] } = useQuery({
    queryKey: ['locales'],
    queryFn: () => apiService.getLocales(),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      timezone: 'UTC',
      modules: defaultModules ?? { blog: true, pages: true, cv: false, legal: false, documents: false, ai: false },
      workflowMode: defaultWorkflowMode ?? 'solo',
    },
    mode: 'onChange',
  });

  // Reset when dialog opens (apply survey-derived defaults if provided)
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    setActiveStep(0);
    setSelectedLocales([]);
    setDefaultLocaleId(null);
    setLocaleError(null);
    reset({
      name: '',
      slug: '',
      description: '',
      timezone: 'UTC',
      modules: defaultModules ?? { blog: true, pages: true, cv: false, legal: false, documents: false, ai: false },
      workflowMode: defaultWorkflowMode ?? 'solo',
    });
  }
  prevOpenRef.current = open;

  // Auto-set default locale
  useEffect(() => {
    if (selectedLocales.length === 1 && !defaultLocaleId) {
      setDefaultLocaleId(selectedLocales[0].id);
    }
    if (selectedLocales.length === 0) {
      setDefaultLocaleId(null);
    }
    if (defaultLocaleId && !selectedLocales.find((l) => l.id === defaultLocaleId)) {
      setDefaultLocaleId(selectedLocales.length > 0 ? selectedLocales[0].id : null);
    }
  }, [selectedLocales, defaultLocaleId]);

  const createMutation = useMutation({
    mutationFn: async (data: WizardFormData) => {
      // Validate locales
      if (selectedLocales.length > 0 && !defaultLocaleId) {
        throw new Error(t('forms.site.validation.exactlyOneDefault'));
      }

      const locales = selectedLocales.length > 0
        ? selectedLocales.map((l) => ({
            locale_id: l.id,
            is_default: l.id === defaultLocaleId,
            url_prefix: l.code,
          }))
        : undefined;

      // 1. Create the site
      const site = await apiService.createSite({
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        timezone: data.timezone || undefined,
        locales,
      });

      // 2. Save module settings + workflow mode
      await apiService.updateSiteSettings(site.id, {
        module_blog_enabled: data.modules.blog,
        module_pages_enabled: data.modules.pages,
        module_cv_enabled: data.modules.cv,
        module_legal_enabled: data.modules.legal,
        module_documents_enabled: data.modules.documents,
        editorial_workflow_enabled: data.workflowMode === 'team',
      });

      return site;
    },
    onSuccess: async (site) => {
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['siteContext', site.id] });
      setSelectedSiteId(site.id);
      showSuccess(t('sites.messages.created'));
      onClose();
    },
    onError: showError,
  });

  const handleNext = async () => {
    if (activeStep === 0) {
      const valid = await trigger(['name', 'slug', 'description', 'timezone']);
      if (!valid) return;
    }
    if (activeStep === 3) {
      // Final step: validate locales and submit
      if (selectedLocales.length > 0 && !defaultLocaleId) {
        setLocaleError(t('forms.site.validation.exactlyOneDefault'));
        return;
      }
      setLocaleError(null);
      handleSubmit((data) => createMutation.mutate(data))();
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    setActiveStep((s) => s - 1);
  };

  const isCreating = createMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="site-wizard-title"
      data-testid="site-creation-wizard"
    >
      <DialogTitle id="site-wizard-title">{t('sites.wizard.title')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
          {STEP_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Basics */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              label={t('forms.site.fields.name')}
              fullWidth
              required
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              data-testid="site-wizard.input.name"
            />
            <TextField
              label={t('forms.site.fields.slug')}
              fullWidth
              required
              {...register('slug')}
              error={!!errors.slug}
              helperText={errors.slug?.message}
              data-testid="site-wizard.input.slug"
            />
            <TextField
              label={t('forms.site.fields.description')}
              fullWidth
              multiline
              rows={3}
              {...register('description')}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
            <TextField
              label="Timezone"
              fullWidth
              {...register('timezone')}
              error={!!errors.timezone}
              helperText={errors.timezone?.message || 'e.g. Europe/Vienna, UTC'}
            />
          </Box>
        )}

        {/* Step 1: Content Modules */}
        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('sites.wizard.modulesDescription')}
            </Typography>
            {MODULE_DEFS.map(({ key, icon }) => (
              <Controller
                key={key}
                name={`modules.${key}`}
                control={control}
                render={({ field }) => (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: field.value ? 'primary.main' : 'divider',
                      bgcolor: field.value ? 'action.selected' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ color: field.value ? 'primary.main' : 'text.secondary' }}>
                        {icon}
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {t(`sites.wizard.modules.${key}`)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`sites.wizard.modules.${key}Desc`)}
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      data-testid={`site-wizard.module.${key}`}
                    />
                  </Box>
                )}
              />
            ))}
          </Box>
        )}

        {/* Step 2: Team & Workflow */}
        {activeStep === 2 && (
          <Controller
            name="workflowMode"
            control={control}
            render={({ field }) => (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('sites.wizard.workflowDescription')}
                </Typography>
                {(['solo', 'team'] as const).map((mode) => (
                  <Card
                    key={mode}
                    variant="outlined"
                    sx={{
                      border: 2,
                      borderColor: field.value === mode ? 'primary.main' : 'divider',
                      bgcolor: field.value === mode ? 'action.selected' : 'background.paper',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                  >
                    <CardActionArea
                      onClick={() => field.onChange(mode)}
                      sx={{ p: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 2 }}
                      data-testid={`site-wizard.workflow.${mode}`}
                    >
                      <Box sx={{ color: field.value === mode ? 'primary.main' : 'text.secondary', mt: 0.5 }}>
                        {mode === 'solo' ? <PersonIcon sx={{ fontSize: 32 }} /> : <GroupIcon sx={{ fontSize: 32 }} />}
                      </Box>
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          {t(`sites.wizard.workflow.${mode}`)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t(`sites.wizard.workflow.${mode}Desc`)}
                        </Typography>
                      </Box>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}
          />
        )}

        {/* Step 3: Languages */}
        {activeStep === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('sites.wizard.languagesDescription')}
            </Typography>
            <Autocomplete
              multiple
              options={allLocales}
              getOptionLabel={(option) =>
                `${option.code} — ${option.name}${option.native_name ? ` (${option.native_name})` : ''}`
              }
              value={selectedLocales}
              onChange={(_, value) => { setSelectedLocales(value); setLocaleError(null); }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      label={`${option.code} — ${option.name}`}
                      {...tagProps}
                      color={option.id === defaultLocaleId ? 'primary' : 'default'}
                      size="small"
                    />
                  );
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('forms.site.fields.initialLanguages')}
                  helperText={localeError || t('forms.site.fields.initialLanguagesHelper')}
                  error={!!localeError}
                />
              )}
              data-testid="site-wizard.locales"
            />

            {selectedLocales.length > 1 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('forms.site.fields.defaultLanguage')}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {selectedLocales.map((locale) => (
                    <Chip
                      key={locale.id}
                      label={`${locale.code} — ${locale.name}`}
                      size="small"
                      icon={
                        <Radio
                          checked={locale.id === defaultLocaleId}
                          size="small"
                          sx={{ p: 0 }}
                        />
                      }
                      onClick={() => setDefaultLocaleId(locale.id)}
                      variant={locale.id === defaultLocaleId ? 'filled' : 'outlined'}
                      color={locale.id === defaultLocaleId ? 'primary' : 'default'}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isCreating}>
          {t('common.actions.cancel')}
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isCreating} data-testid="site-wizard.btn.back">
            {t('common.actions.back')}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={isCreating}
          data-testid="site-wizard.btn.next"
        >
          {activeStep === 3
            ? (isCreating ? t('common.actions.saving') : t('common.actions.create'))
            : t('common.actions.next')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
