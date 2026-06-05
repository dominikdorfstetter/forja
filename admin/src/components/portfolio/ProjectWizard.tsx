import { useReducer, useRef, useEffect } from 'react';
import { Step, StepLabel, Stepper } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CONTENT_STATUSES, PROJECT_LINK_TYPES } from '@/utils/enumValues';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getProject } from '@/services/projects';
import { getSiteLocales } from '@/services/siteLocales';
import { useSiteContext } from '@/store/SiteContext';
import { slugField, nonNegativeInt, formResolver } from '@/utils/validation';
import type {
  ProjectResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateProjectLinkRequest,
  ProjectMediaRequest,
  ContentStatus,
} from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import ProjectWizardBasicsStep from './ProjectWizardBasicsStep';
import ProjectWizardContentStep from './ProjectWizardContentStep';
import ProjectWizardRelationsStep from './ProjectWizardRelationsStep';

// ── Schema ────────────────────────────────────────────────────────────

const projectWizardSchema = z.object({
  titles: z.record(z.string(), z.string()),
  slug: slugField,
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  is_ongoing: z.boolean(),
  display_order: nonNegativeInt,
  is_featured: z.boolean(),
  status: z.enum(CONTENT_STATUSES),
  site_ids: z.array(z.string()),
  short_descriptions: z.record(z.string(), z.string()),
  descriptions: z.record(z.string(), z.string()),
  links: z.array(z.object({
    label: z.string(),
    url: z.string(),
    link_type: z.enum(PROJECT_LINK_TYPES).nullish(),
    icon: z.string().nullish(),
    display_order: z.number().nullish(),
  })),
  media: z.array(z.object({
    media_id: z.string(),
    display_order: z.number().nullish(),
    is_cover: z.boolean().nullish(),
    url: z.string().nullish(),
  })),
  skill_ids: z.array(z.string()),
  cv_entry_ids: z.array(z.string()),
}).refine(
  (data) => {
    if (data.end_date && data.start_date) return data.end_date >= data.start_date;
    return true;
  },
  { message: 'End date must be after start date', path: ['end_date'] },
);

export type ProjectWizardFormData = z.infer<typeof projectWizardSchema>;

// ── Reducer ───────────────────────────────────────────────────────────

const STEP_KEYS = [
  'wizard.project.steps.basics',
  'wizard.project.steps.content',
  'wizard.project.steps.relations',
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

const buildDefaults = (): ProjectWizardFormData => ({
  titles: {},
  slug: '',
  start_date: '',
  end_date: '',
  is_ongoing: false,
  display_order: 0,
  is_featured: false,
  status: 'Draft',
  site_ids: [],
  short_descriptions: {},
  descriptions: {},
  links: [],
  media: [],
  skill_ids: [],
  cv_entry_ids: [],
});

// ── Component ─────────────────────────────────────────────────────────

interface ProjectWizardProps {
  open: boolean;
  project?: ProjectResponse | null;
  onSubmit: (data: CreateProjectRequest | UpdateProjectRequest) => void;
  onClose: () => void;
  loading: boolean;
}

const BASICS_FIELDS: (keyof ProjectWizardFormData)[] = [];
const CONTENT_FIELDS: (keyof ProjectWizardFormData)[] = [];
const STEP_FIELD_MAP: (keyof ProjectWizardFormData)[][] = [BASICS_FIELDS, CONTENT_FIELDS, []];

export default function ProjectWizard({
  open,
  project,
  onSubmit,
  onClose,
  loading,
}: ProjectWizardProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [ui, uiDispatch] = useReducer(uiReducer, initialUiState);

  const { data: siteLocales = [] } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });

  const { data: projectDetail } = useQuery({
    queryKey: ['project-detail', project?.id],
    queryFn: () => getProject(project!.id),
    enabled: open && !!project,
  });

  const {
    register,
    control,
    reset,
    trigger,
    watch,
    setValue,
    getValues,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProjectWizardFormData>({
    resolver: formResolver(projectWizardSchema),
    defaultValues: buildDefaults(),
    mode: 'onChange',
  });

  const isEdit = !!project;

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
    if (!projectDetail || !open) return;

    const titles: Record<string, string> = {};
    const shortDescs: Record<string, string> = {};
    const descs: Record<string, string> = {};

    for (const loc of projectDetail.localizations) {
      titles[loc.locale_id] = loc.title;
      if (loc.short_description) shortDescs[loc.locale_id] = loc.short_description;
      if (loc.description) descs[loc.locale_id] = loc.description;
    }

    const links: CreateProjectLinkRequest[] = projectDetail.links.map((l) => ({
      label: l.label,
      url: l.url,
      link_type: l.link_type,
      icon: l.icon,
      display_order: l.display_order,
    }));

    const media: ProjectMediaRequest[] = projectDetail.media.map((m) => ({
      media_id: m.media_id,
      display_order: m.display_order,
      is_cover: m.is_cover,
    }));

    reset({
      titles,
      slug: projectDetail.slug,
      start_date: projectDetail.start_date ?? '',
      end_date: projectDetail.end_date ?? '',
      is_ongoing: projectDetail.is_ongoing,
      display_order: projectDetail.display_order,
      is_featured: projectDetail.is_featured,
      status: projectDetail.status,
      site_ids: [],
      short_descriptions: shortDescs,
      descriptions: descs,
      links,
      media,
      skill_ids: projectDetail.skill_ids ?? [],
      cv_entry_ids: projectDetail.cv_entry_ids ?? [],
    });
  }, [projectDetail, open, reset]);

  const handleNext = async () => {
    // Step 0: validate title (required for default locale) and auto-generate slug
    if (ui.activeStep === 0) {
      const titles = getValues('titles');
      const defaultLocaleId = siteLocales?.find((l) => l.is_default)?.locale_id ?? siteLocales?.[0]?.locale_id;
      const defaultTitle = defaultLocaleId ? titles[defaultLocaleId]?.trim() : '';
      if (!defaultTitle) {
        setError('titles', { type: 'manual', message: 'Title is required' });
        return;
      }
      clearErrors('titles');
    }

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

  const onFormSubmit = (data: ProjectWizardFormData) => {
    const localizations = Object.entries(data.titles)
      .filter(([, title]) => title.trim().length > 0)
      .map(([localeId, title]) => ({
        locale_id: localeId,
        title,
        short_description: data.short_descriptions[localeId] || undefined,
        description: data.descriptions[localeId] || undefined,
      }));

    const links: CreateProjectLinkRequest[] = data.links
      .filter((l) => l.label.trim() && l.url.trim())
      .map((l, i) => ({ ...l, display_order: i }));

    const media: ProjectMediaRequest[] = data.media.map(({ media_id, display_order, is_cover }) => ({
      media_id,
      display_order,
      is_cover,
    }));

    if (isEdit) {
      const update: UpdateProjectRequest = {
        slug: data.slug,
        display_order: data.display_order,
        is_featured: data.is_featured,
        start_date: data.start_date || undefined,
        end_date: data.is_ongoing ? undefined : (data.end_date || undefined),
        is_ongoing: data.is_ongoing,
        localizations,
        links,
        media,
        skill_ids: data.skill_ids,
        cv_entry_ids: data.cv_entry_ids,
      };
      onSubmit(update);
    } else {
      const create: CreateProjectRequest = {
        slug: data.slug,
        display_order: data.display_order,
        is_featured: data.is_featured,
        start_date: data.start_date || undefined,
        end_date: data.is_ongoing ? undefined : (data.end_date || undefined),
        is_ongoing: data.is_ongoing,
        status: data.status as ContentStatus,
        site_ids: [selectedSiteId],
        localizations,
        links,
        media,
        skill_ids: data.skill_ids,
        cv_entry_ids: data.cv_entry_ids,
      };
      onSubmit(create);
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onClose={handleClose}
        icon="folder_special"
        title={isEdit ? t('wizard.project.editTitle') : t('wizard.project.createTitle')}
        maxWidth="md"
        data-testid="project-wizard"
        actions={
          <>
            <M3Button variant="ghost" size="sm" onClick={handleClose} disabled={loading} data-testid="project-wizard.btn.cancel">
              {t('common.actions.cancel')}
            </M3Button>
            {ui.activeStep > 0 && (
              <M3Button variant="outlined" size="sm" onClick={handleBack} disabled={loading} data-testid="project-wizard.btn.back">
                {t('common.actions.back')}
              </M3Button>
            )}
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleNext}
              disabled={loading}
              data-testid="project-wizard.btn.next"
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
          <ProjectWizardBasicsStep
            register={register}
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
            isEdit={isEdit}
            locales={siteLocales}
          />
        )}

        {ui.activeStep === 1 && (
          <ProjectWizardContentStep
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
            locales={siteLocales}
            siteId={selectedSiteId}
          />
        )}

        {ui.activeStep === 2 && (
          <ProjectWizardRelationsStep
            watch={watch}
            setValue={setValue}
            siteId={selectedSiteId}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={ui.showDiscardDialog}
        title={t('wizard.project.discardTitle')}
        message={t('wizard.project.discardMessage')}
        confirmLabel={t('wizard.project.discardConfirm')}
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
