import { useReducer, useRef, useEffect } from 'react';
import {
  Step,
  StepLabel,
  Stepper,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCvEntryDetail } from '@/services/cv';
import { getSiteLocales } from '@/services/siteLocales';
import { useSiteContext } from '@/store/SiteContext';
import { requiredString, nonNegativeInt, formResolver } from '@/utils/validation';
import { CONTENT_STATUSES } from '@/utils/enumValues';
import type {
  CvEntryResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
  ContentStatus,
  CvEntryType,
  CvEntryLocalizationInput,
} from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CvEntryWizardCompanyStep from './CvEntryWizardCompanyStep';
import CvEntryWizardTimelineStep from './CvEntryWizardTimelineStep';
import CvEntryWizardContentStep from './CvEntryWizardContentStep';
import CvEntryWizardSkillsStep from './CvEntryWizardSkillsStep';

// ── Schema ────────────────────────────────────────────────────────────

const cvEntryWizardSchema = z.object({
  company: requiredString(200),
  company_url: z.union([z.url('Must be a valid URL'), z.literal('')]).optional(),
  company_logo_id: z.string().optional().or(z.literal('')),
  location: requiredString(200),
  entry_type: z.enum(['Work', 'Education', 'Volunteer', 'Certification', 'Project']),
  status: z.enum(CONTENT_STATUSES),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().or(z.literal('')),
  is_current: z.boolean(),
  display_order: nonNegativeInt,
  positions: z.record(z.string(), z.string()),
  descriptions: z.record(z.string(), z.string()),
  achievements: z.record(z.string(), z.array(z.string())),
  skill_ids: z.array(z.string()),
}).refine(
  (data) => {
    if (data.end_date && data.start_date) return data.end_date >= data.start_date;
    return true;
  },
  { message: 'End date must be after start date', path: ['end_date'] },
);

export type CvEntryWizardFormData = z.infer<typeof cvEntryWizardSchema>;

// ── Reducer ───────────────────────────────────────────────────────────

const STEP_KEYS = [
  'wizard.cvEntry.steps.company',
  'wizard.cvEntry.steps.timeline',
  'wizard.cvEntry.steps.content',
  'wizard.cvEntry.steps.skills',
] as const;

interface WizardUiState {
  activeStep: number;
  showDiscardDialog: boolean;
}

type WizardUiAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; value: number }
  | { type: 'SHOW_DISCARD_DIALOG' }
  | { type: 'HIDE_DISCARD_DIALOG' };

const initialUiState: WizardUiState = { activeStep: 0, showDiscardDialog: false };

function uiReducer(state: WizardUiState, action: WizardUiAction): WizardUiState {
  switch (action.type) {
    case 'RESET': return initialUiState;
    case 'SET_STEP': return { ...state, activeStep: action.value };
    case 'SHOW_DISCARD_DIALOG': return { ...state, showDiscardDialog: true };
    case 'HIDE_DISCARD_DIALOG': return { ...state, showDiscardDialog: false };
  }
}

// ── Default values ────────────────────────────────────────────────────

const buildDefaults = (): CvEntryWizardFormData => ({
  company: '',
  company_url: '',
  company_logo_id: '',
  location: '',
  entry_type: 'Work',
  status: 'Draft',
  start_date: '',
  end_date: '',
  is_current: false,
  display_order: 0,
  positions: {},
  descriptions: {},
  achievements: {},
  skill_ids: [],
});

// ── Component ─────────────────────────────────────────────────────────

interface CvEntryWizardProps {
  open: boolean;
  entry?: CvEntryResponse | null;
  onSubmit: (data: CreateCvEntryRequest | UpdateCvEntryRequest) => void;
  onClose: () => void;
  loading: boolean;
}

const COMPANY_FIELDS: (keyof CvEntryWizardFormData)[] = ['company', 'location'];
const TIMELINE_FIELDS: (keyof CvEntryWizardFormData)[] = ['start_date'];
const STEP_FIELD_MAP: (keyof CvEntryWizardFormData)[][] = [COMPANY_FIELDS, TIMELINE_FIELDS, [], []];

export default function CvEntryWizard({
  open,
  entry,
  onSubmit,
  onClose,
  loading,
}: CvEntryWizardProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [ui, uiDispatch] = useReducer(uiReducer, initialUiState);

  const { data: siteLocales = [] } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });

  const { data: entryDetail } = useQuery({
    queryKey: ['cv-entry-detail', entry?.id],
    queryFn: () => getCvEntryDetail(entry!.id),
    enabled: open && !!entry,
  });

  const {
    register,
    control,
    reset,
    trigger,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CvEntryWizardFormData>({
    resolver: formResolver(cvEntryWizardSchema),
    defaultValues: buildDefaults(),
    mode: 'onChange',
  });

  const isEdit = !!entry;

  // Reset form when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      uiDispatch({ type: 'RESET' });
      reset(buildDefaults());
    }
    prevOpenRef.current = open;
  }, [open, reset]);

  // Populate form when editing and detail loads
  useEffect(() => {
    if (!entryDetail || !open) return;

    const positions: Record<string, string> = {};
    const descriptions: Record<string, string> = {};
    const achievements: Record<string, string[]> = {};

    for (const loc of entryDetail.localizations) {
      positions[loc.locale_id] = loc.position;
      if (loc.description) descriptions[loc.locale_id] = loc.description;
      if (Array.isArray(loc.achievements)) {
        achievements[loc.locale_id] = loc.achievements as string[];
      }
    }

    reset({
      company: entryDetail.company,
      company_url: entryDetail.company_url ?? '',
      company_logo_id: entryDetail.company_logo_id ?? '',
      location: entryDetail.location,
      entry_type: entryDetail.entry_type,
      status: 'Draft',
      start_date: entryDetail.start_date,
      end_date: entryDetail.end_date ?? '',
      is_current: entryDetail.is_current,
      display_order: entryDetail.display_order,
      positions,
      descriptions,
      achievements,
      skill_ids: entryDetail.skill_ids ?? [],
    });
  }, [entryDetail, open, reset]);

  const handleNext = async () => {
    const fieldsToValidate = STEP_FIELD_MAP[ui.activeStep];
    if (fieldsToValidate && fieldsToValidate.length > 0) {
      const valid = await trigger(fieldsToValidate);
      if (!valid) return;
    }
    if (ui.activeStep === STEP_KEYS.length - 1) {
      handleSubmit(onFormSubmit)();
      return;
    }
    uiDispatch({ type: 'SET_STEP', value: ui.activeStep + 1 });
  };

  const handleBack = () => {
    uiDispatch({ type: 'SET_STEP', value: ui.activeStep - 1 });
  };

  const handleClose = () => {
    if (isDirty) {
      uiDispatch({ type: 'SHOW_DISCARD_DIALOG' });
    } else {
      onClose();
    }
  };

  const onFormSubmit = (data: CvEntryWizardFormData) => {
    const localizations: CvEntryLocalizationInput[] = Object.entries(data.positions)
      .filter(([, position]) => position.trim().length > 0)
      .map(([localeId, position]) => ({
        locale_id: localeId,
        position,
        description: data.descriptions[localeId] || undefined,
        achievements: data.achievements[localeId]?.filter((a) => a.trim().length > 0),
      }));

    if (isEdit) {
      const update: UpdateCvEntryRequest = {
        company: data.company,
        company_url: data.company_url || undefined,
        company_logo_id: data.company_logo_id || undefined,
        location: data.location,
        entry_type: data.entry_type as CvEntryType,
        start_date: data.start_date,
        end_date: data.is_current ? undefined : (data.end_date || undefined),
        is_current: data.is_current,
        display_order: data.display_order,
        localizations,
        skill_ids: data.skill_ids,
      };
      onSubmit(update);
    } else {
      const create: CreateCvEntryRequest = {
        company: data.company,
        company_url: data.company_url || undefined,
        company_logo_id: data.company_logo_id || undefined,
        location: data.location,
        entry_type: data.entry_type as CvEntryType,
        status: data.status as ContentStatus,
        site_ids: [selectedSiteId],
        start_date: data.start_date,
        end_date: data.is_current ? undefined : (data.end_date || undefined),
        is_current: data.is_current,
        display_order: data.display_order,
        localizations,
        skill_ids: data.skill_ids,
      };
      onSubmit(create);
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onClose={handleClose}
        icon="work"
        title={isEdit ? t('wizard.cvEntry.editTitle') : t('wizard.cvEntry.createTitle')}
        maxWidth="md"
        data-testid="cv-entry-wizard"
        actions={
          <>
            <M3Button variant="ghost" size="sm" onClick={handleClose} disabled={loading} data-testid="cv-entry-wizard.btn.cancel">
              {t('common.actions.cancel')}
            </M3Button>
            {ui.activeStep > 0 && (
              <M3Button variant="outlined" size="sm" onClick={handleBack} disabled={loading} data-testid="cv-entry-wizard.btn.back">
                {t('common.actions.back')}
              </M3Button>
            )}
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleNext}
              disabled={loading}
              data-testid="cv-entry-wizard.btn.next"
            >
              {ui.activeStep === STEP_KEYS.length - 1
                ? (loading ? t('common.actions.saving') : (isEdit ? t('common.actions.save') : t('common.actions.create')))
                : t('common.actions.next')}
            </M3Button>
          </>
        }
      >
        <Stepper activeStep={ui.activeStep} sx={{ mb: 1 }} alternativeLabel>
          {STEP_KEYS.map((key, i) => (
            <Step
              key={key}
              onClick={() => isEdit && uiDispatch({ type: 'SET_STEP', value: i })}
              sx={isEdit ? { cursor: 'pointer' } : undefined}
            >
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {ui.activeStep === 0 && (
          <CvEntryWizardCompanyStep
            register={register}
            control={control}
            errors={errors}
            setValue={setValue}
            watch={watch}
            isEdit={isEdit}
            siteId={selectedSiteId}
          />
        )}

        {ui.activeStep === 1 && (
          <CvEntryWizardTimelineStep
            register={register}
            control={control}
            errors={errors}
            watch={watch}
          />
        )}

        {ui.activeStep === 2 && (
          <CvEntryWizardContentStep
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            locales={siteLocales}
          />
        )}

        {ui.activeStep === 3 && (
          <CvEntryWizardSkillsStep
            watch={watch}
            setValue={setValue}
            siteId={selectedSiteId}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={ui.showDiscardDialog}
        title={t('wizard.cvEntry.discardTitle')}
        message={t('wizard.cvEntry.discardMessage')}
        confirmLabel={t('wizard.cvEntry.discardConfirm')}
        confirmColor="warning"
        onConfirm={() => {
          uiDispatch({ type: 'HIDE_DISCARD_DIALOG' });
          onClose();
        }}
        onCancel={() => uiDispatch({ type: 'HIDE_DISCARD_DIALOG' })}
      />
    </>
  );
}
