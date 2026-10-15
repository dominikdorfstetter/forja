import { useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { Alert, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm, type Control, type DefaultValues, type FieldValues } from 'react-hook-form';
import { getSiteLocales } from '@/services/siteLocales';
import type { ContentStatus } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useEditorialWorkflow } from '@/hooks/useEditorialWorkflow';
import { useFormHistory } from '@/hooks/useFormHistory';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { FormChangeProvider } from '@/store/FormChangeContext';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { SlotRender } from '@/components/shared/SlotRender';
import { formResolver } from '@/utils/validation';
import type { ContentDetailPageProps, WorkflowFlags } from './types';
import { queryKeys } from '@/lib/queryKeys';
import { contentDetailUIReducer, initialContentDetailUIState } from './contentDetailReducer';
import { entityIdOf, humanizeFieldName, soleLocalizedTabIndex } from './contentDetailHelpers';
import { activeSiteLocales } from '@/utils/siteLocales';
import { useContentDetailMutations } from './useContentDetailMutations';
import { useContentDetailSave } from './useContentDetailSave';
import { useEditorShortcuts } from './useEditorShortcuts';
import { useWorkflowHandlers } from './useWorkflowHandlers';
import { ContentLocaleTabs } from './ContentLocaleTabs';

export default function ContentDetailPage<TDetail, TFormData extends FieldValues, TLoc>({
  adapter,
  renderToolbar,
  renderEditor,
  renderStandardDialogs,
  renderExtraPanels,
  renderExtraDialogs,
  renderHeaderExtras,
}: ContentDetailPageProps<TDetail, TFormData, TLoc>) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { canWrite } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const [ui, dispatch] = useReducer(contentDetailUIReducer, initialContentDetailUIState);
  const { templates: previewTemplates, openPreview } = usePreviewUrl();

  const localeFormCacheRef = useRef<Map<string, TFormData>>(null);
  if (localeFormCacheRef.current === null) localeFormCacheRef.current = new Map();

  const { data: detail, isLoading, error } = useQuery({
    queryKey: adapter.detailQueryKey(id ?? ''),
    queryFn: () => adapter.fetchDetail(id!),
    enabled: !!id,
  });

  const { data: siteLocales } = useQuery({
    queryKey: queryKeys.siteLocales(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const activeLocales = useMemo(() => activeSiteLocales(siteLocales), [siteLocales]);

  const localizations = useMemo(() => adapter.getLocalizations(detail), [adapter, detail]);
  const hasLocalization = useCallback(
    (localeId: string) => localizations.some((l) => adapter.getLocalizationLocaleId(l) === localeId),
    [adapter, localizations],
  );

  const currentLocale = adapter.multiLocaleTabs
    ? activeLocales[ui.activeLocaleTab]
    : activeLocales[0];

  const currentLocalization = useMemo<TLoc | undefined>(() => {
    if (adapter.multiLocaleTabs) {
      if (!currentLocale) return undefined;
      return localizations.find((l) => adapter.getLocalizationLocaleId(l) === currentLocale.id);
    }
    return localizations[0];
  }, [adapter, localizations, currentLocale]);

  const form = useForm<TFormData>({
    resolver: formResolver(adapter.schema),
    defaultValues: adapter.buildFormDefaults(detail, currentLocalization) as DefaultValues<TFormData>,
  });
  const { control, reset, resetField, getValues, setValue, watch, formState } = form;
  const { isDirty } = formState;

  const formHistory = useFormHistory(getValues, reset);

  const mutations = useContentDetailMutations(adapter, id, detail);
  const { reviewMutation, isSaving, markPublishing } = mutations;

  const runSave = useContentDetailSave({
    adapter,
    detail,
    currentLocale,
    currentLocalization,
    getValues,
    reset,
    mutations,
  });

  // The set of changed top-level fields, surfaced in the save bar's popover
  // so the user can see and revert individual edits. Nested dirty objects
  // (e.g. `seo`) revert as a unit via resetField.
  const changedFields = useMemo(
    () =>
      Object.keys(formState.dirtyFields).map((name) => ({
        name,
        label: t(`${adapter.i18nNamespace}.fields.${name}`, {
          defaultValue: humanizeFieldName(name),
        }),
      })),
    [formState.dirtyFields, adapter.i18nNamespace, t],
  );

  const revertField = useCallback((name: string) => resetField(name as never), [resetField]);

  useFormSaveBar({
    id: `${adapter.entityKey}-editor`,
    isDirty,
    saving: isSaving,
    onSave: () => {
      void runSave();
    },
    onDiscard: () => reset(),
    dirtyFields: formState.dirtyFields,
    revertField,
    changedFields,
    saveTestId: adapter.saveTestId,
    discardTestId: adapter.discardTestId,
  });

  // Sync form when detail loads or locale switches.
  const formSyncKey = useRef('');
  useEffect(() => {
    if (!detail) return;
    if (adapter.multiLocaleTabs && !currentLocale) return;
    const localeKey = adapter.multiLocaleTabs ? currentLocale!.id : currentLocalization ? entityIdOf(currentLocalization) : 'no-loc';
    const key = `${entityIdOf(detail)}:${localeKey}`;
    if (formSyncKey.current === key) return;
    formSyncKey.current = key;

    if (adapter.multiLocaleTabs) {
      const cached = localeFormCacheRef.current!.get(currentLocale!.id);
      const loc = localizations.find((l) => adapter.getLocalizationLocaleId(l) === currentLocale!.id);
      reset(cached ?? (adapter.buildFormDefaults(detail, loc) as TFormData));
    } else {
      reset(adapter.buildFormDefaults(detail, currentLocalization) as TFormData);
    }
    formHistory.clear();
    formHistory.snapshot();
  }, [adapter, detail, currentLocale, currentLocalization, localizations, reset, formHistory]);

  // Auto-pick the active locale tab when exactly one locale has data (multi-tab mode only).
  const localeSyncKey = useRef('');
  useEffect(() => {
    if (!adapter.multiLocaleTabs) return;
    if (!detail || activeLocales.length === 0) return;
    const key = `${entityIdOf(detail)}:${activeLocales.length}`;
    if (localeSyncKey.current === key) return;
    localeSyncKey.current = key;
    const onlyIdx = soleLocalizedTabIndex(activeLocales, hasLocalization);
    if (onlyIdx !== -1 && onlyIdx !== ui.activeLocaleTab) {
      dispatch({ type: 'setActiveLocaleTab', value: onlyIdx });
    }
  }, [adapter, detail, activeLocales, hasLocalization, ui.activeLocaleTab]);

  const handleLocaleSwitch = useCallback(
    async (_: unknown, newValue: number) => {
      if (currentLocale) localeFormCacheRef.current!.set(currentLocale.id, getValues());
      // Persist the current locale's edits before switching so typed content
      // isn't stranded on a background tab. Explicit (no debounce) — the tab
      // switch is the user's deliberate action.
      if (isDirty) await runSave();
      dispatch({ type: 'setActiveLocaleTab', value: newValue });
    },
    [currentLocale, getValues, isDirty, runSave],
  );

  useEditorShortcuts(runSave, formHistory);

  // The shared component assumes every TFormData has a 'status' field of ContentStatus.
  const currentFormStatus = (((watch as unknown as (name: 'status') => ContentStatus | undefined))('status') ?? 'Draft');
  const workflow: WorkflowFlags = useEditorialWorkflow(currentFormStatus);

  const handlers = useWorkflowHandlers({
    setValue,
    save: runSave,
    dispatch,
    reviewMutation,
    markPublishing,
    onPublishStart: adapter.onPublishStart,
  });

  if (isLoading) return <LoadingState label={t(`${adapter.i18nNamespace}.loading`)} />;
  if (error) return <Alert severity="error">{t(`${adapter.i18nNamespace}.loadError`, { defaultValue: t(`${adapter.i18nNamespace}.loadFailed`) })}</Alert>;
  if (!detail) return <Alert severity="warning">{t(`${adapter.i18nNamespace}.notFound`)}</Alert>;

  const previewPath = adapter.getPreviewPath(detail);

  const editorSlotProps = {
    control: control as Control<TFormData, unknown, TFormData>,
    watch,
    setValue,
    getValues,
    formState,
    reset,
    detail,
    canWrite,
    selectedSiteId,
    takeSnapshot: () => formHistory.snapshot(),
    activeLocales,
  };

  const extraSlotProps = {
    ...editorSlotProps,
    save: runSave,
    isDirty,
    activeLocales,
    currentLocale,
    setActiveLocaleTab: (idx: number) => dispatch({ type: 'setActiveLocaleTab', value: idx }),
    formStatus: currentFormStatus,
    cacheFormValues: (localeId: string, values: TFormData) => {
      localeFormCacheRef.current!.set(localeId, values);
    },
    getCachedFormValues: (localeId: string) => localeFormCacheRef.current!.get(localeId),
  };

  const dialogState = {
    historyOpen: ui.historyOpen,
    reviewDialogOpen: ui.reviewDialogOpen,
    approveDialogOpen: ui.approveDialogOpen,
    archiveDialogOpen: ui.archiveDialogOpen,
    restoreDialogOpen: ui.restoreDialogOpen,
    closeHistory: () => dispatch({ type: 'closeHistory' }),
    closeReviewDialog: () => dispatch({ type: 'setReviewDialogOpen', value: false }),
    closeApproveDialog: () => dispatch({ type: 'setApproveDialogOpen', value: false }),
    closeArchiveDialog: () => dispatch({ type: 'setArchiveDialogOpen', value: false }),
    closeRestoreDialog: () => dispatch({ type: 'setRestoreDialogOpen', value: false }),
  };

  const editor = <SlotRender render={renderEditor} args={editorSlotProps} />;

  return (
    <FormChangeProvider dirtyFields={formState.dirtyFields} revertField={revertField}>
      <Box data-testid={adapter.pageTestId}>
        <PageHeader
          icon={adapter.getIcon()}
          title={adapter.getTitle(detail, t)}
          subtitle={adapter.getSubtitle?.(detail, t)}
          breadcrumbs={[...adapter.getBreadcrumbs(detail, t)]}
        />

      {renderHeaderExtras ? <SlotRender render={renderHeaderExtras} args={{ detail }} /> : null}

      <SlotRender
        render={renderToolbar}
        args={{
          control: control as Control<TFormData, unknown, TFormData>,
          watch,
          setValue,
          getValues,
          history: {
            canUndo: formHistory.canUndo,
            canRedo: formHistory.canRedo,
            undo: () => formHistory.undo(),
            redo: () => formHistory.redo(),
            snapshot: () => formHistory.snapshot(),
          },
          isSaving,
          canWrite,
          workflow,
          handlers,
          detail,
          onToggleHistory: () => dispatch({ type: 'toggleHistory' }),
          previewTemplates,
          onPreview: (templateUrl) => openPreview(previewPath, templateUrl),
        }}
      />

      {adapter.multiLocaleTabs ? (
        <ContentLocaleTabs
          activeLocales={activeLocales}
          activeTab={ui.activeLocaleTab}
          onTabChange={handleLocaleSwitch}
          hasLocalization={hasLocalization}
          noLocalesKey={`${adapter.i18nNamespace}.noLocalesAlert`}
        >
          {editor}
        </ContentLocaleTabs>
      ) : (
        editor
      )}

      {renderExtraPanels ? <SlotRender render={renderExtraPanels} args={extraSlotProps} /> : null}

      <SlotRender
        render={renderStandardDialogs}
        args={{
          detail,
          isSaving,
          reviewLoading: reviewMutation.isPending,
          approveLoading: reviewMutation.isPending,
          dialogs: dialogState,
          handlers,
        }}
      />

      {renderExtraDialogs ? <SlotRender render={renderExtraDialogs} args={extraSlotProps} /> : null}
      </Box>
    </FormChangeProvider>
  );
}
