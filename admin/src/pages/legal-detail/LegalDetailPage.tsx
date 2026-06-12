import { Box } from '@mui/material';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createLegalLocalization, createLegalVersion, getLegalDocumentDetail, updateLegalDocument, updateLegalLocalization } from '@/services/legal';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import ContentDetailPage from '@/components/shared/contentDetailPage';
import type { ContentDetailAdapter } from '@/components/shared/contentDetailPage';
import type { ContentLocalizationResponse, LegalDocumentFullDetailResponse } from '@/types/api';
import { legalContentSchema, type LegalContentFormData } from './legalDetailSchema';
import LegalEditorToolbar from './LegalEditorToolbar';
import LegalEditorContent from './LegalEditorContent';
import LegalDetailDialogs from './LegalDetailDialogs';
import LegalVersionPanel from './LegalVersionPanel';
import { buildLegalUpdates, buildLocalizationData } from './legalDetailSaveUtils';
import { queryKeys } from '@/lib/queryKeys';

const legalAdapter: ContentDetailAdapter<LegalDocumentFullDetailResponse, LegalContentFormData, ContentLocalizationResponse> = {
  entityKey: 'legal',
  fetchDetail: (id) => getLegalDocumentDetail(id),
  detailQueryKey: (id) => queryKeys.legalDetail(id),
  invalidateOnSave: [['legal']],
  getLocalizations: (d) => d?.localizations ?? [],
  getLocalizationLocaleId: (l) => l.locale_id,
  schema: legalContentSchema,
  buildFormDefaults: (detail, loc) => {
    const docLoc = loc ? detail?.doc_localizations?.find((dl) => dl.locale_id === loc.locale_id) : undefined;
    return {
      title: loc?.title ?? docLoc?.title ?? '',
      body: loc?.body ?? '',
      meta_title: loc?.meta_title ?? '',
      meta_description: loc?.meta_description ?? '',
      intro: docLoc?.intro ?? '',
      status: (detail?.status as LegalContentFormData['status']) ?? 'Draft',
      publish_start: detail?.publish_start ?? null,
      publish_end: detail?.publish_end ?? null,
    };
  },
  buildEntityUpdates: (values, detail) => buildLegalUpdates(values, detail) as Record<string, unknown>,
  buildLocalizationData: (values) => buildLocalizationData(values),
  getLocTitleField: (values) => values.title || undefined,
  updateEntity: (id, data) => updateLegalDocument(id, data as Parameters<typeof updateLegalDocument>[1]),
  createLocalization: (entityId, _localeId, data) =>
    createLegalLocalization(entityId, data as unknown as Parameters<typeof createLegalLocalization>[1]),
  updateLocalization: (locId, data) =>
    updateLegalLocalization(locId, data as unknown as Parameters<typeof updateLegalLocalization>[1]),
  i18nNamespace: 'legalDetail',
  getIcon: () => 'gavel',
  getTitle: (detail, t) => detail.slug || detail.cookie_name || t('legalDetail.title'),
  getBreadcrumbs: (detail, t) => [
    { label: t('layout.sidebar.content') },
    {
      label: detail.document_type === 'CookieConsent'
        ? t('legal.tabs.cookieConsent')
        : t('legal.tabs.documents'),
      path: detail.document_type === 'CookieConsent' ? '/legal?tab=cookie-consent' : '/legal',
    },
    { label: detail.slug || detail.cookie_name || t('legalDetail.title') },
  ],
  getPreviewPath: (detail) => `/legal/${detail.slug || detail.cookie_name || ''}`,
  multiLocaleTabs: true,
  pageTestId: 'legal-detail.page',
};

export default function LegalDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError, showSuccess } = useErrorSnackbar();

  const createVersionMutation = useMutation({
    mutationFn: (id: string) => createLegalVersion(id),
    onSuccess: (newDoc) => {
      showSuccess(t('legalDetail.versions.created'));
      navigate(`/legal/${newDoc.id}`);
    },
    onError: (err) => showError(err),
  });

  return (
    <ContentDetailPage
      adapter={legalAdapter}
      renderToolbar={({ watch, setValue, history, onSave, isSaving, canWrite, workflow, handlers, onToggleHistory, detail }) => (
        <LegalEditorToolbar
          watch={watch}
          setValue={setValue}
          version={detail.version}
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
          onPublish={handlers.handlePublish}
          onUnpublish={handlers.handleUnpublish}
          onArchive={handlers.handleArchiveClick}
          onRestore={handlers.handleRestoreClick}
          canCreateVersion={canWrite && detail.status === 'Published'}
          onCreateVersion={() => createVersionMutation.mutate(detail.id)}
        />
      )}
      renderEditor={({ control, canWrite, selectedSiteId, takeSnapshot }) => (
        <LegalEditorContent
          control={control}
          onSnapshot={takeSnapshot}
          canWrite={canWrite}
          siteId={selectedSiteId}
        />
      )}
      renderExtraPanels={({ detail }) => (
        <Box sx={{ mt: 3 }}>
          <LegalVersionPanel documentId={detail.id} currentVersion={detail.version ?? 1} />
        </Box>
      )}
      renderStandardDialogs={({ detail, isSaving, dialogs, handlers }) => (
        <LegalDetailDialogs
          legalId={detail.id}
          legalSlug={detail.slug || detail.cookie_name || ''}
          isSaving={isSaving}
          historyOpen={dialogs.historyOpen}
          onHistoryClose={dialogs.closeHistory}
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
