import { Box, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import CommentIcon from '@mui/icons-material/Comment';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationComment } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import TableFilterBar from '@/components/shared/TableFilterBar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

function statusColor(status: string): 'warning' | 'success' | 'error' | 'default' {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'success';
    case 'rejected': return 'error';
    case 'spam': return 'error';
    default: return 'default';
  }
}

/** Strip HTML tags for safe plain-text preview. */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}

export default function FederationComments() {
  const { selectedSiteId } = useSiteContext();
  const {
    page, pageSize, deleting,
    search, setSearch, debouncedSearch,
    openDelete, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<FederationComment>();

  const { approveComment, rejectComment, deleteComment } = useFederationMutations(selectedSiteId);

  const { data, isLoading } = useQuery({
    queryKey: ['federation-comments', selectedSiteId, page, pageSize, debouncedSearch],
    queryFn: () => apiService.getFederationComments(selectedSiteId, {
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
    }),
    enabled: !!selectedSiteId,
  });

  const comments = data?.data;

  const columns: DataTableColumn<FederationComment>[] = [
    {
      header: 'Author',
      render: (c) => c.authorName ?? c.authorActorUri,
    },
    {
      header: 'Comment',
      render: (c) => (
        <Typography
          variant="body2"
          sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {stripHtml(c.bodyHtml)}
        </Typography>
      ),
    },
    {
      header: 'Status',
      render: (c) => (
        <Chip label={c.status} size="small" color={statusColor(c.status)} />
      ),
    },
    {
      header: 'Date',
      render: (c) => format(new Date(c.createdAt), 'PP'),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <>
          {c.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <IconButton size="small" color="success" onClick={() => approveComment.mutate(c.id)}>
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject">
                <IconButton size="small" color="warning" onClick={() => rejectComment.mutate(c.id)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => openDelete(c)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-comments.page">
        <PageHeader title="Comments" subtitle="Moderate federated comments" breadcrumbs={[{ label: 'Federation', path: '/federation' }, { label: 'Comments' }]} />
        <EmptyState icon={<CommentIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to moderate comments." />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-comments.page">
      <PageHeader title="Comments" subtitle="Moderate federated comments" breadcrumbs={[{ label: 'Federation', path: '/federation' }, { label: 'Comments' }]} />

      <Paper>
        <TableFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search comments..."
        />
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label="Loading comments..." /></Box>
        ) : !comments || comments.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<CommentIcon sx={{ fontSize: 48 }} />}
              title="No comments"
              description="Federated comments will appear here when received."
            />
          </Box>
        ) : (
          <DataTable
            data={comments}
            columns={columns}
            getRowKey={(c) => c.id}
            meta={data?.meta}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        )}
      </Paper>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Comment"
        message={`Delete comment by ${deleting?.authorName ?? deleting?.authorActorUri}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleting && deleteComment.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={deleteComment.isPending}
      />
    </Box>
  );
}
