import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMediaQuery, useTheme } from '@mui/material';
import { createBlogLocalization, getBlogDetail, reviewBlog, updateBlog, updateBlogLocalization } from '@/services/blogs';
import { useSiteContext } from '@/store/SiteContext';
import { useAiAssist } from '@/hooks/useAiAssist';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import FirstRunTip from '@/components/FirstRunTip';
import FirstPublishCelebration from '@/components/FirstPublishCelebration';
import ContentDetailPage from '@/components/shared/contentDetailPage';
import type { ContentDetailAdapter } from '@/components/shared/contentDetailPage';
import type { BlogDetailResponse, ContentLocalizationResponse, ReviewActionRequest } from '@/types/api';
import { blogContentSchema, type BlogContentFormData } from './blogDetailSchema';
import BlogEditorToolbar from './BlogEditorToolbar';
import BlogEditorContent from './BlogEditorContent';
import BlogTranslateDialog, { type TranslationPreview } from './BlogTranslateDialog';
import BlogDetailDialogs from './BlogDetailDialogs';
import { buildBlogUpdates, buildLocalizationData } from './blogDetailSaveUtils';

const FIRST_RUN_TIP_KEY = 'forja_editor_tip_dismissed';

const blogAdapter: ContentDetailAdapter<BlogDetailResponse, BlogContentFormData, ContentLocalizationResponse> = {
  entityKey: 'blog',
  fetchDetail: (id) => getBlogDetail(id),
  detailQueryKey: (id) => ['blog-detail', id],
  invalidateOnSave: [['blogs']],
  getLocalizations: (d) => d?.localizations ?? [],
  getLocalizationLocaleId: (l) => l.locale_id,
  schema: blogContentSchema,
  buildFormDefaults: (blog, loc) => ({
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
  }),
  buildEntityUpdates: (values, detail) => buildBlogUpdates(values, detail),
  buildLocalizationData: (values) => buildLocalizationData(values),
  getLocTitleField: (values) => values.title || undefined,
  updateEntity: (id, data) => updateBlog(id, data as unknown as Parameters<typeof updateBlog>[1]),
  createLocalization: (entityId, _localeId, data) =>
    createBlogLocalization(entityId, data as unknown as Parameters<typeof createBlogLocalization>[1]),
  updateLocalization: (locId, data) =>
    updateBlogLocalization(locId, data as unknown as Parameters<typeof updateBlogLocalization>[1]),
  reviewEntity: (id, data: ReviewActionRequest) => reviewBlog(id, data),
  i18nNamespace: 'blogDetail',
  getIcon: () => 'article',
  getTitle: (detail, t) => detail.slug || t('common.labels.untitled'),
  getBreadcrumbs: (detail, t) => [
    { label: t('layout.sidebar.content') },
    { label: t('layout.sidebar.blogs'), path: '/blogs' },
    { label: detail.slug || t('common.labels.untitled') },
  ],
  getPreviewPath: (detail) => '/blog/' + (detail.slug || ''),
  multiLocaleTabs: true,
};

export default function BlogDetailPage() {
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { templates: previewTemplates, openPreview } = usePreviewUrl();
  const { isConfigured: aiConfigured, generate: aiGenerate, isGenerating: aiGenerating } = useAiAssist();

  const [showFirstRunTip, setShowFirstRunTip] = useState(() => !localStorage.getItem(FIRST_RUN_TIP_KEY));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [translateLocale, setTranslateLocale] = useState('');
  const [translationPreview, setTranslationPreview] = useState<TranslationPreview>(null);
  const [refreshingField, setRefreshingField] = useState<string | null>(null);

  const firstPublishKey = `forja_first_publish_celebrated_${selectedSiteId}`;
  const [showCelebration, setShowCelebration] = useState(false);

  return (
    <ContentDetailPage
      adapter={useMemo(() => ({
        ...blogAdapter,
        onPublishStart: () => {
          if (!localStorage.getItem(firstPublishKey)) {
            // Defer flag to onPublishSuccess so we only celebrate when the save lands.
          }
        },
        onPublishSuccess: () => {
          if (!localStorage.getItem(firstPublishKey)) {
            localStorage.setItem(firstPublishKey, '1');
            setShowCelebration(true);
          }
        },
      }), [firstPublishKey])}
      renderHeaderExtras={() =>
        showFirstRunTip ? (
          <FirstRunTip
            onDismiss={() => {
              localStorage.setItem(FIRST_RUN_TIP_KEY, '1');
              setShowFirstRunTip(false);
            }}
          />
        ) : null
      }
      renderToolbar={({ control, watch, setValue, history, onSave, isSaving, canWrite, workflow, handlers, onToggleHistory }) => {
        const otherLocalesPresent = aiConfigured;
        return (
          <BlogEditorToolbar
            control={control}
            watch={watch}
            setValue={setValue}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            onSave={onSave}
            onToggleHistory={onToggleHistory}
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
            onSubmitForReview={handlers.handleSubmitForReview}
            onApprove={handlers.handleApproveClick}
            onRequestChanges={handlers.handleRequestChanges}
            onPublish={handlers.handlePublish}
            onUnpublish={handlers.handleUnpublish}
            onArchive={handlers.handleArchiveClick}
            onRestore={handlers.handleRestoreClick}
            previewTemplates={previewTemplates}
            onPreview={(url) => openPreview('/blog/' + (watch('slug' as never) ?? ''), url)}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            showAiTranslate={otherLocalesPresent}
            onAiTranslate={() => setTranslateDialogOpen(true)}
          />
        );
      }}
      renderEditor={({ control, watch, setValue, getValues, detail, canWrite, selectedSiteId: siteId, takeSnapshot }) => (
        <BlogEditorContent
          control={control}
          getValues={getValues}
          watch={watch}
          setValue={setValue}
          onSnapshot={takeSnapshot}
          blogId={detail.id}
          slug={detail.slug || ''}
          canWrite={canWrite}
          siteId={siteId}
          contentId={detail.content_id}
          publishedAt={detail.published_at ?? undefined}
          createdAt={detail.created_at}
          updatedAt={detail.updated_at}
          categories={detail.categories || []}
          tags={detail.tags || []}
          documents={detail.documents || []}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          sidebarTab={sidebarTab}
          onSidebarTabChange={setSidebarTab}
          isMobile={isMobile}
        />
      )}
      renderStandardDialogs={({ detail, isSaving, reviewLoading, approveLoading, dialogs, handlers }) => (
        <BlogDetailDialogs
          blogId={detail.id}
          blogSlug={detail.slug || ''}
          isSaving={isSaving}
          historyOpen={dialogs.historyOpen}
          onHistoryClose={dialogs.closeHistory}
          reviewDialogOpen={dialogs.reviewDialogOpen}
          onReviewDialogClose={dialogs.closeReviewDialog}
          onReviewCommentSubmit={handlers.handleReviewCommentSubmit}
          reviewLoading={reviewLoading}
          approveDialogOpen={dialogs.approveDialogOpen}
          onApprovePublishNow={handlers.handleApprovePublishNow}
          onApproveSchedule={handlers.handleApproveSchedule}
          onApproveCancel={dialogs.closeApproveDialog}
          approveLoading={approveLoading}
          archiveDialogOpen={dialogs.archiveDialogOpen}
          onArchiveConfirm={handlers.handleArchiveConfirm}
          onArchiveCancel={dialogs.closeArchiveDialog}
          restoreDialogOpen={dialogs.restoreDialogOpen}
          onRestore={handlers.handleRestore}
          onRestoreAsDraft={handlers.handleRestoreAsDraft}
          onRestoreCancel={dialogs.closeRestoreDialog}
        />
      )}
      renderExtraDialogs={({ getValues, detail, activeLocales, currentLocale, isDirty, save, setActiveLocaleTab, cacheFormValues, getCachedFormValues }) => {
        const otherLocales = activeLocales.filter((l) => currentLocale && l.id !== currentLocale.id);
        const handleGenerate = async () => {
          const values = getValues();
          if (!values.body || !translateLocale) return;
          const content = JSON.stringify({
            title: values.title, subtitle: values.subtitle, excerpt: values.excerpt,
            body: values.body, meta_title: values.meta_title, meta_description: values.meta_description,
          });
          const result = await aiGenerate('translate', content, translateLocale);
          setTranslationPreview({
            title: result.title, subtitle: result.subtitle, excerpt: result.excerpt,
            body: result.body, meta_title: result.meta_title, meta_description: result.meta_description,
          });
        };
        const handleRefresh = async (field: 'title' | 'subtitle' | 'excerpt' | 'body' | 'meta_title' | 'meta_description') => {
          const values = getValues();
          const sourceValue = values[field];
          if (!sourceValue || !translateLocale) return;
          setRefreshingField(field);
          try {
            const result = await aiGenerate('translate', JSON.stringify({ [field]: sourceValue }), translateLocale);
            const translated = result[field];
            if (translated && translationPreview) {
              setTranslationPreview((prev) => (prev ? { ...prev, [field]: translated } : prev));
            }
          } finally {
            setRefreshingField(null);
          }
        };
        const handleApply = async () => {
          if (!translationPreview || !translateLocale || !currentLocale) return;
          const targetLocale = activeLocales.find((l) => l.code === translateLocale);
          if (!targetLocale) return;
          const targetTabIndex = activeLocales.indexOf(targetLocale);
          cacheFormValues(currentLocale.id, getValues());
          if (isDirty) await save();
          const existingLoc = (detail.localizations ?? []).find((l) => l.locale_id === targetLocale.id);
          const existingCache = getCachedFormValues(targetLocale.id);
          const base = existingCache ?? blogAdapter.buildFormDefaults(detail, existingLoc);
          const prev = translationPreview;
          const merged: BlogContentFormData = {
            ...base,
            ...(prev.title && { title: prev.title }),
            ...(prev.subtitle && { subtitle: prev.subtitle }),
            ...(prev.excerpt && { excerpt: prev.excerpt }),
            ...(prev.body && { body: prev.body }),
            ...(prev.meta_title && { meta_title: prev.meta_title }),
            ...(prev.meta_description && { meta_description: prev.meta_description }),
          };
          cacheFormValues(targetLocale.id, merged);
          setTranslateDialogOpen(false);
          setTranslationPreview(null);
          setActiveLocaleTab(targetTabIndex);
        };
        return (
          <>
            <BlogTranslateDialog
              open={translateDialogOpen}
              onClose={() => setTranslateDialogOpen(false)}
              otherLocales={otherLocales}
              translateLocale={translateLocale}
              onLocaleChange={(code) => { setTranslateLocale(code); setTranslationPreview(null); }}
              translationPreview={translationPreview}
              onTranslationPreviewChange={setTranslationPreview}
              onGenerate={handleGenerate}
              onRefreshField={handleRefresh}
              onApply={handleApply}
              isGenerating={aiGenerating}
              refreshingField={refreshingField}
              hasBody={!!getValues('body')}
            />
            <FirstPublishCelebration
              open={showCelebration}
              onClose={() => setShowCelebration(false)}
              onViewPost={() => {
                setShowCelebration(false);
                openPreview('/blog/' + (detail.slug || ''), previewTemplates[0]?.url);
              }}
              onWriteAnother={() => { setShowCelebration(false); navigate('/blogs'); }}
            />
          </>
        );
      }}
    />
  );
}
