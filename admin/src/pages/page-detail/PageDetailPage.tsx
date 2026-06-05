import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createPageLocalization, createPageSection, deletePageSection, getPage, getPageLocalizations, getPageSectionLocalizations, getPageSections, reorderPageSections, reviewPage, updatePage, updatePageLocalization } from '@/services/pages';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAuth } from '@/store/AuthContext';
import { usePreviewUrl } from '@/hooks/usePreviewUrl';
import ContentDetailPage from '@/components/shared/contentDetailPage';
import type { ContentDetailAdapter, EditorSlotProps } from '@/components/shared/contentDetailPage';
import type {
  ContentLocalizationResponse,
  CreatePageSectionRequest,
  PageResponse,
  PageSectionResponse,
  ReorderItem,
  ReviewActionRequest,
  SectionLocalizationResponse,
} from '@/types/api';
import { pageDetailSchema, type PageDetailFormData } from './pageDetailSchema';
import PageEditorToolbar from './PageEditorToolbar';
import PageDetailTabContent from './PageDetailTabContent';
import PageDetailDialogs from './PageDetailDialogs';
import { buildPageUpdates, buildSeoLocalizationData, hasSeoChanges } from './pageDetailSaveUtils';

type PageDetail = PageResponse & { localizations: ContentLocalizationResponse[] };

const pageAdapter: ContentDetailAdapter<PageDetail, PageDetailFormData, ContentLocalizationResponse> = {
  entityKey: 'page',
  fetchDetail: async (id) => {
    const [page, localizations] = await Promise.all([
      getPage(id),
      getPageLocalizations(id),
    ]);
    return { ...page, localizations: localizations ?? [] };
  },
  detailQueryKey: (id) => ['page-with-localizations', id],
  invalidateOnSave: [['pages']],
  getLocalizations: (d) => d?.localizations ?? [],
  getLocalizationLocaleId: (l) => l.locale_id,
  schema: pageDetailSchema,
  buildFormDefaults: (page, loc) => ({
    route: page?.route ?? '',
    slug: page?.slug ?? '',
    page_type: (page?.page_type as PageDetailFormData['page_type']) ?? 'Static',
    template: page?.template ?? '',
    status: (page?.status as PageDetailFormData['status']) ?? 'Draft',
    is_in_navigation: page?.is_in_navigation ?? false,
    navigation_order: page?.navigation_order ?? '',
    parent_page_id: page?.parent_page_id ?? '',
    publish_start: page?.publish_start ?? null,
    publish_end: page?.publish_end ?? null,
    meta_title: loc?.meta_title ?? '',
    meta_description: loc?.meta_description ?? '',
    excerpt: loc?.excerpt ?? '',
  }),
  buildEntityUpdates: (values, page) => buildPageUpdates(values, page) as Record<string, unknown>,
  buildLocalizationData: (values) => buildSeoLocalizationData(values),
  hasLocalizationChanges: (values, loc) => hasSeoChanges(values, loc),
  updateEntity: (id, data) => updatePage(id, data as Parameters<typeof updatePage>[1]),
  createLocalization: (entityId, localeId, data) =>
    createPageLocalization(entityId, {
      locale_id: localeId,
      title: '-',
      meta_title: data.meta_title as string | undefined,
      meta_description: data.meta_description as string | undefined,
      excerpt: data.excerpt as string | undefined,
    }),
  updateLocalization: (locId, data) =>
    updatePageLocalization(locId, data as Parameters<typeof updatePageLocalization>[1]),
  reviewEntity: (id, data: ReviewActionRequest) => reviewPage(id, data),
  i18nNamespace: 'pageDetail',
  getIcon: () => 'description',
  getTitle: (page) => page.route,
  getSubtitle: (page, t) => t('pageDetail.pageSubtitle', { type: page.page_type }),
  getBreadcrumbs: (page, t) => [
    { label: t('layout.sidebar.content') },
    { label: t('layout.sidebar.pages'), path: '/pages' },
    { label: page.route },
  ],
  getPreviewPath: (page) => page.route,
  multiLocaleTabs: false,
};

interface PageEditorProps extends EditorSlotProps<PageDetailFormData, PageDetail> {
  activeTab: number;
  onTabChange: (tab: number) => void;
}

function PageEditor({
  control,
  watch,
  setValue,
  detail,
  canWrite,
  takeSnapshot,
  activeTab,
  onTabChange,
  activeLocales,
}: PageEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { isAdmin } = useAuth();
  const pageId = detail.id;

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['page-sections', pageId],
    queryFn: () => getPageSections(pageId),
    enabled: !!pageId,
  });

  const { data: sectionLocalizations } = useQuery({
    queryKey: ['page-section-localizations', pageId],
    queryFn: () => getPageSectionLocalizations(pageId),
    enabled: !!pageId,
  });

  const createSectionMutation = useMutation({
    mutationFn: (data: CreatePageSectionRequest) => createPageSection(pageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', pageId] });
      showSuccess(t('pageDetail.sections.added'));
    },
    onError: (err) => showError(err),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => deletePageSection(sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-sections', pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-section-localizations', pageId] });
      showSuccess(t('pageDetail.sections.deleted'));
    },
    onError: (err) => showError(err),
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => reorderPageSections(pageId, items),
    onError: (err) => {
      showError(err);
      queryClient.invalidateQueries({ queryKey: ['page-sections', pageId] });
    },
  });

  return (
    <PageDetailTabContent
      activeTab={activeTab}
      onTabChange={onTabChange}
      control={control}
      watch={watch}
      setValue={setValue}
      page={detail}
      onSnapshot={takeSnapshot}
      pageId={pageId}
      sections={sections as PageSectionResponse[] | undefined}
      sectionsLoading={sectionsLoading}
      sectionLocalizations={sectionLocalizations as SectionLocalizationResponse[] | undefined}
      activeLocales={activeLocales.map((l) => ({ id: l.id, code: l.code }))}
      canWrite={canWrite}
      isAdmin={isAdmin}
      onCreateSection={(data) => createSectionMutation.mutate(data)}
      onDeleteSection={(sectionId) => deleteSectionMutation.mutate(sectionId)}
      onReorderSections={(items) => reorderSectionsMutation.mutate(items)}
      onSectionEditorClose={() => {
        queryClient.invalidateQueries({ queryKey: ['page-section-localizations', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-sections', pageId] });
      }}
      createLoading={createSectionMutation.isPending}
      deleteLoading={deleteSectionMutation.isPending}
    />
  );
}

export default function PageDetailPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { templates: previewTemplates, openPreview } = usePreviewUrl();

  return (
    <ContentDetailPage
      adapter={pageAdapter}
      renderToolbar={({ control, watch, setValue, history, onSave, isSaving, canWrite, workflow, handlers, onToggleHistory }) => (
        <PageEditorToolbar
          control={control}
          watch={watch}
          setValue={setValue}
          pageType={(watch('page_type' as never) as unknown as string) ?? 'Static'}
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
          onPreview={(url) => openPreview((watch('route' as never) as unknown as string) ?? '', url)}
        />
      )}
      renderEditor={(slots) => (
        <PageEditor {...slots} activeTab={activeTab} onTabChange={setActiveTab} />
      )}
      renderStandardDialogs={({ detail, isSaving, reviewLoading, approveLoading, dialogs, handlers }) => (
        <PageDetailDialogs
          pageId={detail.id}
          pageRoute={detail.route}
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
    />
  );
}
