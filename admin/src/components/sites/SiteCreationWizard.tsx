import { useReducer, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
} from '@mui/material';
import { useForm } from 'react-hook-form';
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
import SiteWizardBasicsStep from './SiteWizardBasicsStep';
import SiteWizardModulesStep from './SiteWizardModulesStep';
import SiteWizardWorkflowStep from './SiteWizardWorkflowStep';
import SiteWizardLanguagesStep from './SiteWizardLanguagesStep';

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

interface ModuleDefaults {
  blog: boolean;
  pages: boolean;
  cv: boolean;
  legal: boolean;
  documents: boolean;
  ai: boolean;
}

// --- Reducer ---

interface WizardUiState {
  activeStep: number;
  selectedLocales: Locale[];
  defaultLocaleId: string | null;
  localeError: string | null;
}

type WizardUiAction =
  | { type: 'RESET' }
  | { type: 'SET_ACTIVE_STEP'; value: number }
  | { type: 'SET_SELECTED_LOCALES'; value: Locale[] }
  | { type: 'SET_DEFAULT_LOCALE_ID'; value: string | null }
  | { type: 'SET_LOCALE_ERROR'; value: string | null };

const initialUiState: WizardUiState = {
  activeStep: 0, selectedLocales: [], defaultLocaleId: null, localeError: null,
};

function uiReducer(state: WizardUiState, action: WizardUiAction): WizardUiState {
  switch (action.type) {
    case 'RESET': return initialUiState;
    case 'SET_ACTIVE_STEP': return { ...state, activeStep: action.value };
    case 'SET_SELECTED_LOCALES': return { ...state, selectedLocales: action.value };
    case 'SET_DEFAULT_LOCALE_ID': return { ...state, defaultLocaleId: action.value };
    case 'SET_LOCALE_ERROR': return { ...state, localeError: action.value };
  }
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

  const [ui, uiDispatch] = useReducer(uiReducer, initialUiState);

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

  // Reset when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    uiDispatch({ type: 'RESET' });
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

  // Derive effective default locale from selection
  const effectiveDefaultLocaleId = (() => {
    if (ui.selectedLocales.length === 0) return null;
    if (ui.selectedLocales.length === 1) return ui.selectedLocales[0].id;
    if (ui.defaultLocaleId && ui.selectedLocales.find((l) => l.id === ui.defaultLocaleId)) return ui.defaultLocaleId;
    return ui.selectedLocales[0].id;
  })();

  const createMutation = useMutation({
    mutationFn: async (data: WizardFormData) => {
      if (ui.selectedLocales.length > 0 && !effectiveDefaultLocaleId) {
        throw new Error(t('forms.site.validation.exactlyOneDefault'));
      }

      const locales = ui.selectedLocales.length > 0
        ? ui.selectedLocales.map((l) => ({
            locale_id: l.id,
            is_default: l.id === effectiveDefaultLocaleId,
            url_prefix: l.code,
          }))
        : undefined;

      const site = await apiService.createSite({
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        timezone: data.timezone || undefined,
        locales,
      });

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
    if (ui.activeStep === 0) {
      const valid = await trigger(['name', 'slug', 'description', 'timezone']);
      if (!valid) return;
    }
    if (ui.activeStep === 3) {
      if (ui.selectedLocales.length > 0 && !effectiveDefaultLocaleId) {
        uiDispatch({ type: 'SET_LOCALE_ERROR', value: t('forms.site.validation.exactlyOneDefault') });
        return;
      }
      uiDispatch({ type: 'SET_LOCALE_ERROR', value: null });
      handleSubmit((data) => createMutation.mutate(data))();
      return;
    }
    uiDispatch({ type: 'SET_ACTIVE_STEP', value: ui.activeStep + 1 });
  };

  const handleBack = () => {
    uiDispatch({ type: 'SET_ACTIVE_STEP', value: ui.activeStep - 1 });
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
        <Stepper activeStep={ui.activeStep} sx={{ mb: 3, mt: 1 }} alternativeLabel>
          {STEP_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {ui.activeStep === 0 && (
          <SiteWizardBasicsStep register={register as never} errors={errors} />
        )}

        {ui.activeStep === 1 && (
          <SiteWizardModulesStep control={control as never} />
        )}

        {ui.activeStep === 2 && (
          <SiteWizardWorkflowStep control={control as never} />
        )}

        {ui.activeStep === 3 && (
          <SiteWizardLanguagesStep
            allLocales={allLocales}
            selectedLocales={ui.selectedLocales}
            onSelectedLocalesChange={(v) => uiDispatch({ type: 'SET_SELECTED_LOCALES', value: v })}
            defaultLocaleId={ui.defaultLocaleId}
            onDefaultLocaleIdChange={(v) => uiDispatch({ type: 'SET_DEFAULT_LOCALE_ID', value: v })}
            effectiveDefaultLocaleId={effectiveDefaultLocaleId}
            localeError={ui.localeError}
            onLocaleErrorClear={() => uiDispatch({ type: 'SET_LOCALE_ERROR', value: null })}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isCreating}>
          {t('common.actions.cancel')}
        </Button>
        {ui.activeStep > 0 && (
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
          {ui.activeStep === 3
            ? (isCreating ? t('common.actions.saving') : t('common.actions.create'))
            : t('common.actions.next')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
