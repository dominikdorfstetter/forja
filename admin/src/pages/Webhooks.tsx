import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Chip, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WebhookIcon from '@mui/icons-material/Webhook';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { Webhook, CreateWebhookRequest, UpdateWebhookRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import WebhookFormDialog from '@/components/webhooks/WebhookFormDialog';
import WebhookDeliveryLog from '@/components/webhooks/WebhookDeliveryLog';

export default function WebhooksPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();

  const {
    page, perPage, formOpen, editing, deleting,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<Webhook>();

  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-webhook') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', selectedSiteId, page, perPage],
    queryFn: () => apiService.getWebhooks(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const webhooks = data?.data;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateWebhookRequest, UpdateWebhookRequest
  >({
    queryKey: 'webhooks',
    create: {
      mutationFn: (req) => apiService.createWebhook(selectedSiteId, req),
      successMessage: t('webhooks.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateWebhook(id, data),
      successMessage: t('webhooks.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => apiService.deleteWebhook(id),
      successMessage: t('webhooks.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiService.testWebhook(id),
    onMutate: (id) => { setTestingWebhookId(id); },
    onSuccess: (delivery) => {
      setTestingWebhookId(null);
      const status = delivery.status_code ?? delivery.error_message;
      showSuccess(t('webhooks.testSuccess', { status: String(status) }));
    },
    onError: (error) => { setTestingWebhookId(null); showError(error); },
  });

  const columns: DataTableColumn<Webhook>[] = [
    { header: t('webhooks.table.url'), render: (wh) => <span style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{wh.url}</span> },
    {
      header: t('webhooks.table.events'),
      render: (wh) => wh.events.length === 0
        ? <Chip label={t('webhooks.allEvents')} size="small" variant="outlined" />
        : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {wh.events.slice(0, 3).map((e) => <Chip key={e} label={e} size="small" variant="outlined" />)}
            {wh.events.length > 3 && <Chip label={`+${wh.events.length - 3}`} size="small" />}
          </Box>
        ),
    },
    { header: t('webhooks.table.status'), render: (wh) => <Chip label={wh.is_active ? t('common.status.active') : t('common.status.inactive')} size="small" color={wh.is_active ? 'success' : 'default'} /> },
    { header: t('webhooks.table.created'), render: (wh) => format(new Date(wh.created_at), 'PP') },
    {
      header: t('webhooks.table.actions'),
      align: 'right',
      render: (wh) => (
        <>
          <Tooltip title={t('webhooks.sendTest')}><span><IconButton size="small" onClick={() => testMutation.mutate(wh.id)} disabled={testingWebhookId === wh.id}><PlayArrowIcon fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title={t('webhooks.viewDeliveries')}><IconButton size="small" onClick={() => setDeliveryWebhookId(wh.id)}><HistoryIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('common.actions.edit')}><IconButton size="small" onClick={() => openEdit(wh)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('common.actions.delete')}><IconButton size="small" color="error" onClick={() => openDelete(wh)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('webhooks.title')}
        subtitle={t('webhooks.subtitle')}
        action={selectedSiteId ? { label: t('webhooks.addWebhook'), icon: <AddIcon />, onClick: openCreate } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<WebhookIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('webhooks.empty.noSite')} />
      ) : (
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <LoadingState label={t('webhooks.loading')} />
          ) : !webhooks || webhooks.length === 0 ? (
            <EmptyState icon={<WebhookIcon sx={{ fontSize: 48 }} />} title={t('webhooks.empty.title')} description={t('webhooks.empty.description')} action={{ label: t('webhooks.addWebhook'), onClick: openCreate }} />
          ) : (
            <DataTable
              data={webhooks}
              columns={columns}
              getRowKey={(wh) => wh.id}
              meta={data?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={perPage}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Paper>
      )}

      <WebhookFormDialog open={formOpen} onSubmitCreate={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <WebhookFormDialog open={!!editing} webhook={editing} onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('webhooks.deleteDialog.title')} message={t('webhooks.deleteDialog.message', { url: deleting?.url })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} />
      <WebhookDeliveryLog open={!!deliveryWebhookId} webhookId={deliveryWebhookId} onClose={() => setDeliveryWebhookId(null)} />
    </Box>
  );
}
