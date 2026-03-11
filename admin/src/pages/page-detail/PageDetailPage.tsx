import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { Box, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { UpdatePageRequest, UpdateLocalizationRequest, ContentStatus, ReviewActionRequest, ReorderItem } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useEditorialWorkflow } from '@/hooks/useEditorialWorkflow';
import PageDetailDialogs from './PageDetailDialogs';
import { useFormHistory } from '@/hooks/useFormHistory';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { useAutosave } from '@/hooks/useAutosave';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { pageDetailSchema, type PageDetailFormData } from './pageDetailSchema';
import PageEditorToolbar from './PageEditorToolbar';
import PageDetailTabContent from './PageDetailTabContent';
import { uiReducer, initialUIState, buildFormDefaults } from './PageDetailReducer';
import { buildPageUpdates, buildSeoLocalizationData, hasSeoChanges } from './pageDetailSaveUtils';
import { createWorkflowHandlers } from './pageDetailWorkflowHandlers';

export default function PageDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { canWrite, isAdmin } = useAuth();
  const { preferences: userPrefs } = useUserPreferences();
  const { selectedSiteId } = useSiteContext();

  const [ui, uiDispatch] = useReducer(uiReducer, initialUIState);

  const { templates: previewTemplates, openPreview } = usePreviewUrl();

  // Queries
  const { data: page, isLoading, error } = useQuery({ queryKey: ['page', id], queryFn: () => apiService.getPage(id!), enabled: !!id });
  const { data: pageLocalizations } = useQuery({ queryKey: ['page-localizations', id], queryFn: () => apiService.getPageLocalizations(id!), enabled: !!id });
  const { data: sections, isLoading: sectionsLoading } = useQuery({ queryKey: ['page-sections', id], queryFn: () => apiService.getPageSections(id!), enabled: !!id });
  const { data: sectionLocalizations } = useQuery({ queryKey: ['page-section-localizations', id], queryFn: () => apiService.getPageSectionLocalizations(id!), enabled: !!id });
  const { data: siteLocales } = useQuery({ queryKey: ['site-locales', selectedSiteId], queryFn: () => apiService.getSiteLocales(selectedSiteId), enabled: !!selectedSiteId });

  const activeLocales = (siteLocales || [])
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code }));

  // Pick the first localization (default locale) for SEO fields
  const currentLocalization = pageLocalizations?.[0];
  const defaultLocaleId = activeLocales[0]?.id;

  const {
    control, reset, getValues, watch, setValue, formState: { isDirty },
  } = useForm<PageDetailFormData>({
    resolver: zodResolver(pageDetailSchema),
    defaultValues: buildFormDefaults(
      page ?? { route: '', slug: '', page_type: 'Static', template: '', status: 'Draft', is_in_navigation: false },
      currentLocalization,
    ),
  });

  // Bump formVersion on every form value change (restarts autosave debounce)
  useEffect(() => {
    const sub = watch(() => uiDispatch({ type: 'BUMP_FORM_VERSION' }));
    return () => sub.unsubscribe();
  }, [watch]);

  // History (undo/redo)
  const formHistory = useFormHistory(getValues, reset);

  // Unsaved changes guard (blocks sidebar navigation + browser close/refresh)
  useNavigationGuard('page-editor', isDirty);

  // Mutations
  const updatePageMutation = useMutation({
    mutationFn: (data: UpdatePageRequest) => apiService.updatePage(id!, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['page', id] }); queryClient.invalidateQueries({ queryKey: ['pages'] }); },
    onError: (err) => showError(err),
  });

  const updateLocalizationMutation = useMutation({
    mutationFn: ({ locId, data }: { locId: string; data: UpdateLocalizationRequest }) => apiService.updatePageLocalization(locId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['page-localizations', id] }),
    onError: (err) => showError(err),
  });

  const createLocalizationMutation = useMutation({
    mutationFn: (data: { pageId: string; localeId: string; meta_title: string; meta_description: string; excerpt: string }) =>
      apiService.createPageLocalization(data.pageId, {
        locale_id: data.localeId, title: '-',
        meta_title: data.meta_title || undefined, meta_description: data.meta_description || undefined, excerpt: data.excerpt || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['page-localizations', id] }),
    onError: (err) => showError(err),
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiService.createPageSection>[1]) => apiService.createPageSection(id!, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['page-sections', id] }); showSuccess(t('pageDetail.sections.added')); },
    onError: (err) => showError(err),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => apiService.deletePageSection(sectionId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['page-sections', id] }); queryClient.invalidateQueries({ queryKey: ['page-section-localizations', id] }); showSuccess(t('pageDetail.sections.deleted')); },
    onError: (err) => showError(err),
  });

  const reviewPageMutation = useMutation({
    mutationFn: (data: ReviewActionRequest) => apiService.reviewPage(id!, data),
    onSuccess: (resp) => { queryClient.invalidateQueries({ queryKey: ['page', id] }); queryClient.invalidateQueries({ queryKey: ['pages'] }); showSuccess(resp.message); },
    onError: (err) => showError(err),
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => apiService.reorderPageSections(id!, items),
    onError: (err) => { showError(err); queryClient.invalidateQueries({ queryKey: ['page-sections', id] }); },
  });

  // Unified save — handles both page metadata and SEO localization
  const handleSave = useCallback(async () => {
    if (!page) return;
    const values = getValues();

    const updates = buildPageUpdates(values, page);
    if (Object.keys(updates).length > 0) {
      await updatePageMutation.mutateAsync(updates);
    }

    if (hasSeoChanges(values, currentLocalization)) {
      if (currentLocalization) {
        await updateLocalizationMutation.mutateAsync({
          locId: currentLocalization.id,
          data: buildSeoLocalizationData(values),
        });
      } else if (defaultLocaleId) {
        await createLocalizationMutation.mutateAsync({
          pageId: id!, localeId: defaultLocaleId,
          meta_title: values.meta_title, meta_description: values.meta_description, excerpt: values.excerpt,
        });
      }
    }

    reset(values);
    showSuccess(t('pageDetail.messages.saved'));
  }, [page, currentLocalization, defaultLocaleId, id, getValues, reset, updatePageMutation, updateLocalizationMutation, createLocalizationMutation, showSuccess, t]);

  const { status: autosaveStatus, flush } = useAutosave({
    isDirty, onSave: handleSave, enabled: canWrite && userPrefs.autosave_enabled,
    debounceMs: userPrefs.autosave_debounce_seconds * 1000, formVersion: ui.formVersion, onError: (err) => showError(err),
  });

  // Initialize form when page data loads (guarded by ID to prevent resetting on background refetch)
  const formSyncKey = useRef('');
  useEffect(() => {
    if (!page) return;
    const key = `${page.id}-${currentLocalization?.id ?? 'no-loc'}`;
    if (formSyncKey.current === key) return;
    formSyncKey.current = key;
    reset(buildFormDefaults(page, currentLocalization));
    formHistory.clear();
    formHistory.snapshot();
  }, [page, currentLocalization, reset, formHistory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') { e.preventDefault(); flush(); }
      else if (mod && e.shiftKey && e.key === 'z') { e.preventDefault(); formHistory.redo(); }
      else if (mod && e.key === 'z') { e.preventDefault(); formHistory.undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flush, formHistory]);

  const isSaving = updatePageMutation.isPending || reviewPageMutation.isPending
    || updateLocalizationMutation.isPending || createLocalizationMutation.isPending;

  // Editorial workflow
  const currentFormStatus = watch('status') as ContentStatus;
  const workflow = useEditorialWorkflow(currentFormStatus);

  const {
    handleSubmitForReview, handleApproveClick, handleApprovePublishNow,
    handleApproveSchedule, handleRequestChanges, handleReviewCommentSubmit,
    handlePublish, handleUnpublish, handleArchiveClick, handleArchiveConfirm,
    handleRestoreClick, handleRestore, handleRestoreAsDraft,
  } = createWorkflowHandlers({ setValue, flush, uiDispatch, reviewPageMutation });

  if (isLoading) return <LoadingState label={t('pageDetail.loading')} />;
  if (error || !page) return <Alert severity="error">{t('pageDetail.loadFailed')}</Alert>;

  return (
    <Box>
      <PageHeader
        title={page.route}
        subtitle={t('pageDetail.pageSubtitle', { type: page.page_type })}
        breadcrumbs={[
          { label: t('layout.sidebar.pages'), path: '/pages' },
          { label: page.route },
        ]}
      />

      <PageEditorToolbar
        control={control}
        watch={watch}
        setValue={setValue}
        pageType={page.page_type}
        canUndo={formHistory.canUndo}
        canRedo={formHistory.canRedo}
        onUndo={() => formHistory.undo()}
        onRedo={() => formHistory.redo()}
        autosaveStatus={autosaveStatus}
        onSave={() => flush()}
        onToggleHistory={() => uiDispatch({ type: 'TOGGLE_HISTORY' })}
        isSaving={isSaving}
        canWrite={canWrite}
        canSubmitForReview={workflow.canSubmitForReview}
        canApprove={workflow.canApprove}
        canRequestChanges={workflow.canRequestChanges}
        canPublish={workflow.canPublish}
        canUnpublish={workflow.canUnpublish}
        canArchive={workflow.canArchive}
        canRestore={workflow.canRestore}
        canSchedule={workflow.canSchedule}
        onSubmitForReview={handleSubmitForReview}
        onApprove={handleApproveClick}
        onRequestChanges={handleRequestChanges}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onArchive={handleArchiveClick}
        onRestore={handleRestoreClick}
        previewTemplates={previewTemplates}
        onPreview={(url) => openPreview(page.route, url)}
      />

      <PageDetailTabContent
        activeTab={ui.activeTab}
        onTabChange={(v) => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: v })}
        control={control}
        watch={watch}
        page={page}
        onSnapshot={() => formHistory.snapshot()}
        pageId={page.id}
        sections={sections}
        sectionsLoading={sectionsLoading}
        sectionLocalizations={sectionLocalizations}
        activeLocales={activeLocales}
        canWrite={canWrite}
        isAdmin={isAdmin}
        onCreateSection={(data) => createSectionMutation.mutate(data)}
        onDeleteSection={(sectionId) => deleteSectionMutation.mutate(sectionId)}
        onReorderSections={(items) => reorderSectionsMutation.mutate(items)}
        onSectionEditorClose={() => {
          queryClient.invalidateQueries({ queryKey: ['page-section-localizations', id] });
          queryClient.invalidateQueries({ queryKey: ['page-sections', id] });
        }}
        createLoading={createSectionMutation.isPending}
        deleteLoading={deleteSectionMutation.isPending}
      />

      <PageDetailDialogs
        pageId={page.id}
        pageRoute={page.route}
        isSaving={isSaving}
        historyOpen={ui.historyOpen}
        onHistoryClose={() => uiDispatch({ type: 'SET_HISTORY_OPEN', payload: false })}
        reviewDialogOpen={ui.reviewDialogOpen}
        onReviewDialogClose={() => uiDispatch({ type: 'SET_REVIEW_DIALOG', payload: false })}
        onReviewCommentSubmit={handleReviewCommentSubmit}
        reviewLoading={reviewPageMutation.isPending}
        approveDialogOpen={ui.approveDialogOpen}
        onApprovePublishNow={handleApprovePublishNow}
        onApproveSchedule={handleApproveSchedule}
        onApproveCancel={() => uiDispatch({ type: 'SET_APPROVE_DIALOG', payload: false })}
        approveLoading={reviewPageMutation.isPending}
        archiveDialogOpen={ui.archiveDialogOpen}
        onArchiveConfirm={handleArchiveConfirm}
        onArchiveCancel={() => uiDispatch({ type: 'SET_ARCHIVE_DIALOG', payload: false })}
        restoreDialogOpen={ui.restoreDialogOpen}
        onRestore={handleRestore}
        onRestoreAsDraft={handleRestoreAsDraft}
        onRestoreCancel={() => uiDispatch({ type: 'SET_RESTORE_DIALOG', payload: false })}
      />
    </Box>
  );
}
