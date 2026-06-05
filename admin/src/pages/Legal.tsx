import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Box, Tab, Tabs } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import {
  deleteLegalDocument,
  getLegalDocuments,
  updateLegalDocument,
} from '@/services/legal';
import type {
  BulkContentRequest,
  BulkContentResponse,
  ContentStatus,
  LegalDocumentResponse,
  Paginated,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { PageHeader, pageTabsSx } from '@/components/shared/listPageV2';
import { M3Button, Icon } from '@/components/design-system';
import EmptyState from '@/components/shared/EmptyState';
import { ContentEntityActionMenu } from '@/components/shared/contentEntityActionMenu';
import CreateLegalDocumentWizard from '@/components/legal/CreateLegalDocumentWizard';
import CookieConsentPage from '@/pages/CookieConsentPage';
import EntityListPage, { ContentEntityDialogs } from '@/components/shared/entityListPage';
import type { EntityListAdapter } from '@/components/shared/entityListPage';
import { buildLegalChipFilters, buildLegalColumns } from '@/pages/LegalTableConfig';

/**
 * Run individual legal mutations in parallel; map the result into the harness's
 * `BulkContentResponse` shape. Legal has no backend bulk endpoint, so we
 * fan out per-id at the adapter boundary.
 */
async function legalBulkAction(_siteId: string, request: BulkContentRequest): Promise<BulkContentResponse> {
  const settled = await Promise.allSettled(
    request.ids.map((id) => {
      if (request.action === 'Delete') return deleteLegalDocument(id);
      const status: ContentStatus = request.status ?? 'Draft';
      return updateLegalDocument(id, { status });
    }),
  );
  const results = settled.map((r, i) => ({
    id: request.ids[i],
    success: r.status === 'fulfilled',
    error: r.status === 'rejected' ? String((r as PromiseRejectedResult).reason) : null,
  }));
  const succeeded = results.filter((r) => r.success).length;
  return { succeeded, failed: results.length - succeeded, total: results.length, results };
}

/**
 * `getLegalDocuments` returns CookieConsent docs alongside other legal docs;
 * the CookieConsent UI lives in its own outer tab, so strip those rows here
 * before they reach the harness.
 */
async function fetchLegalDocumentsWithoutCookieConsent(
  siteId: string,
  params: Parameters<typeof getLegalDocuments>[1],
): Promise<Paginated<LegalDocumentResponse>> {
  const result = await getLegalDocuments(siteId, params);
  const filtered = result.data.filter((d) => d.document_type !== 'CookieConsent');
  return { ...result, data: filtered };
}

const legalAdapter: EntityListAdapter<LegalDocumentResponse> = {
  entityKey: 'legal',
  chrome: 'embedded',
  routePath: (doc) => `/legal/${doc.id}`,
  queryKeyRoot: 'legal',
  pageHeaderIcon: 'gavel',
  i18nNamespace: 'legal',
  fetchList: (siteId, params) =>
    fetchLegalDocumentsWithoutCookieConsent(siteId, {
      page: params.page,
      page_size: params.page_size,
      search: params.search,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
    }),
  listQueryKey: (siteId, params) => [
    'legal',
    siteId,
    params.page,
    params.page_size,
    params.search ?? '',
    params.status ?? '',
    params.exclude_status ?? '',
    params.sort_by ?? '',
    params.sort_dir ?? '',
  ],
  getItemId: (doc) => doc.id,
  updateEntity: (id, data) => updateLegalDocument(id, data),
  deleteEntity: (id) => deleteLegalDocument(id),
  bulkAction: legalBulkAction,
  defaultSort: { sortBy: 'created_at', sortDir: 'desc' },
  buildColumns: (deps) => buildLegalColumns(deps),
  buildChipFilters: ({ t }) => buildLegalChipFilters(t),
  pageTestId: 'legal.documents-tab',
  tableTestId: 'legal.table',
  searchTestId: 'legal.search',
  emptyIcon: <GavelIcon sx={{ fontSize: 64 }} />,
};

interface DocumentsTabProps {
  onAddDocument: () => void;
}

function DocumentsTab({ onAddDocument }: DocumentsTabProps) {
  const { t } = useTranslation();

  return (
    <EntityListPage
      adapter={legalAdapter}
      renderRowActions={({ item, canWrite, isAdmin, rowActions, onView, onDelete }) => (
        <ContentEntityActionMenu
          kind="legal"
          entity={item}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onView={onView}
          onPublish={rowActions.openPublish}
          onUnpublish={rowActions.openUnpublish}
          onArchive={rowActions.openArchive}
          onRestore={rowActions.openRestore}
          onDelete={onDelete}
        />
      )}
      renderEmptyState={({ canWrite }) => (
        <EmptyState
          icon={<GavelIcon sx={{ fontSize: 64 }} />}
          title={t('legal.empty.title')}
          description={t('legal.empty.description')}
          action={canWrite ? { label: t('legal.addDocument'), onClick: onAddDocument } : undefined}
        />
      )}
      renderDialogs={(props) => (
        <ContentEntityDialogs
          {...props}
          descriptor={{ i18nNamespace: 'legal', identifierField: 'cookie_name', restore: 'confirmDraft' }}
        />
      )}
    />
  );
}

export default function LegalPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [searchParams, setSearchParams] = useSearchParams();
  // Outer tabs: Documents (0) | CookieConsent (1).
  // The harness uses `?tab=archived` for its inner Active/Archived split, so
  // only `?tab=cookie-consent` activates outer tab 1.
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'cookie-consent' ? 1 : 0;
  const setActiveTab = useCallback((index: number) => {
    setSearchParams(index === 1 ? { tab: 'cookie-consent' } : {}, { replace: true });
  }, [setSearchParams]);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-legal-doc') setWizardOpen(true);
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  const handleOpenWizard = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setWizardOpen(false);
  }, []);

  return (
    <Box data-testid="legal.page">
      <PageHeader
        icon="gavel"
        breadcrumb={t('layout.sidebar.content') + ' / ' + t('legal.title')}
        title={t('legal.title')}
        subtitle={t('legal.subtitle')}
        actions={
          selectedSiteId && activeTab === 0 ? (
            <M3Button
              size="md"
              icon="add"
              onClick={handleOpenWizard}
              data-testid="create-legal-doc"
            >
              {t('legal.addDocument')}
            </M3Button>
          ) : undefined
        }
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<GavelIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('legal.empty.noSite')}
        />
      ) : (
        <>
          <Tabs
            value={activeTab}
            onChange={(_e, val: number) => setActiveTab(val)}
            aria-label={t('legal.title')}
            data-testid="legal.tabs"
            sx={pageTabsSx}
          >
            <Tab
              icon={<Icon name="description" size={20} />}
              iconPosition="start"
              label={t('legal.tabs.documents')}
              id="legal-tab-0"
              aria-controls="legal-tabpanel-0"
              data-testid="legal.tab.documents"
            />
            <Tab
              icon={<Icon name="cookie" size={20} />}
              iconPosition="start"
              label={t('legal.tabs.cookieConsent')}
              id="legal-tab-1"
              aria-controls="legal-tabpanel-1"
              data-testid="legal.tab.cookieConsent"
            />
          </Tabs>

          <Box
            role="tabpanel"
            hidden={activeTab !== 0}
            id="legal-tabpanel-0"
            aria-labelledby="legal-tab-0"
          >
            {activeTab === 0 && <DocumentsTab onAddDocument={handleOpenWizard} />}
          </Box>

          <Box
            role="tabpanel"
            hidden={activeTab !== 1}
            id="legal-tabpanel-1"
            aria-labelledby="legal-tab-1"
          >
            {activeTab === 1 && <CookieConsentPage embedded />}
          </Box>
        </>
      )}

      <CreateLegalDocumentWizard open={wizardOpen} onClose={handleCloseWizard} />
    </Box>
  );
}
