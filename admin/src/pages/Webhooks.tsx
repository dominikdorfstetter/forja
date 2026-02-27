import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WebhookIcon from '@mui/icons-material/Webhook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { Webhook, CreateWebhookRequest, UpdateWebhookRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import WebhookFormDialog from '@/components/webhooks/WebhookFormDialog';
import WebhookDeliveryLog from '@/components/webhooks/WebhookDeliveryLog';

export default function WebhooksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [deletingWebhook, setDeletingWebhook] = useState<Webhook | null>(null);
  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', selectedSiteId, page, perPage],
    queryFn: () => apiService.getWebhooks(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const webhooks = data?.data;

  const createMutation = useMutation({
    mutationFn: (req: CreateWebhookRequest) => apiService.createWebhook(selectedSiteId, req),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setFormOpen(false); enqueueSnackbar(t('webhooks.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookRequest }) => apiService.updateWebhook(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setEditingWebhook(null); enqueueSnackbar(t('webhooks.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteWebhook(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setDeletingWebhook(null); enqueueSnackbar(t('webhooks.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiService.testWebhook(id),
    onMutate: (id) => { setTestingWebhookId(id); },
    onSuccess: (delivery) => {
      setTestingWebhookId(null);
      const status = delivery.status_code ?? delivery.error_message;
      enqueueSnackbar(t('webhooks.testSuccess', { status: String(status) }), { variant: 'success' });
    },
    onError: (error) => { setTestingWebhookId(null); const { detail, title } = resolveError(error); enqueueSnackbar(detail || t('webhooks.testFailed') || title, { variant: 'error' }); },
  });

  return (
    <Box>
      <PageHeader
        title={t('webhooks.title')}
        subtitle={t('webhooks.subtitle')}
        action={selectedSiteId ? {
          label: t('webhooks.addWebhook'),
          icon: <AddIcon />,
          onClick: () => setFormOpen(true),
        } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<WebhookIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('webhooks.empty.noSite')}
        />
      ) : (
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <LoadingState label={t('webhooks.loading')} />
          ) : !webhooks || webhooks.length === 0 ? (
            <EmptyState
              icon={<WebhookIcon sx={{ fontSize: 48 }} />}
              title={t('webhooks.empty.title')}
              description={t('webhooks.empty.description')}
              action={{ label: t('webhooks.addWebhook'), onClick: () => setFormOpen(true) }}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('webhooks.table.url')}</TableCell>
                    <TableCell>{t('webhooks.table.events')}</TableCell>
                    <TableCell>{t('webhooks.table.status')}</TableCell>
                    <TableCell>{t('webhooks.table.created')}</TableCell>
                    <TableCell align="right">{t('webhooks.table.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wh.url}
                      </TableCell>
                      <TableCell>
                        {wh.events.length === 0 ? (
                          <Chip label={t('webhooks.allEvents')} size="small" variant="outlined" />
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {wh.events.slice(0, 3).map((e) => (
                              <Chip key={e} label={e} size="small" variant="outlined" />
                            ))}
                            {wh.events.length > 3 && (
                              <Chip label={`+${wh.events.length - 3}`} size="small" />
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={wh.is_active ? t('common.status.active') : t('common.status.inactive')}
                          size="small"
                          color={wh.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(wh.created_at), 'PP')}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('webhooks.sendTest')}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => testMutation.mutate(wh.id)}
                              disabled={testingWebhookId === wh.id}
                            >
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('webhooks.viewDeliveries')}>
                          <IconButton size="small" onClick={() => setDeliveryWebhookId(wh.id)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.actions.edit')}>
                          <IconButton size="small" onClick={() => setEditingWebhook(wh)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.actions.delete')}>
                          <IconButton size="small" color="error" onClick={() => setDeletingWebhook(wh)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {data?.meta && (
            <TablePagination
              component="div"
              count={data.meta.total_items}
              page={data.meta.page - 1}
              onPageChange={(_, p) => setPage(p + 1)}
              rowsPerPage={data.meta.page_size}
              onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          )}
        </Paper>
      )}

      {/* Create dialog */}
      <WebhookFormDialog
        open={formOpen}
        onSubmitCreate={(data) => createMutation.mutate(data)}
        onClose={() => setFormOpen(false)}
        loading={createMutation.isPending}
      />

      {/* Edit dialog */}
      <WebhookFormDialog
        open={!!editingWebhook}
        webhook={editingWebhook}
        onSubmitUpdate={(data) => editingWebhook && updateMutation.mutate({ id: editingWebhook.id, data })}
        onClose={() => setEditingWebhook(null)}
        loading={updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingWebhook}
        title={t('webhooks.deleteDialog.title')}
        message={t('webhooks.deleteDialog.message', { url: deletingWebhook?.url })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingWebhook && deleteMutation.mutate(deletingWebhook.id)}
        onCancel={() => setDeletingWebhook(null)}
        loading={deleteMutation.isPending}
      />

      {/* Delivery log */}
      <WebhookDeliveryLog
        open={!!deliveryWebhookId}
        webhookId={deliveryWebhookId}
        onClose={() => setDeliveryWebhookId(null)}
      />
    </Box>
  );
}
