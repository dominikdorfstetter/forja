import { useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationBlockedInstance, FederationBlockedActor } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useTranslation } from 'react-i18next';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

function parseDomains(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0 && d.length <= 253);
}

interface ImportBlocklistDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (domains: string[]) => void;
  isPending: boolean;
}

function ImportBlocklistDialog({ open, onClose, onImport, isPending }: ImportBlocklistDialogProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setText((prev) => (prev ? prev + '\n' + content : content));
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = () => {
    const domains = parseDomains(text);
    if (domains.length > 0) {
      onImport(domains);
    }
  };

  const handleClose = () => {
    setText('');
    onClose();
  };

  const domainCount = parseDomains(text).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('federation.blocklist.importTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('federation.blocklist.importDescription')}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={6}
          maxRows={12}
          placeholder={t('federation.blocklist.importPaste')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('federation.blocklist.importFile')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.text"
            hidden
            onChange={handleFileUpload}
          />
          {domainCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {domainCount} domain{domainCount !== 1 ? 's' : ''} detected
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={domainCount === 0 || isPending}
        >
          {t('federation.blocklist.importButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FederationBlocklist() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  const instanceState = useListPageState<FederationBlockedInstance>();
  const actorState = useListPageState<FederationBlockedActor>();

  const { unblockInstanceMutation, unblockActorMutation, importBlocklistMutation } = useFederationMutations(selectedSiteId);

  const { data: instanceData, isLoading: instancesLoading } = useQuery({
    queryKey: ['federation-blocked-instances', selectedSiteId, instanceState.page, instanceState.pageSize],
    queryFn: () => apiService.getBlockedInstances(selectedSiteId, {
      page: instanceState.page,
      page_size: instanceState.pageSize,
    }),
    enabled: !!selectedSiteId && tab === 0,
  });

  const { data: actorData, isLoading: actorsLoading } = useQuery({
    queryKey: ['federation-blocked-actors', selectedSiteId, actorState.page, actorState.pageSize],
    queryFn: () => apiService.getBlockedActors(selectedSiteId, {
      page: actorState.page,
      page_size: actorState.pageSize,
    }),
    enabled: !!selectedSiteId && tab === 1,
  });

  const handleImport = (domains: string[]) => {
    importBlocklistMutation.mutate(domains, {
      onSuccess: (result) => {
        enqueueSnackbar(
          t('federation.blocklist.importSuccess', { imported: result.imported, skipped: result.skipped }),
          { variant: 'success' },
        );
        setImportOpen(false);
      },
    });
  };

  const instanceColumns: DataTableColumn<FederationBlockedInstance>[] = [
    {
      header: t('federation.blocklist.columns.domain'),
      render: (b) => b.domain,
    },
    {
      header: t('federation.blocklist.columns.reason'),
      render: (b) => b.reason ?? '-',
    },
    {
      header: t('federation.blocklist.columns.blocked'),
      render: (b) => format(new Date(b.blocked_at), 'PP'),
    },
    {
      header: t('federation.blocklist.columns.actions'),
      align: 'right',
      render: (b) => (
        <Tooltip title={t('federation.blocklist.unblockInstanceTooltip')}>
          <IconButton size="small" color="error" onClick={() => instanceState.openDelete(b)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const actorColumns: DataTableColumn<FederationBlockedActor>[] = [
    {
      header: t('federation.blocklist.columns.actorUri'),
      render: (b) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {b.actor_uri}
        </Box>
      ),
    },
    {
      header: t('federation.blocklist.columns.reason'),
      render: (b) => b.reason ?? '-',
    },
    {
      header: t('federation.blocklist.columns.blocked'),
      render: (b) => format(new Date(b.blocked_at), 'PP'),
    },
    {
      header: t('federation.blocklist.columns.actions'),
      align: 'right',
      render: (b) => (
        <Tooltip title={t('federation.blocklist.unblockActorTooltip')}>
          <IconButton size="small" color="error" onClick={() => actorState.openDelete(b)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-blocklist.page">
        <PageHeader title={t('federation.blocklist.title')} subtitle={t('federation.blocklist.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.blocklist.title') }]} />
        <EmptyState icon={<BlockIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.blocklist.noSite')} />
      </Box>
    );
  }

  const isLoading = tab === 0 ? instancesLoading : actorsLoading;

  return (
    <Box data-testid="federation-blocklist.page">
      <PageHeader title={t('federation.blocklist.title')} subtitle={t('federation.blocklist.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.blocklist.title') }]} />

      <Paper>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={t('federation.blocklist.instances')} />
            <Tab label={t('federation.blocklist.actors')} />
          </Tabs>
          {tab === 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setImportOpen(true)}
              sx={{ mr: 2 }}
            >
              {t('federation.blocklist.import')}
            </Button>
          )}
        </Stack>

        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label={t('federation.blocklist.loading')} /></Box>
        ) : tab === 0 ? (
          !instanceData?.data?.length ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<BlockIcon sx={{ fontSize: 48 }} />}
                title={t('federation.blocklist.noBlockedInstances')}
                description={t('federation.blocklist.noBlockedInstancesDesc')}
              />
            </Box>
          ) : (
            <DataTable
              data={instanceData.data}
              columns={instanceColumns}
              getRowKey={(b) => b.id}
              meta={instanceData?.meta}
              page={instanceState.page}
              onPageChange={instanceState.handlePageChange}
              rowsPerPage={instanceState.pageSize}
              onRowsPerPageChange={instanceState.handleRowsPerPageChange}
            />
          )
        ) : (
          !actorData?.data?.length ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<BlockIcon sx={{ fontSize: 48 }} />}
                title={t('federation.blocklist.noBlockedActors')}
                description={t('federation.blocklist.noBlockedActorsDesc')}
              />
            </Box>
          ) : (
            <DataTable
              data={actorData.data}
              columns={actorColumns}
              getRowKey={(b) => b.id}
              meta={actorData?.meta}
              page={actorState.page}
              onPageChange={actorState.handlePageChange}
              rowsPerPage={actorState.pageSize}
              onRowsPerPageChange={actorState.handleRowsPerPageChange}
            />
          )
        )}
      </Paper>

      <ImportBlocklistDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        isPending={importBlocklistMutation.isPending}
      />

      <ConfirmDialog
        open={!!instanceState.deleting}
        title={t('federation.blocklist.unblockInstanceTitle')}
        message={t('federation.blocklist.unblockInstanceMessage', { domain: instanceState.deleting?.domain })}
        confirmLabel={t('federation.blocklist.unblockConfirm')}
        onConfirm={() => instanceState.deleting && unblockInstanceMutation.mutate(instanceState.deleting.id)}
        onCancel={instanceState.closeDelete}
        loading={unblockInstanceMutation.isPending}
      />

      <ConfirmDialog
        open={!!actorState.deleting}
        title={t('federation.blocklist.unblockActorTitle')}
        message={t('federation.blocklist.unblockActorMessage', { actor: actorState.deleting?.actor_uri })}
        confirmLabel={t('federation.blocklist.unblockConfirm')}
        onConfirm={() => actorState.deleting && unblockActorMutation.mutate(actorState.deleting.id)}
        onCancel={actorState.closeDelete}
        loading={unblockActorMutation.isPending}
      />
    </Box>
  );
}
