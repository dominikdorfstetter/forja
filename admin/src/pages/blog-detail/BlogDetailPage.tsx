import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import {
  Alert,
  Box,
  Chip,
  Drawer,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tabs,
  Tab,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  ContentLocalizationResponse,
  BlogDetailResponse,
  ContentStatus,
  ReviewActionRequest,
} from '@/types/api';
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
import { ForjaEditor } from '@/components/editor';
import {
  blogContentSchema,
  type BlogContentFormData,
  calculateReadingTime,
  parseToc,
} from './blogDetailSchema';
import BlogEditorToolbar from './BlogEditorToolbar';
import BlogEditorSidebar from './BlogEditorSidebar';
import HistoryDrawer from '@/components/shared/HistoryDrawer';

const SIDEBAR_WIDTH = 380;

function buildFormDefaults(
  blog: BlogDetailResponse | undefined,
  loc: ContentLocalizationResponse | undefined,
): BlogContentFormData {
  return {
    title: loc?.title ?? '',
    subtitle: loc?.subtitle ?? '',
    excerpt: loc?.excerpt ?? '',
    body: loc?.body ?? '',
    meta_title: loc?.meta_title ?? '',
    meta_description: loc?.meta_description ?? '',
    author: blog?.author ?? '',
    published_date: blog?.published_date?.split('T')[0] ?? '',
    status: (blog?.status as BlogContentFormData['status']) ?? 'Draft',
    is_featured: blog?.is_featured ?? false,
    allow_comments: blog?.allow_comments ?? false,
    reading_time_minutes: blog?.reading_time_minutes ?? null,
    reading_time_override: false,
    publish_start: blog?.publish_start ?? null,
    publish_end: blog?.publish_end ?? null,
    cover_image_id: blog?.cover_image_id ?? null,
    header_image_id: blog?.header_image_id ?? null,
  };
}

export default function BlogDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { canWrite } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [activeLocaleTab, setActiveLocaleTab] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState(0);

  const { templates: previewTemplates, openPreview } = usePreviewUrl();

  // Cache for locale form data
  const localeFormCache = useRef<Map<string, BlogContentFormData>>(new Map());

  // Queries
  const { data: blogDetail, isLoading, error } = useQuery({
    queryKey: ['blog-detail', id],
    queryFn: () => apiService.getBlogDetail(id!),
    enabled: !!id,
  });

  const { data: siteLocales } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const activeLocales = (siteLocales || [])
    .filter((sl) => sl.is_active)
    .map((sl) => ({
      id: sl.locale_id,
      code: sl.code,
      name: sl.name,
      native_name: sl.native_name,
      direction: sl.direction,
      is_active: sl.is_active,
      created_at: sl.created_at,
    }));

  const currentLocale = activeLocales[activeLocaleTab];
  const currentLocalization = blogDetail?.localizations?.find(
    (l) => currentLocale && l.locale_id === currentLocale.id,
  );

  // Form
  const {
    control,
    reset,
    getValues,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<BlogContentFormData>({
    resolver: zodResolver(blogContentSchema),
    defaultValues: buildFormDefaults(blogDetail, currentLocalization),
  });

  // Bump formVersion on every form value change (restarts autosave debounce)
  useEffect(() => {
    const sub = watch(() => setFormVersion((v) => v + 1));
    return () => sub.unsubscribe();
  }, [watch]);

  // History (undo/redo)
  const formHistory = useFormHistory(getValues, reset);

  // Unsaved changes guard (blocks sidebar navigation + browser close/refresh)
  useNavigationGuard('blog-editor', isDirty);

  // Mutations
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
    mutationFn: ({ blogId, data }: { blogId: string; data: Parameters<typeof apiService.updateBlog>[1] }) =>
      apiService.updateBlog(blogId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
    },
    onError: (err) => showError(err),
  });

  const reviewBlogMutation = useMutation({
    mutationFn: (data: ReviewActionRequest) => apiService.reviewBlog(id!, data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['blog-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(resp.message);
    },
    onError: (err) => showError(err),
  });

  // Unified save
  const handleSave = useCallback(async () => {
    if (!currentLocale || !blogDetail) return;

    const values = getValues();

    // Diff blog-level fields
    const blogUpdates: Record<string, unknown> = {};
    if (values.status !== blogDetail.status) blogUpdates.status = values.status;
    if (values.author !== blogDetail.author) blogUpdates.author = values.author;
    if (values.published_date !== blogDetail.published_date?.split('T')[0]) blogUpdates.published_date = values.published_date;
    if (values.is_featured !== blogDetail.is_featured) blogUpdates.is_featured = values.is_featured;
    if (values.allow_comments !== blogDetail.allow_comments) blogUpdates.allow_comments = values.allow_comments;

    // Reading time
    const readingTime = values.reading_time_override
      ? values.reading_time_minutes
      : calculateReadingTime(values.body);
    if (readingTime && readingTime !== blogDetail.reading_time_minutes) {
      blogUpdates.reading_time_minutes = readingTime;
    }

    // Scheduling fields — always send current values explicitly
    const formStart = values.publish_start || null;
    const formEnd = values.publish_end || null;
    if (formStart !== (blogDetail.publish_start ?? null)) blogUpdates.publish_start = formStart;
    if (formEnd !== (blogDetail.publish_end ?? null)) blogUpdates.publish_end = formEnd;

    // Image fields
    const formCoverImage = values.cover_image_id || null;
    const formHeaderImage = values.header_image_id || null;
    if (formCoverImage !== (blogDetail.cover_image_id ?? null)) blogUpdates.cover_image_id = formCoverImage;
    if (formHeaderImage !== (blogDetail.header_image_id ?? null)) blogUpdates.header_image_id = formHeaderImage;

    if (Object.keys(blogUpdates).length > 0) {
      await updateBlogMutation.mutateAsync({ blogId: blogDetail.id, data: blogUpdates as Parameters<typeof apiService.updateBlog>[1] });
    }

    // Localization
    const locData = {
      subtitle: values.subtitle || undefined,
      excerpt: values.excerpt || undefined,
      body: values.body || undefined,
      meta_title: values.meta_title || undefined,
      meta_description: values.meta_description || undefined,
    };

    if (currentLocalization) {
      await updateLocMutation.mutateAsync({ locId: currentLocalization.id, data: { title: values.title || undefined, ...locData } });
    } else {
      await createLocMutation.mutateAsync({ locale_id: currentLocale.id, title: values.title, ...locData });
    }

    // Clear dirty state
    reset(values);
    showSuccess(t('blogDetail.messages.saved'));
  }, [
    currentLocale, currentLocalization, blogDetail, getValues, reset,
    updateBlogMutation, updateLocMutation, createLocMutation, showSuccess, t,
  ]);

  // Autosave
  const { status: autosaveStatus, flush } = useAutosave({
    isDirty,
    onSave: handleSave,
    enabled: canWrite,
    formVersion,
    onError: (err) => showError(err),
  });

  // Initialize form when data loads (guarded by ID to prevent resetting on background refetch)
  const formSyncKey = useRef('');
  useEffect(() => {
    if (!blogDetail || !currentLocale) return;
    const key = `${blogDetail.id}:${currentLocale.id}`;
    if (formSyncKey.current === key) return;
    formSyncKey.current = key;
    const cached = localeFormCache.current.get(currentLocale.id);
    if (cached) {
      reset(cached);
    } else {
      const loc = blogDetail.localizations?.find((l) => l.locale_id === currentLocale.id);
      reset(buildFormDefaults(blogDetail, loc));
    }
    formHistory.clear();
    formHistory.snapshot();
  }, [blogDetail, currentLocale, reset, formHistory]);

  // Auto-select locale with data
  const localeSyncKey = useRef('');
  useEffect(() => {
    if (!blogDetail || activeLocales.length === 0) return;
    const key = `${blogDetail.id}:${activeLocales.length}`;
    if (localeSyncKey.current === key) return;
    localeSyncKey.current = key;
    const localesWithData = activeLocales
      .map((locale, idx) => ({ idx, locale }))
      .filter(({ locale }) => blogDetail.localizations?.some((l) => l.locale_id === locale.id));
    if (localesWithData.length === 1 && localesWithData[0].idx !== activeLocaleTab) {
      setActiveLocaleTab(localesWithData[0].idx);
    }
  }, [blogDetail, activeLocales, activeLocaleTab]);

  // Locale tab switch
  const handleLocaleSwitch = async (_: unknown, newValue: number) => {
    // Save current locale's form data to cache
    if (currentLocale) {
      const values = getValues();
      localeFormCache.current.set(currentLocale.id, values);
    }

    // Flush autosave if dirty
    if (isDirty) await flush();

    setActiveLocaleTab(newValue);
  };

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

  const isSaving = createLocMutation.isPending || updateLocMutation.isPending || updateBlogMutation.isPending || reviewBlogMutation.isPending;

  // Editorial workflow
  const currentFormStatus = watch('status') as ContentStatus;
  const workflow = useEditorialWorkflow(currentFormStatus);

  const handleSubmitForReview = () => {
    setValue('status', 'InReview' as BlogContentFormData['status'], { shouldDirty: true });
    flush();
  };

  const handleApprove = () => {
    reviewBlogMutation.mutate({ action: 'approve' });
  };

  const handleRequestChanges = () => {
    setReviewDialogOpen(true);
  };

  const handleReviewCommentSubmit = (comment?: string) => {
    setReviewDialogOpen(false);
    reviewBlogMutation.mutate({ action: 'request_changes', comment });
  };

  if (isLoading) return <LoadingState label={t('blogDetail.loading')} />;
  if (error) return <Alert severity="error">{t('blogDetail.messages.saveFailed')}</Alert>;
  if (!blogDetail) return <Alert severity="warning">{t('blogDetail.notFound')}</Alert>;

  // ToC from body
  const body = getValues('body');
  const tocItems = parseToc(body);

  const sidebarContent = (
    <BlogEditorSidebar
      activeTab={sidebarTab}
      onTabChange={setSidebarTab}
      control={control}
      watch={watch}
      setValue={setValue}
      onSnapshot={() => formHistory.snapshot()}
      blogId={blogDetail.id}
      slug={blogDetail.slug || ''}
      canWrite={canWrite}
      siteId={selectedSiteId}
      contentId={blogDetail.content_id}
      categories={blogDetail.categories || []}
      documents={blogDetail.documents || []}
    />
  );

  return (
    <Box>
      <PageHeader
        title={blogDetail.slug || t('common.labels.untitled')}
        breadcrumbs={[
          { label: t('layout.sidebar.blogs'), path: '/blogs' },
          { label: blogDetail.slug || t('common.labels.untitled') },
        ]}
      />

      <BlogEditorToolbar
        control={control}
        watch={watch}
        setValue={setValue}
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
        onPreview={(url) => openPreview('/blog/' + (blogDetail.slug || ''), url)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />

      {/* Locale Tabs */}
      {activeLocales.length > 0 ? (
        <>
          <Tabs
            value={activeLocaleTab}
            onChange={handleLocaleSwitch}
            sx={{ mb: 2 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {activeLocales.map((locale) => {
              const hasLoc = blogDetail.localizations?.some((l) => l.locale_id === locale.id);
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

          <Box sx={{ display: 'flex', gap: 0 }}>
            {/* Editor area */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper sx={{ p: 3, mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: tocItems.length > 0 ? 9 : 12 }}>
                    <Controller
                      name="title"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label={t('blogDetail.fields.title')}
                          fullWidth
                          required
                          onBlur={() => { field.onBlur(); formHistory.snapshot(); }}
                          sx={{ mb: 2 }}
                        />
                      )}
                    />

                    <Controller
                      name="subtitle"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label={t('blogDetail.fields.subtitle')}
                          fullWidth
                          onBlur={() => { field.onBlur(); formHistory.snapshot(); }}
                          sx={{ mb: 2 }}
                        />
                      )}
                    />

                    <Controller
                      name="body"
                      control={control}
                      render={({ field }) => (
                        <ForjaEditor
                          value={field.value}
                          onChange={(val) => field.onChange(val)}
                          onBlur={() => { field.onBlur(); formHistory.snapshot(); }}
                          height={500}
                          placeholder={t('editor.placeholder')}
                          siteId={selectedSiteId}
                        />
                      )}
                    />
                  </Grid>

                  {tocItems.length > 0 && (
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Paper sx={{ p: 2, position: 'sticky', top: 140 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('blogDetail.toc')}
                        </Typography>
                        <List dense>
                          {tocItems.map((item, idx) => (
                            <ListItem key={idx} sx={{ pl: (item.level - 1) * 2 }}>
                              <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  fontWeight: item.level === 1 ? 600 : 400,
                                }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Box>

            {/* Sidebar — desktop: inline sticky, mobile: Drawer */}
            {isMobile ? (
              <Drawer
                anchor="right"
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                PaperProps={{ sx: { width: SIDEBAR_WIDTH, maxWidth: '90vw' } }}
              >
                {sidebarContent}
              </Drawer>
            ) : (
              sidebarOpen && (
                <Box
                  sx={{
                    width: SIDEBAR_WIDTH,
                    flexShrink: 0,
                    borderLeft: 1,
                    borderColor: 'divider',
                    position: 'sticky',
                    top: 128,
                    height: 'calc(100vh - 128px)',
                    display: 'flex',
                    flexDirection: 'column',
                    ml: 0,
                  }}
                >
                  {sidebarContent}
                </Box>
              )
            )}
          </Box>
        </>
      ) : (
        <Alert severity="info">
          <span dangerouslySetInnerHTML={{ __html: t('blogDetail.noLocalesAlert') }} />
        </Alert>
      )}

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entityType="blog"
        entityId={blogDetail.id}
      />

      <ReviewCommentDialog
        open={reviewDialogOpen}
        title={t('workflow.requestChanges')}
        onClose={() => setReviewDialogOpen(false)}
        onSubmit={handleReviewCommentSubmit}
        loading={reviewBlogMutation.isPending}
      />
    </Box>
  );
}
