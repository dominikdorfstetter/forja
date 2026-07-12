import { useReducer, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Alert, Box, Chip, Tab, Tabs } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { useForm, type Control, type DefaultValues, type FieldValues } from 'react-hook-form';
import { getSiteLocales } from '@/services/siteLocales';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { ContentStatus, ReviewActionRequest } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useEditorialWorkflow } from '@/hooks/useEditorialWorkflow';
import { useFormHistory } from '@/hooks/useFormHistory';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { FormChangeProvider } from '@/store/FormChangeContext';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import PageHeader from '@/components/shared/PageHeader';
import { pageTabsSx } from '@/components/shared/listPageV2';
import LoadingState from '@/components/shared/LoadingState';
import { formResolver } from '@/utils/validation';
import type {
  ActiveLocale,
  ContentDetailPageProps,
  WorkflowFlags,
  WorkflowHandlers,
} from './types';
import { queryKeys } from '@/lib/queryKeys';

interface UIState {
  activeLocaleTab: number;
  historyOpen: boolean;
  reviewDialogOpen: boolean;
  approveDialogOpen: boolean;
  archiveDialogOpen: boolean;
  restoreDialogOpen: boolean;
}

type UIAction =
  | { type: 'setActiveLocaleTab'; value: number }
  | { type: 'toggleHistory' }
  | { type: 'closeHistory' }
  | { type: 'setReviewDialogOpen'; value: boolean }
  | { type: 'setApproveDialogOpen'; value: boolean }
  | { type: 'setArchiveDialogOpen'; value: boolean }
  | { type: 'setRestoreDialogOpen'; value: boolean };

const initialUIState: UIState = {
  activeLocaleTab: 0,
  historyOpen: false,
  reviewDialogOpen: false,
  approveDialogOpen: false,
  archiveDialogOpen: false,
  restoreDialogOpen: false,
};

function SlotRender<TArgs>({ render, args }: { render: (a: TArgs) => ReactNode; args: TArgs }): ReactNode {
  return render(args);
}

/** Fallback label for the changed-fields popover: "cover_image_id" → "Cover image". */
function humanizeFieldName(name: string): string {
  const words = name.replace(/_id$/, '').replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setActiveLocaleTab':
      return { ...state, activeLocaleTab: action.value };
    case 'toggleHistory':
      return { ...state, historyOpen: !state.historyOpen };
    case 'closeHistory':
      return { ...state, historyOpen: false };
    case 'setReviewDialogOpen':
      return { ...state, reviewDialogOpen: action.value };
    case 'setApproveDialogOpen':
      return { ...state, approveDialogOpen: action.value };
    case 'setArchiveDialogOpen':
      return { ...state, archiveDialogOpen: action.value };
    case 'setRestoreDialogOpen':
      return { ...state, restoreDialogOpen: action.value };
    default:
      return state;
  }
}

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
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { canWrite } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);
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

  const activeLocales = useMemo<ActiveLocale[]>(() => {
    const result: ActiveLocale[] = [];
    for (const sl of siteLocales ?? []) {
      if (!sl.is_active) continue;
      result.push({
        id: sl.locale_id,
        code: sl.code,
        name: sl.name,
        native_name: sl.native_name,
        direction: sl.direction,
        is_active: sl.is_active,
        created_at: sl.created_at,
      });
    }
    return result;
  }, [siteLocales]);

  const localizations = useMemo(() => adapter.getLocalizations(detail), [adapter, detail]);

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

  const updateEntityMutation = useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: Record<string, unknown> }) =>
      adapter.updateEntity(entityId, data),
    onSuccess: (_resp, vars) => {
      queryClient.invalidateQueries({ queryKey: adapter.detailQueryKey(vars.entityId) });
      adapter.invalidateOnSave?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      if (justPublishedRef.current && detail) {
        adapter.onPublishSuccess?.(detail);
      }
      justPublishedRef.current = false;
    },
    onError: (err) => showError(err),
  });

  const createLocMutation = useMutation({
    mutationFn: ({ entityId, localeId, data }: { entityId: string; localeId: string; data: Record<string, unknown> }) =>
      adapter.createLocalization(entityId, localeId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adapter.detailQueryKey(id ?? '') }),
    onError: (err) => showError(err),
  });

  const updateLocMutation = useMutation({
    mutationFn: ({ locId, data }: { locId: string; data: Record<string, unknown> }) =>
      adapter.updateLocalization(locId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adapter.detailQueryKey(id ?? '') }),
    onError: (err) => showError(err),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: ReviewActionRequest) => {
      if (!adapter.reviewEntity) throw new Error('reviewEntity not configured');
      return adapter.reviewEntity(id!, data);
    },
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: adapter.detailQueryKey(id ?? '') });
      adapter.invalidateOnSave?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      showSuccess(resp.message);
    },
    onError: (err) => showError(err),
  });

  const justPublishedRef = useRef(false);

  const handleSave = useCallback(async () => {
    if (!detail || !currentLocale) return;
    const values = getValues();
    const detailId = (detail as unknown as { id: string }).id;

    // Save the localization first. The entity-status update can be rejected
    // by the backend publish gate (e.g. missing locale coverage); persisting
    // the translation before that attempt ensures the user's typed content is
    // never lost — and is the correct order when a publish adds the final
    // missing locale in the same save (the row must exist before the gate
    // runs). See #783.
    const locShouldSave = adapter.hasLocalizationChanges
      ? adapter.hasLocalizationChanges(values, currentLocalization)
      : true;

    if (locShouldSave) {
      const locData = adapter.buildLocalizationData(values);
      const titleField = adapter.getLocTitleField?.(values);
      const dataWithTitle = titleField !== undefined ? { title: titleField, ...locData } : locData;

      if (currentLocalization) {
        await updateLocMutation.mutateAsync({ locId: (currentLocalization as unknown as { id: string }).id, data: dataWithTitle });
      } else {
        await createLocMutation.mutateAsync({ entityId: detailId, localeId: currentLocale.id, data: dataWithTitle });
      }
    }

    const entityUpdates = adapter.buildEntityUpdates(values, detail);
    if (Object.keys(entityUpdates).length > 0) {
      await updateEntityMutation.mutateAsync({ entityId: detailId, data: entityUpdates });
    }

    reset(values);
    showSuccess(t(`${adapter.i18nNamespace}.messages.saved`));
  }, [
    adapter,
    detail,
    currentLocale,
    currentLocalization,
    getValues,
    reset,
    showSuccess,
    t,
    updateEntityMutation,
    updateLocMutation,
    createLocMutation,
  ]);

  // Fire-and-forget save wrapper that never rejects: per-leg errors (e.g. the
  // publish-gate 400 on the entity update) are already surfaced via each
  // mutation's onError. A throw here correctly skips reset()/success, leaving
  // the form dirty so the user can retry — we just must not leak the rejection.
  const runSave = useCallback(async () => {
    try {
      await handleSave();
    } catch {
      // already surfaced via mutation onError
    }
  }, [handleSave]);

  const isSaving =
    updateEntityMutation.isPending ||
    createLocMutation.isPending ||
    updateLocMutation.isPending ||
    reviewMutation.isPending;

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
    const localeKey = adapter.multiLocaleTabs ? currentLocale!.id : currentLocalization ? (currentLocalization as unknown as { id: string }).id : 'no-loc';
    const detailId = (detail as unknown as { id: string }).id;
    const key = `${detailId}:${localeKey}`;
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
    const detailId = (detail as unknown as { id: string }).id;
    const key = `${detailId}:${activeLocales.length}`;
    if (localeSyncKey.current === key) return;
    localeSyncKey.current = key;
    let onlyIdx = -1;
    let count = 0;
    for (let i = 0; i < activeLocales.length; i++) {
      const locale = activeLocales[i];
      if (localizations.some((l) => adapter.getLocalizationLocaleId(l) === locale.id)) {
        if (count === 0) onlyIdx = i;
        count++;
        if (count > 1) break;
      }
    }
    if (count === 1 && onlyIdx !== ui.activeLocaleTab) {
      dispatch({ type: 'setActiveLocaleTab', value: onlyIdx });
    }
  }, [adapter, detail, activeLocales, localizations, ui.activeLocaleTab]);

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

  // Keyboard shortcuts: Cmd/Ctrl+S = save, Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo.
  // `runSave` is read only inside the handler, so hold it in a ref and keep the
  // listener bound once — re-subscribing on every `runSave` identity change is
  // pointless churn (equivalent to a stable Effect Event).
  const runSaveRef = useRef(runSave);
  useEffect(() => { runSaveRef.current = runSave; });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        void runSaveRef.current();
      } else if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        formHistory.redo();
      } else if (mod && e.key === 'z') {
        e.preventDefault();
        formHistory.undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [formHistory]);

  // The shared component assumes every TFormData has a 'status' field of ContentStatus.
  const currentFormStatus = (((watch as unknown as (name: 'status') => ContentStatus | undefined))('status') ?? 'Draft');
  const workflow: WorkflowFlags = useEditorialWorkflow(currentFormStatus);

  const setStatusAndSave = useCallback(
    (status: ContentStatus) => {
      setValue('status' as never, status as never, { shouldDirty: true });
      void runSave();
    },
    [setValue, runSave],
  );

  const handlers: WorkflowHandlers = useMemo(
    () => ({
      handleSubmitForReview: () => setStatusAndSave('InReview'),
      handleApproveClick: () => dispatch({ type: 'setApproveDialogOpen', value: true }),
      handleApprovePublishNow: () => {
        dispatch({ type: 'setApproveDialogOpen', value: false });
        reviewMutation.mutate({ action: 'approve' });
      },
      handleApproveSchedule: (date: string) => {
        dispatch({ type: 'setApproveDialogOpen', value: false });
        setValue('publish_start' as never, date as never, { shouldDirty: true });
        reviewMutation.mutate({ action: 'approve' });
      },
      handleRequestChanges: () => dispatch({ type: 'setReviewDialogOpen', value: true }),
      handleReviewCommentSubmit: (comment?: string) => {
        dispatch({ type: 'setReviewDialogOpen', value: false });
        reviewMutation.mutate({ action: 'request_changes', comment });
      },
      handlePublish: () => {
        justPublishedRef.current = true;
        adapter.onPublishStart?.();
        setStatusAndSave('Published');
      },
      handleUnpublish: () => {
        setValue('status' as never, 'Draft' as never, { shouldDirty: true });
        setValue('publish_start' as never, null as never, { shouldDirty: true });
        setValue('publish_end' as never, null as never, { shouldDirty: true });
        void runSave();
      },
      handleArchiveClick: () => dispatch({ type: 'setArchiveDialogOpen', value: true }),
      handleArchiveConfirm: () => {
        dispatch({ type: 'setArchiveDialogOpen', value: false });
        setStatusAndSave('Archived');
      },
      handleRestoreClick: () => dispatch({ type: 'setRestoreDialogOpen', value: true }),
      handleRestore: () => {
        dispatch({ type: 'setRestoreDialogOpen', value: false });
        setStatusAndSave('Published');
      },
      handleRestoreAsDraft: () => {
        dispatch({ type: 'setRestoreDialogOpen', value: false });
        setStatusAndSave('Draft');
      },
    }),
    [adapter, setValue, setStatusAndSave, runSave, reviewMutation],
  );

  if (isLoading) return <LoadingState label={t(`${adapter.i18nNamespace}.loading`)} />;
  if (error) return <Alert severity="error">{t(`${adapter.i18nNamespace}.loadError`, { defaultValue: t(`${adapter.i18nNamespace}.loadFailed`) })}</Alert>;
  if (!detail) return <Alert severity="warning">{t(`${adapter.i18nNamespace}.notFound`)}</Alert>;

  const headerTitle = adapter.getTitle(detail, t);
  const subtitle = adapter.getSubtitle?.(detail, t);
  const breadcrumbs = adapter.getBreadcrumbs(detail, t);
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

  return (
    <FormChangeProvider dirtyFields={formState.dirtyFields} revertField={revertField}>
      <Box data-testid={adapter.pageTestId}>
        <PageHeader icon={adapter.getIcon()} title={headerTitle} subtitle={subtitle} breadcrumbs={[...breadcrumbs]} />

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
        activeLocales.length > 0 ? (
          <>
            <Tabs
              value={ui.activeLocaleTab}
              onChange={handleLocaleSwitch}
              sx={pageTabsSx}
              variant="scrollable"
              scrollButtons="auto"
            >
              {activeLocales.map((locale) => {
                const hasLoc = localizations.some((l) => adapter.getLocalizationLocaleId(l) === locale.id);
                return (
                  <Tab
                    key={locale.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {locale.code.toUpperCase()}
                        {hasLoc && (
                          <Chip
                            label="exists"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    }
                  />
                );
              })}
            </Tabs>
            <SlotRender render={renderEditor} args={editorSlotProps} />
          </>
        ) : (
          <Alert severity="info">
            <Trans i18nKey={`${adapter.i18nNamespace}.noLocalesAlert`} components={{ strong: <strong /> }} />
          </Alert>
        )
      ) : (
        <SlotRender render={renderEditor} args={editorSlotProps} />
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
