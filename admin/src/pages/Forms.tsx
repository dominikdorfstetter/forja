import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import DynamicFormIcon from '@mui/icons-material/DynamicForm';
import { getForms } from '@/services/forms';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { PageHeader } from '@/components/shared/listPageV2/PageHeader';
import { DataTableV2, type DataTableV2Column } from '@/components/shared/listPageV2/DataTableV2';
import EmptyState from '@/components/shared/EmptyState';
import { M3Button } from '@/components/design-system';
import CreateFormWizard from '@/components/forms/CreateFormWizard';
import type { FormListItem } from '@/types/api';

function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: active ? 'var(--success-container, #d6f5dd)' : 'var(--surface-container-high)',
        color: active ? 'var(--on-success-container, #0f5132)' : 'var(--on-surface-variant)',
      }}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/**
 * Forms list page (#587). Lean alternative to `EntityListPage`:
 * Forms have a binary active flag rather than a Draft/Published/Archived
 * workflow, so it would be churn to force them through the content-status
 * adapter. We reuse the lower-level shared widgets (`PageHeader`,
 * `DataTableV2`, `EmptyState`) and own the small surface that's specific
 * to forms.
 */
export default function FormsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite } = useAuth();
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const pageSize = 10;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['forms', selectedSiteId, page, pageSize],
    queryFn: () => getForms(selectedSiteId, { page, page_size: pageSize }),
    enabled: !!selectedSiteId,
  });

  const rows = data?.data ?? [];

  const columns = useMemo<DataTableV2Column<FormListItem>[]>(
    () => [
      { key: 'name', label: t('formsModule.list.columns.name'), width: 'minmax(180px, 2fr)' },
      { key: 'slug', label: t('formsModule.list.columns.slug'), width: 'minmax(140px, 1fr)', muted: true },
      {
        key: 'field_count',
        label: t('formsModule.list.columns.fields'),
        width: '90px',
        align: 'right',
        render: (r) => r.field_count,
      },
      {
        key: 'submission_count',
        label: t('formsModule.list.columns.submissions'),
        width: '120px',
        align: 'right',
        render: (r) => r.submission_count,
      },
      {
        key: 'is_active',
        label: t('formsModule.list.columns.status'),
        width: '110px',
        render: (r) => (
          <StatusPill
            active={r.is_active}
            activeLabel={t('formsModule.list.status.active')}
            inactiveLabel={t('formsModule.list.status.inactive')}
          />
        ),
      },
    ],
    [t],
  );

  const openCreate = () => setWizardOpen(true);

  return (
    <div data-testid="forms.page">
      <PageHeader
        icon="dynamic_form"
        breadcrumb={`${t('layout.sidebar.content')} / ${t('layout.sidebar.forms')}`}
        title={t('formsModule.list.title')}
        subtitle={t('formsModule.list.subtitle')}
        actions={
          canWrite && selectedSiteId ? (
            <>
              <M3Button
                variant="outlined"
                size="md"
                icon="view_quilt"
                onClick={() => navigate('/forms/templates')}
                data-testid="forms.btn.manage-templates"
              >
                {t('formsModule.list.manageTemplates', 'Manage templates')}
              </M3Button>
              <M3Button
                size="md"
                icon="add"
                onClick={openCreate}
                data-testid="forms.btn.create-form"
              >
                {t('formsModule.list.createButton')}
              </M3Button>
            </>
          ) : null
        }
      />

      {isError && (
        <div role="alert" style={{ color: 'var(--err)', padding: 16 }}>
          {t('formsModule.list.loadError')}
        </div>
      )}

      {!isLoading && rows.length === 0 && !isError ? (
        <EmptyState
          icon={<DynamicFormIcon sx={{ fontSize: 64 }} />}
          title={t('formsModule.list.empty.title')}
          description={t('formsModule.list.empty.description')}
          action={
            canWrite
              ? { label: t('formsModule.list.empty.cta'), onClick: openCreate }
              : undefined
          }
        />
      ) : (
        <DataTableV2<FormListItem>
          columns={columns}
          rows={rows}
          getKey={(r) => r.id}
          onRowClick={(r) => navigate(`/forms/${r.id}`)}
          loadingRows={isLoading ? pageSize : undefined}
          data-testid="forms.table"
        />
      )}

      {/* Pagination intentionally minimal until we cross page 1 — defer
          the full pagination control until there's a second slice that
          needs it. */}
      <CreateFormWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => navigate(`/forms/${id}`)}
      />

      {data && data.meta.total_pages > 1 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <M3Button
            variant="outlined"
            size="md"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t('listPage.pagination.prev', 'Previous')}
          </M3Button>
          <M3Button
            variant="outlined"
            size="md"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.meta.total_pages}
          >
            {t('listPage.pagination.next', 'Next')}
          </M3Button>
        </div>
      )}
    </div>
  );
}
