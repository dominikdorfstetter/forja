import { useEffect, useReducer, useRef } from 'react';
import { Step, StepLabel, Stepper } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getLocales } from '@/services/locales';
import { createSite, updateSiteSettings } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { slugField, requiredString, optionalString, formResolver} from '@/utils/validation';
import type { Locale } from '@/types/api';
import SiteWizardBasicsStep from './SiteWizardBasicsStep';
import SiteWizardModulesStep from './SiteWizardModulesStep';
import SiteWizardWorkflowStep from './SiteWizardWorkflowStep';
import SiteWizardLanguagesStep from './SiteWizardLanguagesStep';
import { queryKeys } from '@/lib/queryKeys';

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
    portfolio: z.boolean(),
    legal: z.boolean(),
    documents: z.boolean(),
    forms: z.boolean(),
    ai: z.boolean(),
  }),
  workflowMode: z.enum(['solo', 'team']),
});

type WizardFormData = z.infer<typeof wizardSchema>;

interface ModuleDefaults {
  blog: boolean;
  pages: boolean;
  portfolio: boolean;
  legal: boolean;
  documents: boolean;
  forms: boolean;
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
    queryKey: queryKeys.locales(),
    queryFn: () => getLocales(),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WizardFormData>({
    resolver: formResolver(wizardSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      timezone: 'UTC',
      modules: defaultModules ?? { blog: true, pages: true, portfolio: false, legal: false, documents: false, forms: false, ai: false },
      workflowMode: defaultWorkflowMode ?? 'solo',
    },
    mode: 'onChange',
  });

  // Reset when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      uiDispatch({ type: 'RESET' });
      reset({
        name: '',
        slug: '',
        description: '',
        timezone: 'UTC',
        modules: defaultModules ?? { blog: true, pages: true, portfolio: false, legal: false, documents: false, forms: false, ai: false },
        workflowMode: defaultWorkflowMode ?? 'solo',
      });
    }
    prevOpenRef.current = open;
  });

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

      const site = await createSite({
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        timezone: data.timezone || undefined,
        locales,
      });

      await updateSiteSettings(site.id, {
        module_blog_enabled: data.modules.blog,
        module_pages_enabled: data.modules.pages,
        module_portfolio_enabled: data.modules.portfolio,
        module_legal_enabled: data.modules.legal,
        module_documents_enabled: data.modules.documents,
        module_forms_enabled: data.modules.forms,
        module_ai_enabled: data.modules.ai,
        editorial_workflow_enabled: data.workflowMode === 'team',
      });

      return site;
    },
    onSuccess: async (site) => {
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
      queryClient.invalidateQueries({ queryKey: queryKeys.siteContext(site.id) });
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
    <FormDialog
      open={open}
      onClose={onClose}
      icon="domain_add"
      title={t('sites.wizard.title')}
      data-testid="site-creation-wizard"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={onClose} disabled={isCreating}>
            {t('common.actions.cancel')}
          </M3Button>
          {ui.activeStep > 0 && (
            <M3Button variant="outlined" size="sm" onClick={handleBack} disabled={isCreating} data-testid="site-wizard.btn.back">
              {t('common.actions.back')}
            </M3Button>
          )}
          <M3Button
            variant="filled"
            size="sm"
            onClick={handleNext}
            disabled={isCreating}
            data-testid="site-wizard.btn.next"
          >
            {ui.activeStep === 3
              ? (isCreating ? t('common.actions.saving') : t('common.actions.create'))
              : t('common.actions.next')}
          </M3Button>
        </>
      }
    >
      <Stepper activeStep={ui.activeStep} sx={{ mb: 1 }} alternativeLabel>
        {STEP_KEYS.map((key) => (
          <Step key={key}>
            <StepLabel>{t(key)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {ui.activeStep === 0 && (
        <SiteWizardBasicsStep register={register} errors={errors} setValue={setValue} watch={watch} />
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
    </FormDialog>
  );
}
