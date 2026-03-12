import { useReducer, useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Alert,
  Box,
  Chip,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  ContentStatus,
  ReviewActionRequest,
} from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useEditorialWorkflow } from '@/hooks/useEditorialWorkflow';
import { useFormHistory } from '@/hooks/useFormHistory';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { useAutosave } from '@/hooks/useAutosave';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import FirstRunTip from '@/components/FirstRunTip';
import FirstPublishCelebration from '@/components/FirstPublishCelebration';
import {
  blogContentSchema,
  type BlogContentFormData,
} from './blogDetailSchema';
import BlogEditorToolbar from './BlogEditorToolbar';
import BlogEditorContent from './BlogEditorContent';
import BlogTranslateDialog from './BlogTranslateDialog';
import BlogDetailDialogs from './BlogDetailDialogs';
import { useAiAssist } from '@/hooks/useAiAssist';
import { uiReducer, initialUIState, buildFormDefaults } from './BlogDetailReducer';
import { buildBlogUpdates, buildLocalizationData } from './blogDetailSaveUtils';
import { createBlogWorkflowHandlers } from './blogDetailWorkflowHandlers';
import { createTranslationHandlers } from './blogDetailTranslationHandlers';

export default function BlogDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { canWrite } = useAuth();
  const { preferences: userPrefs } = useUserPreferences();
  const { selectedSiteId } = useSiteContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  const FIRST_RUN_TIP_KEY = 'forja_editor_tip_dismissed';
  const firstPublishKey = `forja_first_publish_celebrated_${selectedSiteId}`;
  const [showFirstRunTip, setShowFirstRunTip] = useState(() => !localStorage.getItem(FIRST_RUN_TIP_KEY));
  const [showCelebration, setShowCelebration] = useState(false);
  const justPublishedRef = useRef(false);

  const { templates: previewTemplates, openPreview } = usePreviewUrl();
  const { isConfigured: aiConfigured, generate: aiGenerate, isGenerating: aiGenerating } = useAiAssist();

  const localeFormCache = useRef<Map<string, BlogContentFormData>>(new Map());

  const { data: blogDetail, isLoading, error } = useQuery({ queryKey: ['blog-detail', id], queryFn: () => apiService.getBlogDetail(id!), enabled: !!id });
  const { data: siteLocales } = useQuery({ queryKey: ['site-locales', selectedSiteId], queryFn: () => apiService.getSiteLocales(selectedSiteId), enabled: !!selectedSiteId });

  const activeLocales = (siteLocales || []).filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at }));

  const currentLocale = activeLocales[ui.activeLocaleTab];
  const currentLocalization = blogDetail?.localizations?.find(
    (l) => currentLocale && l.locale_id === currentLocale.id,
  );

  const {
    control, reset, getValues, setValue, watch,
    formState: { isDirty },
  } = useForm<BlogContentFormData>({
    resolver: zodResolver(blogContentSchema),
    defaultValues: buildFormDefaults(blogDetail, currentLocalization),
  });

  useEffect(() => {
    const sub = watch(() => dispatch({ type: 'bumpFormVersion' }));
    return () => sub.unsubscribe();
  }, [watch]);

  const formHistory = useFormHistory(getValues, reset);
  useNavigationGuard('blog-editor', isDirty);

  const createLocMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiService.createBlogLocalization>[1]) =>
      apiService.createBlogLocalization(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blog-detail', id] }),
    onError: (err) => showError(err),
  });

  const updateLocMutation = useMutation({
    mutationFn: ({ locId, data }: { locId: string; data: Parameters<typeof apiService.updateBlogLocalization>[1] }) =>
      apiService.updateBlogLocalization(locId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blog-detail', id] }),
    onError: (err) => showError(err),
  });

  const updateBlogMutation = useMutation({
    mutationFn: ({ blogId, data }: { blogId: string; data: Parameters<typeof apiService.updateBlog>[1] }) => apiService.updateBlog(blogId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      if (justPublishedRef.current && !localStorage.getItem(firstPublishKey)) {
        localStorage.setItem(firstPublishKey, '1');
        setShowCelebration(true);
      }
      justPublishedRef.current = false;
    },
    onError: (err) => showError(err),
  });

  const reviewBlogMutation = useMutation({
    mutationFn: (data: ReviewActionRequest) => apiService.reviewBlog(id!, data),
    onSuccess: (resp) => { queryClient.invalidateQueries({ queryKey: ['blog-detail', id] }); queryClient.invalidateQueries({ queryKey: ['blogs'] }); showSuccess(resp.message); },
    onError: (err) => showError(err),
  });

  const handleSave = useCallback(async () => {
    if (!currentLocale || !blogDetail) return;
    const values = getValues();

    const blogUpdates = buildBlogUpdates(values, blogDetail);
    if (Object.keys(blogUpdates).length > 0) {
      await updateBlogMutation.mutateAsync({ blogId: blogDetail.id, data: blogUpdates as Parameters<typeof apiService.updateBlog>[1] });
    }

    const locData = buildLocalizationData(values);
    if (currentLocalization) {
      await updateLocMutation.mutateAsync({ locId: currentLocalization.id, data: { title: values.title || undefined, ...locData } });
    } else {
      await createLocMutation.mutateAsync({ locale_id: currentLocale.id, title: values.title, ...locData });
    }

    reset(values);
    showSuccess(t('blogDetail.messages.saved'));
  }, [currentLocale, currentLocalization, blogDetail, getValues, reset, updateBlogMutation, updateLocMutation, createLocMutation, showSuccess, t]);

  const { status: autosaveStatus, flush } = useAutosave({
    isDirty, onSave: handleSave,
    enabled: canWrite && userPrefs.autosave_enabled,
    debounceMs: userPrefs.autosave_debounce_seconds * 1000,
    formVersion: ui.formVersion, onError: (err) => showError(err),
  });

  const formSyncKey = useRef('');
  useEffect(() => {
    if (!blogDetail || !currentLocale) return;
    const key = `${blogDetail.id}:${currentLocale.id}`;
    if (formSyncKey.current === key) return;
    formSyncKey.current = key;
    const cached = localeFormCache.current.get(currentLocale.id);
    reset(cached ?? buildFormDefaults(blogDetail, blogDetail.localizations?.find((l) => l.locale_id === currentLocale.id)));
    formHistory.clear(); formHistory.snapshot();
  }, [blogDetail, currentLocale, reset, formHistory]);

  const localeSyncKey = useRef('');
  useEffect(() => {
    if (!blogDetail || activeLocales.length === 0) return;
    const key = `${blogDetail.id}:${activeLocales.length}`;
    if (localeSyncKey.current === key) return;
    localeSyncKey.current = key;
    const withData = activeLocales.map((locale, idx) => ({ idx, locale }))
      .filter(({ locale }) => blogDetail.localizations?.some((l) => l.locale_id === locale.id));
    if (withData.length === 1 && withData[0].idx !== ui.activeLocaleTab) dispatch({ type: 'setActiveLocaleTab', value: withData[0].idx });
  }, [blogDetail, activeLocales, ui.activeLocaleTab]);

  const handleLocaleSwitch = async (_: unknown, newValue: number) => {
    if (currentLocale) localeFormCache.current.set(currentLocale.id, getValues());
    if (isDirty) await flush();
    dispatch({ type: 'setActiveLocaleTab', value: newValue });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); flush(); }
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); formHistory.redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); formHistory.undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flush, formHistory]);

  const otherLocales = useMemo(
    () => activeLocales.filter((l) => currentLocale && l.id !== currentLocale.id),
    [activeLocales, currentLocale],
  );

  const handleOpenTranslate = () => dispatch({ type: 'openTranslateDialog', locale: otherLocales[0]?.code ?? '' });

  const { handleGenerateTranslation, handleRefreshField, handleApplyTranslation } = createTranslationHandlers({
    getValues, dispatch, ui, aiGenerate, activeLocales, currentLocale,
    localeFormCache, blogDetail, isDirty, flush, formSyncKey,
  });

  const isSaving = createLocMutation.isPending || updateLocMutation.isPending || updateBlogMutation.isPending || reviewBlogMutation.isPending;
  const currentFormStatus = watch('status') as ContentStatus;
  const workflow = useEditorialWorkflow(currentFormStatus);

  const workflowHandlers = createBlogWorkflowHandlers({ setValue, flush, dispatch, reviewBlogMutation });
  const {
    handleSubmitForReview, handleApproveClick, handleApprovePublishNow,
    handleApproveSchedule, handleRequestChanges, handleReviewCommentSubmit,
    handleUnpublish, handleArchiveClick, handleArchiveConfirm,
    handleRestoreClick, handleRestore, handleRestoreAsDraft,
  } = workflowHandlers;

  const handlePublish = () => {
    justPublishedRef.current = true;
    workflowHandlers.handlePublish();
  };

  if (isLoading) return <LoadingState label={t('blogDetail.loading')} />;
  if (error) return <Alert severity="error">{t('blogDetail.messages.saveFailed')}</Alert>;
  if (!blogDetail) return <Alert severity="warning">{t('blogDetail.notFound')}</Alert>;

  return (
    <Box>
      <PageHeader
        title={blogDetail.slug || t('common.labels.untitled')}
        breadcrumbs={[
          { label: t('layout.sidebar.blogs'), path: '/blogs' },
          { label: blogDetail.slug || t('common.labels.untitled') },
        ]}
      />

      {showFirstRunTip && (
        <FirstRunTip onDismiss={() => { localStorage.setItem(FIRST_RUN_TIP_KEY, '1'); setShowFirstRunTip(false); }} />
      )}

      <BlogEditorToolbar
        control={control} watch={watch} setValue={setValue}
        canUndo={formHistory.canUndo} canRedo={formHistory.canRedo}
        onUndo={() => formHistory.undo()} onRedo={() => formHistory.redo()}
        autosaveStatus={autosaveStatus} onSave={() => flush()}
        onToggleHistory={() => dispatch({ type: 'toggleHistory' })}
        isSaving={isSaving} canWrite={canWrite}
        canSubmitForReview={workflow.canSubmitForReview} canApprove={workflow.canApprove}
        canRequestChanges={workflow.canRequestChanges} canPublish={workflow.canPublish}
        canUnpublish={workflow.canUnpublish} canArchive={workflow.canArchive}
        canRestore={workflow.canRestore} canSchedule={workflow.canSchedule}
        onSubmitForReview={handleSubmitForReview} onApprove={handleApproveClick}
        onRequestChanges={handleRequestChanges} onPublish={handlePublish}
        onUnpublish={handleUnpublish} onArchive={handleArchiveClick} onRestore={handleRestoreClick}
        previewTemplates={previewTemplates}
        onPreview={(url) => openPreview('/blog/' + (blogDetail.slug || ''), url)}
        sidebarOpen={ui.sidebarOpen} onToggleSidebar={() => dispatch({ type: 'toggleSidebar' })}
        showAiTranslate={aiConfigured && otherLocales.length > 0} onAiTranslate={handleOpenTranslate}
      />

      {activeLocales.length > 0 ? (
        <>
          <Tabs value={ui.activeLocaleTab} onChange={handleLocaleSwitch} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
            {activeLocales.map((locale) => {
              const hasLoc = blogDetail.localizations?.some((l) => l.locale_id === locale.id);
              return (
                <Tab key={locale.id} label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {locale.code.toUpperCase()}
                    {hasLoc && <Chip label="exists" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                  </Box>
                } />
              );
            })}
          </Tabs>
          <BlogEditorContent
            control={control} getValues={getValues} watch={watch} setValue={setValue}
            onSnapshot={() => formHistory.snapshot()} blogId={blogDetail.id}
            slug={blogDetail.slug || ''} canWrite={canWrite} siteId={selectedSiteId}
            contentId={blogDetail.content_id} publishedAt={blogDetail.published_at}
            createdAt={blogDetail.created_at} updatedAt={blogDetail.updated_at}
            categories={blogDetail.categories || []} documents={blogDetail.documents || []}
            sidebarOpen={ui.sidebarOpen} onCloseSidebar={() => dispatch({ type: 'closeSidebar' })}
            sidebarTab={ui.sidebarTab} onSidebarTabChange={(v) => dispatch({ type: 'setSidebarTab', value: v })}
            isMobile={isMobile}
          />
        </>
      ) : (
        <Alert severity="info">
          <Trans i18nKey="blogDetail.noLocalesAlert" components={{ strong: <strong /> }} />
        </Alert>
      )}

      <BlogDetailDialogs
        blogId={blogDetail.id} blogSlug={blogDetail.slug || ''} isSaving={isSaving}
        historyOpen={ui.historyOpen} onHistoryClose={() => dispatch({ type: 'closeHistory' })}
        reviewDialogOpen={ui.reviewDialogOpen} onReviewDialogClose={() => dispatch({ type: 'setReviewDialogOpen', value: false })}
        onReviewCommentSubmit={handleReviewCommentSubmit} reviewLoading={reviewBlogMutation.isPending}
        approveDialogOpen={ui.approveDialogOpen} onApprovePublishNow={handleApprovePublishNow}
        onApproveSchedule={handleApproveSchedule} onApproveCancel={() => dispatch({ type: 'setApproveDialogOpen', value: false })}
        approveLoading={reviewBlogMutation.isPending}
        archiveDialogOpen={ui.archiveDialogOpen} onArchiveConfirm={handleArchiveConfirm}
        onArchiveCancel={() => dispatch({ type: 'setArchiveDialogOpen', value: false })}
        restoreDialogOpen={ui.restoreDialogOpen} onRestore={handleRestore}
        onRestoreAsDraft={handleRestoreAsDraft} onRestoreCancel={() => dispatch({ type: 'setRestoreDialogOpen', value: false })}
      />

      <BlogTranslateDialog
        open={ui.translateDialogOpen} onClose={() => dispatch({ type: 'closeTranslateDialog' })}
        otherLocales={otherLocales} translateLocale={ui.translateLocale}
        onLocaleChange={(code) => dispatch({ type: 'setTranslateLocale', value: code })}
        translationPreview={ui.translationPreview}
        onTranslationPreviewChange={(v) => dispatch({ type: 'setTranslationPreview', value: v })}
        onGenerate={handleGenerateTranslation} onRefreshField={handleRefreshField}
        onApply={handleApplyTranslation} isGenerating={aiGenerating}
        refreshingField={ui.refreshingField} hasBody={!!getValues('body')}
      />

      <FirstPublishCelebration
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        onViewPost={() => { setShowCelebration(false); openPreview('/blog/' + (blogDetail.slug || ''), previewTemplates[0]?.url); }}
        onWriteAnother={() => { setShowCelebration(false); navigate('/blogs'); }}
      />
    </Box>
  );
}
