import { Box, Chip, IconButton, Paper, Tooltip } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import HistoryIcon from '@mui/icons-material/History';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationActivity } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useTranslation } from 'react-i18next';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import TableFilterBar from '@/components/shared/TableFilterBar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

function statusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'delivered':
    case 'processed':
      return 'success';
    case 'failed':
      return 'error';
    case 'pending':
    case 'queued':
      return 'warning';
    default:
      return 'default';
  }
}

export default function FederationActivityLog() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const {
    page, pageSize,
    search, setSearch, debouncedSearch,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<FederationActivity>();

  const { retryActivity } = useFederationMutations(selectedSiteId);

  const { data, isLoading } = useQuery({
    queryKey: ['federation-activities', selectedSiteId, page, pageSize, debouncedSearch],
    queryFn: () => apiService.getFederationActivities(selectedSiteId, {
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
    }),
    enabled: !!selectedSiteId,
  });

  const activities = data?.data;

  const columns: DataTableColumn<FederationActivity>[] = [
    {
      header: t('federation.activityLog.columns.type'),
      render: (a) => a.activityType,
    },
    {
      header: t('federation.activityLog.columns.actor'),
      render: (a) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
          {a.actorUri}
        </Box>
      ),
    },
    {
      header: t('federation.activityLog.columns.direction'),
      render: (a) => (
        <Chip
          label={a.direction === 'in' ? t('federation.activityLog.inbound') : t('federation.activityLog.outbound')}
          size="small"
          variant="outlined"
          color={a.direction === 'in' ? 'info' : 'secondary'}
        />
      ),
    },
    {
      header: t('federation.activityLog.columns.status'),
      render: (a) => (
        <Chip label={a.status} size="small" color={statusColor(a.status)} />
      ),
    },
    {
      header: t('federation.activityLog.columns.date'),
      render: (a) => format(new Date(a.createdAt), 'PPp'),
    },
    {
      header: t('federation.activityLog.columns.actions'),
      align: 'right',
      render: (a) =>
        a.status === 'failed' ? (
          <Tooltip title={t('federation.activityLog.retryTooltip')}>
            <IconButton size="small" onClick={() => retryActivity.mutate(a.id)}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-activity.page">
        <PageHeader title={t('federation.activityLog.title')} subtitle={t('federation.activityLog.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.activityLog.title') }]} />
        <EmptyState icon={<HistoryIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.activityLog.noSite')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-activity.page">
      <PageHeader title={t('federation.activityLog.title')} subtitle={t('federation.activityLog.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.activityLog.title') }]} />

      <Paper>
        <TableFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('federation.activityLog.searchPlaceholder')}
        />
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label={t('federation.activityLog.loading')} /></Box>
        ) : !activities || activities.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<HistoryIcon sx={{ fontSize: 48 }} />}
              title={t('federation.activityLog.empty')}
              description={t('federation.activityLog.emptyDescription')}
            />
          </Box>
        ) : (
          <DataTable
            data={activities}
            columns={columns}
            getRowKey={(a) => a.id}
            meta={data?.meta}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        )}
      </Paper>
    </Box>
  );
}
