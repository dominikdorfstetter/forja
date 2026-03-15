import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import HubIcon from '@mui/icons-material/Hub';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationSettings } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import { useListPageState } from '@/hooks/useListPageState';
import apiService from '@/services/api';
import type { FederationBlockedInstance } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

/**
 * Parse domains from text, supporting:
 * - One domain per line
 * - Mastodon CSV format (#domain,#severity,...) — extracts first column only
 * - Plain comma-separated domain lists
 */
function parseDomains(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const domains: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip CSV header rows (Mastodon uses #domain as first column header)
    if (trimmed.startsWith('#')) continue;

    // If line contains commas, treat as CSV — extract first column only
    if (trimmed.includes(',')) {
      const firstCol = trimmed.split(',')[0].trim().toLowerCase();
      if (firstCol.length > 0 && firstCol.length <= 253) {
        domains.push(firstCol);
      }
    } else {
      const domain = trimmed.toLowerCase();
      if (domain.length > 0 && domain.length <= 253) {
        domains.push(domain);
      }
    }
  }

  return domains;
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
    // Security: limit file size to 1 MB
    if (file.size > 1_048_576) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setText((prev) => (prev ? prev + '\n' + content : content));
      }
    };
    reader.readAsText(file);
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

interface EditReasonDialogProps {
  open: boolean;
  instance: FederationBlockedInstance | null;
  onClose: () => void;
  onSave: (domain: string, reason: string) => void;
  isPending: boolean;
}

function EditReasonDialog({ open, instance, onClose, onSave, isPending }: EditReasonDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleOpen = () => {
    setReason(instance?.reason ?? '');
  };

  const handleSave = () => {
    if (instance) {
      onSave(instance.domain, reason);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle>{t('federation.blocklist.editReasonTitle', { domain: instance?.domain })}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          label={t('federation.blocklist.columns.reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          {t('common.actions.cancel')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={isPending}>
          {t('common.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface FederationSettingsProps {
  embedded?: boolean;
}

export default function FederationSettingsPage({ embedded }: FederationSettingsProps = {}) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { enqueueSnackbar } = useSnackbar();
  const { data: settings, isLoading } = useFederationSettings(selectedSiteId);
  const {
    updateSettings,
    rotateKeysMutation,
    unblockInstanceMutation,
    updateBlockedInstanceMutation,
    clearBlocklistMutation,
    importBlocklistMutation,
  } = useFederationMutations(selectedSiteId);

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<FederationBlockedInstance | null>(null);

  const instanceState = useListPageState<FederationBlockedInstance>();

  const { data: instanceData, isLoading: instancesLoading } = useQuery({
    queryKey: ['federation-blocked-instances', selectedSiteId, instanceState.page, instanceState.pageSize],
    queryFn: () => apiService.getBlockedInstances(selectedSiteId, {
      page: instanceState.page,
      page_size: instanceState.pageSize,
    }),
    enabled: !!selectedSiteId,
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

  const handleEditSave = (domain: string, reason: string) => {
    updateBlockedInstanceMutation.mutate(
      { domain, reason: reason || undefined },
      { onSuccess: () => setEditing(null) },
    );
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
        <Stack direction="row" spacing={0} justifyContent="flex-end">
          <Tooltip title={t('federation.blocklist.editReasonTooltip')}>
            <IconButton size="small" onClick={() => setEditing(b)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('federation.blocklist.unblockInstanceTooltip')}>
            <IconButton size="small" color="error" onClick={() => instanceState.openDelete(b)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-settings.page">
        <EmptyState icon={<SettingsIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.settings.noSite')} />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-settings.page">
        <LoadingState label={t('federation.settings.loading')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-settings.page" sx={{ maxWidth: 800, mx: embedded ? undefined : 'auto', p: embedded ? 0 : 3 }}>
      {!embedded && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <HubIcon />
          <Typography variant="h5">{t('federation.settings.title')}</Typography>
        </Stack>
      )}

      <Paper sx={{ p: 3 }} elevation={embedded ? 0 : 1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card variant="outlined">
            <CardHeader
              title={t('federation.blocklist.instances')}
              avatar={<BlockIcon />}
              action={
                <Stack direction="row" spacing={1}>
                  {instanceData?.data?.length ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteSweepIcon />}
                      onClick={() => setClearConfirmOpen(true)}
                    >
                      {t('federation.blocklist.clearAll')}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setImportOpen(true)}
                  >
                    {t('federation.blocklist.import')}
                  </Button>
                </Stack>
              }
            />
            <CardContent>
              {instancesLoading ? (
                <LoadingState label={t('federation.blocklist.loading')} />
              ) : !instanceData?.data?.length ? (
                <EmptyState
                  icon={<BlockIcon sx={{ fontSize: 48 }} />}
                  title={t('federation.blocklist.noBlockedInstances')}
                  description={t('federation.blocklist.noBlockedInstancesDesc')}
                />
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
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title={t('federation.settings.signatureAlgorithm')} />
            <CardContent>
              <FormControl fullWidth size="small">
                <InputLabel>{t('federation.settings.algorithm')}</InputLabel>
                <Select
                  value={settings?.signature_algorithm ?? 'rsa-sha256'}
                  label={t('federation.settings.algorithm')}
                  onChange={(e) => updateSettings.mutate({ signature_algorithm: e.target.value })}
                >
                  <MenuItem value="rsa-sha256">RSA-SHA256</MenuItem>
                  <MenuItem value="ed25519">Ed25519</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title={t('federation.settings.keyManagement')} />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('federation.settings.keyRotateWarning')}
              </Typography>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<VpnKeyIcon />}
                onClick={() => setRotateConfirmOpen(true)}
                disabled={rotateKeysMutation.isPending}
              >
                {t('federation.settings.rotateKeys')}
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      <ImportBlocklistDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        isPending={importBlocklistMutation.isPending}
      />

      <EditReasonDialog
        open={!!editing}
        instance={editing}
        onClose={() => setEditing(null)}
        onSave={handleEditSave}
        isPending={updateBlockedInstanceMutation.isPending}
      />

      <ConfirmDialog
        open={rotateConfirmOpen}
        title={t('federation.settings.rotateKeysConfirm')}
        message={t('federation.settings.rotateKeysMessage')}
        confirmLabel={t('federation.settings.rotateKeys')}
        confirmColor="warning"
        onConfirm={() => {
          rotateKeysMutation.mutate();
          setRotateConfirmOpen(false);
        }}
        onCancel={() => setRotateConfirmOpen(false)}
        loading={rotateKeysMutation.isPending}
      />

      <ConfirmDialog
        open={!!instanceState.deleting}
        title={t('federation.blocklist.unblockInstanceTitle')}
        message={t('federation.blocklist.unblockInstanceMessage', { domain: instanceState.deleting?.domain })}
        confirmLabel={t('federation.blocklist.unblockConfirm')}
        onConfirm={() => {
          if (instanceState.deleting) {
            unblockInstanceMutation.mutate(instanceState.deleting.domain, {
              onSuccess: () => instanceState.closeDelete(),
            });
          }
        }}
        onCancel={instanceState.closeDelete}
        loading={unblockInstanceMutation.isPending}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        title={t('federation.blocklist.clearAllTitle')}
        message={t('federation.blocklist.clearAllMessage')}
        confirmLabel={t('federation.blocklist.clearAllConfirm')}
        confirmColor="error"
        onConfirm={() => {
          clearBlocklistMutation.mutate(undefined, {
            onSuccess: () => setClearConfirmOpen(false),
          });
        }}
        onCancel={() => setClearConfirmOpen(false)}
        loading={clearBlocklistMutation.isPending}
      />
    </Box>
  );
}
