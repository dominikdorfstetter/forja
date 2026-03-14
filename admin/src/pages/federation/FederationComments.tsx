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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      header: t('federation.comments.columns.author'),
      render: (c) => c.author_name ?? c.author_actor_uri,
    },
    {
      header: t('federation.comments.columns.comment'),
      render: (c) => (
        <Typography
          variant="body2"
          sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {stripHtml(c.body_html)}
        </Typography>
      ),
    },
    {
      header: t('federation.comments.columns.status'),
      render: (c) => (
        <Chip label={c.status} size="small" color={statusColor(c.status)} />
      ),
    },
    {
      header: t('federation.comments.columns.date'),
      render: (c) => format(new Date(c.created_at), 'PP'),
    },
    {
      header: t('federation.comments.columns.actions'),
      align: 'right',
      render: (c) => (
        <>
          {c.status === 'pending' && (
            <>
              <Tooltip title={t('federation.comments.approveTooltip')}>
                <IconButton size="small" color="success" onClick={() => approveComment.mutate(c.id)}>
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('federation.comments.rejectTooltip')}>
                <IconButton size="small" color="warning" onClick={() => rejectComment.mutate(c.id)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={t('federation.comments.deleteTooltip')}>
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
        <PageHeader title={t('federation.comments.title')} subtitle={t('federation.comments.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.comments.title') }]} />
        <EmptyState icon={<CommentIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.comments.noSite')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-comments.page">
      <PageHeader title={t('federation.comments.title')} subtitle={t('federation.comments.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.comments.title') }]} />

      <Paper>
        <TableFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('federation.comments.searchPlaceholder')}
        />
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label={t('federation.comments.loading')} /></Box>
        ) : !comments || comments.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<CommentIcon sx={{ fontSize: 48 }} />}
              title={t('federation.comments.empty')}
              description={t('federation.comments.emptyDescription')}
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
        title={t('federation.comments.deleteTitle')}
        message={t('federation.comments.deleteMessage', { name: deleting?.author_name ?? deleting?.author_actor_uri })}
        confirmLabel={t('federation.comments.deleteConfirm')}
        onConfirm={() => deleting && deleteComment.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={deleteComment.isPending}
      />
    </Box>
  );
}
