import { Box, Chip, IconButton, Paper, Tooltip } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import HistoryIcon from '@mui/icons-material/History';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationActivity } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
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
      header: 'Type',
      render: (a) => a.activityType,
    },
    {
      header: 'Actor',
      render: (a) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
          {a.actorUri}
        </Box>
      ),
    },
    {
      header: 'Direction',
      render: (a) => (
        <Chip
          label={a.direction === 'in' ? 'Inbound' : 'Outbound'}
          size="small"
          variant="outlined"
          color={a.direction === 'in' ? 'info' : 'secondary'}
        />
      ),
    },
    {
      header: 'Status',
      render: (a) => (
        <Chip label={a.status} size="small" color={statusColor(a.status)} />
      ),
    },
    {
      header: 'Date',
      render: (a) => format(new Date(a.createdAt), 'PPp'),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (a) =>
        a.status === 'failed' ? (
          <Tooltip title="Retry delivery">
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
        <PageHeader title="Activity Log" subtitle="Federation activity history" breadcrumbs={[{ label: 'Federation', path: '/federation' }, { label: 'Activity Log' }]} />
        <EmptyState icon={<HistoryIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to view activity." />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-activity.page">
      <PageHeader title="Activity Log" subtitle="Federation activity history" breadcrumbs={[{ label: 'Federation', path: '/federation' }, { label: 'Activity Log' }]} />

      <Paper>
        <TableFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search activities..."
        />
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label="Loading activities..." /></Box>
        ) : !activities || activities.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<HistoryIcon sx={{ fontSize: 48 }} />}
              title="No activity yet"
              description="Federation activities will appear here when they occur."
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
