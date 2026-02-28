import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { Box, Alert, Tabs, Tab, Paper } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { UpdatePageRequest, ContentStatus, ReviewActionRequest } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useEditorialWorkflow } from '@/hooks/useEditorialWorkflow';
import ReviewCommentDialog from '@/components/shared/ReviewCommentDialog';
import { useFormHistory } from '@/hooks/useFormHistory';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { useAutosave } from '@/hooks/useAutosave';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import HistoryDrawer from '@/components/shared/HistoryDrawer';
import { pageDetailSchema, type PageDetailFormData } from './pageDetailSchema';
import PageEditorToolbar from './PageEditorToolbar';
import PageInfoTab from './PageInfoTab';
import PageSectionsTab from './PageSectionsTab';

function buildFormDefaults(page: {
  route: string;
  slug?: string;
  page_type: string;
  template?: string;
  status: string;
  is_in_navigation: boolean;
  navigation_order?: number;
  parent_page_id?: string;
  publish_start?: string;
  publish_end?: string;
}): PageDetailFormData {
  return {
    route: page.route,
    slug: page.slug ?? '',
    page_type: page.page_type as PageDetailFormData['page_type'],
    template: page.template ?? '',
    status: page.status as PageDetailFormData['status'],
    is_in_navigation: page.is_in_navigation,
    navigation_order: page.navigation_order ?? '',
    parent_page_id: page.parent_page_id ?? '',
    publish_start: page.publish_start ?? null,
    publish_end: page.publish_end ?? null,
  };
}

export default function PageDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canWrite, isAdmin } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const [activeTab, setActiveTab] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  const { templates: previewTemplates, openPreview } = usePreviewUrl();

  // Queries
  const { data: page, isLoading, error } = useQuery({
    queryKey: ['page', id],
    queryFn: () => apiService.getPage(id!),
    enabled: !!id,
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['page-sections', id],
    queryFn: () => apiService.getPageSections(id!),
    enabled: !!id,
  });

  const { data: sectionLocalizations } = useQuery({
    queryKey: ['page-section-localizations', id],
    queryFn: () => apiService.getPageSectionLocalizations(id!),
    enabled: !!id,
  });

  const { data: siteLocales } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const activeLocales = (siteLocales || [])
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code }));

  // Form
  const {
    control,
    reset,
    getValues,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<PageDetailFormData>({
    resolver: zodResolver(pageDetailSchema),
    defaultValues: buildFormDefaults(page ?? {
      route: '', slug: '', page_type: 'Static', template: '',
      status: 'Draft', is_in_navigation: false,
    }),
  });

  // Bump formVersion on every form value change (restarts autosave debounce)
  useEffect(() => {
    const sub = watch(() => setFormVersion((v) => v + 1));
    return () => sub.unsubscribe();
  }, [watch]);

  // History (undo/redo)
  const formHistory = useFormHistory(getValues, reset);

  // Unsaved changes guard (blocks sidebar navigation + browser close/refresh)
  useNavigationGuard('page-editor', isDirty);

  // Mutations
  const updatePageMutation = useMutation({
    mutationFn: (data: UpdatePageRequest) => apiService.updatePage(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page', id] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (err) => {
      const { detail, title } = resolveError(err);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiService.createPageSection>[1]) =>
      apiService.createPageSection(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', id] });
      enqueueSnackbar(t('pageDetail.sections.added'), { variant: 'success' });
    },
    onError: (err) => {
      const { detail, title } = resolveError(err);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => apiService.deletePageSection(sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', id] });
      queryClient.invalidateQueries({ queryKey: ['page-section-localizations', id] });
      enqueueSnackbar(t('pageDetail.sections.deleted'), { variant: 'success' });
    },
    onError: (err) => {
      const { detail, title } = resolveError(err);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const reviewPageMutation = useMutation({
    mutationFn: (data: ReviewActionRequest) => apiService.reviewPage(id!, data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['page', id] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      enqueueSnackbar(resp.message, { variant: 'success' });
    },
    onError: (err) => {
      const { detail, title } = resolveError(err);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  // Unified save
  const handleSave = useCallback(async () => {
    if (!page) return;

    const values = getValues();
    const updates: UpdatePageRequest = {};

    if (values.route !== page.route) updates.route = values.route;
    if (values.slug !== (page.slug ?? '')) updates.slug = values.slug;
    if (values.page_type !== page.page_type) updates.page_type = values.page_type;
    if ((values.template ?? '') !== (page.template ?? '')) updates.template = values.template || undefined;
    if (values.status !== page.status) updates.status = values.status;
    if (values.is_in_navigation !== page.is_in_navigation) updates.is_in_navigation = values.is_in_navigation;

    const navOrder = values.navigation_order === '' ? undefined : Number(values.navigation_order);
    if (navOrder !== page.navigation_order) updates.navigation_order = navOrder;

    const parentId = values.parent_page_id || undefined;
    if (parentId !== page.parent_page_id) updates.parent_page_id = parentId;

    // Scheduling fields — always send current values explicitly
    const formStart = values.publish_start || null;
    const formEnd = values.publish_end || null;
    if (formStart !== (page.publish_start ?? null)) updates.publish_start = formStart;
    if (formEnd !== (page.publish_end ?? null)) updates.publish_end = formEnd;

    if (Object.keys(updates).length > 0) {
      await updatePageMutation.mutateAsync(updates);
    }

    reset(values);
    enqueueSnackbar(t('pageDetail.messages.saved'), { variant: 'success' });
  }, [page, getValues, reset, updatePageMutation, enqueueSnackbar, t]);

  // Autosave
  const { status: autosaveStatus, flush } = useAutosave({
    isDirty,
    onSave: handleSave,
    enabled: canWrite,
    formVersion,
    onError: (err) => {
      const { detail, title } = resolveError(err);
      enqueueSnackbar(detail || title || t('shared.autosave.retryFailed'), { variant: 'error' });
    },
  });

  // Initialize form when page data loads
  useEffect(() => {
    if (!page) return;
    reset(buildFormDefaults(page));
    formHistory.clear();
    formHistory.snapshot();
  }, [page?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        flush();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        formHistory.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        formHistory.undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flush, formHistory]);

  const isSaving = updatePageMutation.isPending || reviewPageMutation.isPending;

  // Editorial workflow
  const currentFormStatus = watch('status') as ContentStatus;
  const workflow = useEditorialWorkflow(currentFormStatus);

  const handleSubmitForReview = () => {
    setValue('status', 'InReview' as PageDetailFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleApprove = () => {
    reviewPageMutation.mutate({ action: 'approve' });
  };

  const handleRequestChanges = () => {
    setReviewDialogOpen(true);
  };

  const handleReviewCommentSubmit = (comment?: string) => {
    setReviewDialogOpen(false);
    reviewPageMutation.mutate({ action: 'request_changes', comment });
  };

  if (isLoading) return <LoadingState label={t('pageDetail.loading')} />;
  if (error || !page) return <Alert severity="error">{t('pageDetail.loadFailed')}</Alert>;

  const tabs = [
    { key: 'info', label: t('pageDetail.tabs.info') },
    { key: 'sections', label: t('pageDetail.tabs.sections') },
  ];

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
        onToggleHistory={() => setHistoryOpen((o) => !o)}
        isSaving={isSaving}
        canWrite={canWrite}
        allowedStatuses={workflow.allowedStatuses}
        canSubmitForReview={workflow.canSubmitForReview}
        canApprove={workflow.canApprove}
        canRequestChanges={workflow.canRequestChanges}
        onSubmitForReview={handleSubmitForReview}
        onApprove={handleApprove}
        onRequestChanges={handleRequestChanges}
        previewTemplates={previewTemplates}
        onPreview={(url) => openPreview(page.route, url)}
      />

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} label={tab.label} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <PageInfoTab
              control={control}
              watch={watch}
              page={page}
              onSnapshot={() => formHistory.snapshot()}
            />
          )}
          {activeTab === 1 && (
            <PageSectionsTab
              pageId={page.id}
              sections={sections}
              sectionsLoading={sectionsLoading}
              sectionLocalizations={sectionLocalizations}
              activeLocales={activeLocales}
              canWrite={canWrite}
              isAdmin={isAdmin}
              onCreateSection={(data) => createSectionMutation.mutate(data)}
              onDeleteSection={(sectionId) => deleteSectionMutation.mutate(sectionId)}
              onSectionEditorClose={() => {
                queryClient.invalidateQueries({ queryKey: ['page-section-localizations', id] });
                queryClient.invalidateQueries({ queryKey: ['page-sections', id] });
              }}
              createLoading={createSectionMutation.isPending}
              deleteLoading={deleteSectionMutation.isPending}
            />
          )}
        </Box>
      </Paper>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="page"
        entityId={page.id}
      />

      <ReviewCommentDialog
        open={reviewDialogOpen}
        title={t('workflow.requestChanges')}
        onClose={() => setReviewDialogOpen(false)}
        onSubmit={handleReviewCommentSubmit}
        loading={reviewPageMutation.isPending}
      />
    </Box>
  );
}
