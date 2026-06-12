import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { Box, CircularProgress, Tooltip } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import { getForm, getSubmissionStatusCounts, getSubmissions } from '@/services/forms';
import { PageHeader } from '@/components/shared/listPageV2/PageHeader';
import { DataTableV2, type DataTableV2Column } from '@/components/shared/listPageV2/DataTableV2';
import EmptyState from '@/components/shared/EmptyState';
import { M3Button } from '@/components/design-system';
import SubmissionDetailDrawer from '@/components/forms/SubmissionDetailDrawer';
import SubmissionActionsMenu from '@/components/forms/SubmissionActionsMenu';
import StatusPill from '@/components/forms/StatusPill';
import { useSubmissionStatusMutation } from '@/hooks/useSubmissionStatusMutation';
import type {
  FormSubmissionStatus,
  SubmissionListItem,
  SubmissionStatusCounts,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

type Filter = FormSubmissionStatus | 'all';
const FILTERS: Filter[] = ['all', 'new', 'in_review', 'resolved', 'rejected', 'archived'];

function chipCount(counts: SubmissionStatusCounts | undefined, filter: Filter): number {
  if (!counts) return 0;
  if (filter === 'all') {
    return (
      counts.new +
      counts.in_review +
      counts.resolved +
      counts.rejected +
      counts.archived
    );
  }
  return counts[filter];
}

/**
 * Submission inbox (#589) at /forms/:id/submissions. Lists submissions
 * for a single form with a status-filter chip bar, click-row-to-open
 * detail drawer, status changes + notes inline, and CSV export. The
 * filter chips also act as counts (each chip shows N submissions in
 * that status).
 *
 * Bulk status change and field-level search are deferred — the backend
 * doesn't currently expose them and they don't unblock the AC for this
 * issue (the list + detail + status + notes + delete + export does).
 */
export default function FormSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const formId = id ?? '';
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const pageSize = 20;

  const { data: form } = useQuery({
    queryKey: queryKeys.form(formId),
    queryFn: () => getForm(formId),
    enabled: !!formId,
  });

  const { data: counts } = useQuery({
    queryKey: queryKeys.submissionStatusCounts(formId),
    queryFn: () => getSubmissionStatusCounts(formId),
    enabled: !!formId,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.submissions(formId, filter, page, pageSize),
    queryFn: () =>
      getSubmissions(formId, {
        page,
        page_size: pageSize,
        status: filter === 'all' ? undefined : filter,
      }),
    enabled: !!formId,
  });

  const statusMutation = useSubmissionStatusMutation(formId);
  const rows = data?.data ?? [];

  const columns = useMemo<DataTableV2Column<SubmissionListItem>[]>(
    () => [
      {
        key: 'reference_code',
        label: t('formsModule.submissions.columns.referenceCode', 'Reference'),
        width: 'minmax(180px, 1fr)',
        render: (r) => <span style={{ fontFamily: 'monospace' }}>{r.reference_code}</span>,
      },
      {
        key: 'status',
        label: t('formsModule.submissions.columns.status', 'Status'),
        width: '120px',
        render: (r) => <StatusPill status={r.status} />,
      },
      {
        key: 'preview',
        label: t('formsModule.submissions.columns.preview', 'Preview'),
        width: 'minmax(200px, 3fr)',
        muted: true,
        render: (r) => previewSubmission(r.data),
      },
      {
        key: 'created_at',
        label: t('formsModule.submissions.columns.createdAt', 'Submitted'),
        width: '180px',
        muted: true,
        render: (r) => new Date(r.created_at).toLocaleString(),
      },
      {
        key: 'actions',
        label: '',
        width: '56px',
        render: (r) => (
          <SubmissionActionsMenu
            submission={r}
            pending={statusMutation.isPending}
            onChangeStatus={(status) =>
              statusMutation.mutate({ submissionId: r.id, status })
            }
          />
        ),
      },
    ],
    [t, statusMutation],
  );

  return (
    <div data-testid="forms.submissions.page">
      <PageHeader
        icon="inbox"
        breadcrumb={`${t('layout.sidebar.content')} / ${t('layout.sidebar.forms')} / ${form?.name ?? '…'} / ${t('formsModule.submissions.title', 'Submissions')}`}
        title={t('formsModule.submissions.title', 'Submissions')}
        subtitle={form ? `/${form.slug}` : undefined}
        actions={
          <>
            <M3Button
              variant="outlined"
              size="md"
              icon="arrow_back"
              onClick={() => navigate(`/forms/${formId}`)}
              data-testid="forms.submissions.btn.back"
            >
              {t('formsModule.submissions.backToForm', 'Back to form')}
            </M3Button>
            <Tooltip title={t('formsModule.submissions.exportCsv.help', 'Download visible page as CSV')}>
              <span>
                <M3Button
                  variant="outlined"
                  size="md"
                  icon="download"
                  onClick={() => exportCsv(rows, form?.slug ?? 'submissions')}
                  disabled={rows.length === 0}
                  data-testid="forms.submissions.btn.export"
                >
                  {t('formsModule.submissions.exportCsv.btn', 'Export CSV')}
                </M3Button>
              </span>
            </Tooltip>
          </>
        }
      />

      {/* Filter chips with counts */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              data-testid={`forms.submissions.chip.${f}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px solid var(--outline-variant)',
                background: active ? 'var(--primary-container)' : 'var(--surface-container-low)',
                color: active ? 'var(--on-primary-container)' : 'var(--on-surface)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-pressed={active}
            >
              <span>{t(`formsModule.submissions.filter.${f}`, f)}</span>
              <span style={{
                background: active ? 'rgba(0,0,0,0.12)' : 'var(--surface-container-high)',
                borderRadius: 10,
                padding: '0 8px',
                fontVariantNumeric: 'tabular-nums',
              }}>{chipCount(counts, f)}</span>
            </button>
          );
        })}
      </Box>

      {isError && (
        <div role="alert" style={{ color: 'var(--err)', padding: 16 }}>
          {t('formsModule.submissions.loadError', 'Failed to load submissions.')}
        </div>
      )}

      {!isLoading && rows.length === 0 && !isError ? (
        <EmptyState
          icon={<InboxIcon sx={{ fontSize: 64 }} />}
          title={t('formsModule.submissions.empty.title', 'No submissions')}
          description={
            filter === 'all'
              ? t('formsModule.submissions.empty.descriptionAll', 'No one has submitted this form yet.')
              : t('formsModule.submissions.empty.descriptionFiltered', 'No submissions match the current filter.')
          }
        />
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <DataTableV2<SubmissionListItem>
          columns={columns}
          rows={rows}
          getKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          data-testid="forms.submissions.table"
        />
      )}

      {data && data.meta.total_pages > 1 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
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
        </Box>
      )}

      <SubmissionDetailDrawer
        submissionId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function previewSubmission(data: Record<string, unknown>): string {
  const entries = Object.entries(data).slice(0, 3);
  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' · ');
}

/** Browser-only CSV export of the current page. Headers come from the
 *  union of all field labels across the visible rows. */
function exportCsv(rows: SubmissionListItem[], slug: string) {
  if (rows.length === 0) return;
  const fieldNames = new Set<string>();
  rows.forEach((r) => Object.keys(r.data).forEach((k) => fieldNames.add(k)));
  const header = ['reference_code', 'status', 'created_at', ...fieldNames];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.map(escape).join(','),
    ...rows.map((r) =>
      [
        r.reference_code,
        r.status,
        r.created_at,
        ...Array.from(fieldNames).map((f) => r.data[f]),
      ]
        .map(escape)
        .join(','),
    ),
  ];
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
