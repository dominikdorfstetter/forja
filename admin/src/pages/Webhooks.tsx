import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip } from '@mui/material';
import WebhookIcon from '@mui/icons-material/Webhook';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createWebhook, deleteWebhook, getWebhooks, testWebhook, updateWebhook } from '@/services/webhooks';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import type { Webhook, CreateWebhookRequest, UpdateWebhookRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import WebhookFormDialog from '@/components/webhooks/WebhookFormDialog';
import WebhookDeliveryLog from '@/components/webhooks/WebhookDeliveryLog';
import WebhookAnalytics from '@/components/webhooks/WebhookAnalytics';
import { detectTemplate } from '@/data/webhookTemplates';
import {
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';
import { SectionHead, M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';

interface WebhookRowActionsProps {
  webhook: Webhook;
  isAdmin: boolean;
  testingWebhookId: string | null;
  onEdit: (wh: Webhook) => void;
  onDelete: (wh: Webhook) => void;
  onTest: (id: string) => void;
  onViewDeliveries: (id: string) => void;
  onViewAnalytics: (id: string) => void;
}

function WebhookRowActions({
  webhook,
  isAdmin,
  testingWebhookId,
  onEdit,
  onDelete,
  onTest,
  onViewDeliveries,
  onViewAnalytics,
}: WebhookRowActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const testing = testingWebhookId === webhook.id;

  const items: ActionMenuItem[] = [
    {
      icon: 'history',
      label: t('webhooks.viewDeliveries'),
      onClick: () => onViewDeliveries(webhook.id),
    },
    ...(isAdmin
      ? [
          {
            icon: 'bar_chart',
            label: t('webhooks.analytics.viewAnalytics'),
            onClick: () => onViewAnalytics(webhook.id),
          },
          {
            icon: 'play_arrow',
            label: t('webhooks.sendTest'),
            disabled: testing,
            onClick: () => onTest(webhook.id),
          },
          {
            icon: 'edit',
            label: t('common.actions.edit'),
            onClick: () => onEdit(webhook),
          },
          {
            icon: 'delete',
            label: t('common.actions.delete'),
            danger: true,
            onClick: () => onDelete(webhook),
          },
        ]
      : []),
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="webhook-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function WebhooksPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { selectedSiteId } = useSiteContext();
  const { isAdmin } = useAuth();
  const { showError, showSuccess } = useErrorSnackbar();

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    formOpen,
    editing,
    deleting,
    search,
    setSearch,
    debouncedSearch,
    sortBy,
    sortDir,
    handleSort,
    openCreate,
    closeForm,
    openEdit,
    closeEdit,
    openDelete,
    closeDelete,
  } = useListPageState<Webhook>();

  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [analyticsWebhookId, setAnalyticsWebhookId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-webhook') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.webhooks(selectedSiteId, page, pageSize, debouncedSearch, sortBy, sortDir),
    queryFn: () =>
      getWebhooks(selectedSiteId, {
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
      }),
    enabled: !!selectedSiteId,
  });
  const webhooks = data?.data;
  const total = data?.meta.total_items ?? 0;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateWebhookRequest,
    UpdateWebhookRequest
  >({
    queryKey: 'webhooks',
    create: {
      mutationFn: (req) => createWebhook(selectedSiteId, req),
      successMessage: t('webhooks.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => updateWebhook(id, data),
      successMessage: t('webhooks.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => deleteWebhook(id),
      successMessage: t('webhooks.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => testWebhook(id),
    onMutate: (id) => {
      setTestingWebhookId(id);
    },
    onSuccess: (delivery) => {
      setTestingWebhookId(null);
      const status = delivery.status_code ?? delivery.error_message;
      showSuccess(t('webhooks.testSuccess', { status: String(status) }));
    },
    onError: (error) => {
      setTestingWebhookId(null);
      showError(error);
    },
  });

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    sortBy === key ? sortDir : undefined;

  const columns: DataTableV2Column<Webhook>[] = [
    {
      key: 'url',
      label: t('webhooks.table.url'),
      width: '1.2fr',
      sorted: sortedDir('url'),
      render: (wh) => {
        const template = detectTemplate(wh.url);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {template && (
              <Chip
                label={template.provider.charAt(0).toUpperCase() + template.provider.slice(1)}
                size="small"
                color="info"
                variant="outlined"
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {wh.url}
            </span>
          </span>
        );
      },
    },
    {
      key: 'events',
      label: t('webhooks.table.events'),
      width: '260px',
      render: (wh) =>
        wh.events.length === 0 ? (
          <Chip label={t('webhooks.allEvents')} size="small" variant="outlined" />
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {wh.events.slice(0, 2).map((e) => (
              <Chip key={e} label={e} size="small" variant="outlined" />
            ))}
            {wh.events.length > 2 && (
              <Chip label={`+${wh.events.length - 2}`} size="small" />
            )}
          </Box>
        ),
    },
    {
      key: 'is_active',
      label: t('webhooks.table.status'),
      width: '140px',
      sorted: sortedDir('is_active'),
      render: (wh) => (
        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
          <Chip
            label={wh.is_active ? t('common.status.active') : t('common.status.inactive')}
            size="small"
            color={wh.is_active ? 'success' : 'default'}
          />
          {wh.debounce_seconds > 0 && (
            <Chip label={`${wh.debounce_seconds}s`} size="small" variant="outlined" />
          )}
        </Box>
      ),
    },
    {
      key: 'created_at',
      label: t('webhooks.table.created'),
      width: '120px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (wh) => fmt(wh.created_at, 'PP'),
    },
  ];

  const actions = selectedSiteId && isAdmin ? (
    <M3Button
      size="md"
      icon="add"
      onClick={openCreate}
      data-testid="create-webhook"
    >
      {t('webhooks.addWebhook')}
    </M3Button>
  ) : null;

  return (
    <Box data-testid="webhooks.page">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <SectionHead
          icon="webhook"
          title={t('webhooks.title')}
          subtitle={t('webhooks.subtitle')}
        />
        {actions && <Box sx={{ mt: 0.5 }}>{actions}</Box>}
      </Box>

      {!selectedSiteId ? (
        <EmptyState
          icon={<WebhookIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('webhooks.empty.noSite')}
        />
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t('webhooks.searchPlaceholder')}
              data-testid="webhooks-search"
            />
            <ToolbarSpacer />
          </Toolbar>

          {isLoading ? (
            <LoadingState label={t('webhooks.loading')} />
          ) : !webhooks || webhooks.length === 0 ? (
            <EmptyState
              icon={<WebhookIcon sx={{ fontSize: 48 }} />}
              title={t('webhooks.empty.title')}
              description={t('webhooks.empty.description')}
              action={
                isAdmin
                  ? { label: t('webhooks.addWebhook'), onClick: openCreate }
                  : undefined
              }
            />
          ) : (
            <>
              <DataTableV2<Webhook>
                data-testid="webhooks.table"
                columns={columns}
                rows={webhooks}
                getKey={(wh) => wh.id}
                onSort={handleSort}
                renderActions={(wh) => (
                  <WebhookRowActions
                    webhook={wh}
                    isAdmin={isAdmin}
                    testingWebhookId={testingWebhookId}
                    onEdit={openEdit}
                    onDelete={openDelete}
                    onTest={(id) => testMutation.mutate(id)}
                    onViewDeliveries={setDeliveryWebhookId}
                    onViewAnalytics={setAnalyticsWebhookId}
                  />
                )}
              />
              <Pagination
                total={total}
                page={page}
                perPage={pageSize}
                onPage={setPage}
                onPerPage={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </>
      )}

      <WebhookFormDialog
        open={formOpen}
        onSubmitCreate={(data) => createMutation.mutate(data)}
        onClose={closeForm}
        loading={createMutation.isPending}
      />
      <WebhookFormDialog
        open={!!editing}
        webhook={editing}
        onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })}
        onClose={closeEdit}
        loading={updateMutation.isPending}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('webhooks.deleteDialog.title')}
        message={t('webhooks.deleteDialog.message', { url: deleting?.url })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={deleteMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />
      <WebhookDeliveryLog
        open={!!deliveryWebhookId}
        webhookId={deliveryWebhookId}
        onClose={() => setDeliveryWebhookId(null)}
      />
      <WebhookAnalytics
        open={!!analyticsWebhookId}
        webhookId={analyticsWebhookId}
        onClose={() => setAnalyticsWebhookId(null)}
      />
    </Box>
  );
}
