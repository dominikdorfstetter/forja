import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Box, LinearProgress } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { deleteSite, getSitesOverview } from '@/services/sites';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SiteCreationWizard from '@/components/sites/SiteCreationWizard';
import {
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  Pagination,
  type DataTableV2Column,
} from '@/components/shared/listPageV2';
import { M3Button, M3IconButton } from '@/components/design-system';
import type { SiteOverviewEntry } from '@/types/api';

interface DeletingSite {
  id: string;
  name: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Tonal status pill — reuses the same vocabulary as legal/navigation rows. */
function TonalPill({ label, tone }: { label: string; tone: 'tertiary' | 'warn' | 'neutral' }) {
  const paint =
    tone === 'tertiary'
      ? { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' }
      : tone === 'warn'
        ? { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' }
        : { bg: 'transparent', fg: 'var(--on-surface-variant)', border: '1px solid var(--outline-variant)' };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        height: 22,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        border: paint.border ?? 'none',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 11',
      }}
    >
      {label}
    </Box>
  );
}

export default function SystemSitesPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deletingSite, setDeletingSite] = useState<DeletingSite | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['sites-overview'],
    queryFn: () => getSitesOverview(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setDeletingSite(null);
      enqueueSnackbar(t('sites.messages.deleted'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('common.errors.deleteFailed'), { variant: 'error' });
    },
  });

  const filteredSites = useMemo(() => {
    if (!overview?.sites) return [];
    const q = search.toLowerCase();
    return overview.sites.filter(s =>
      s.site_name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
    );
  }, [overview?.sites, search]);

  const paginatedSites = filteredSites.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  if (isLoading) return <LoadingState />;

  const columns: DataTableV2Column<SiteOverviewEntry>[] = [
    {
      key: 'name',
      label: t('common.table.name'),
      width: 'minmax(200px, 2fr)',
      render: (row) => (
        <Box>
          <Box component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>
            {row.site_name}
          </Box>
          <Box
            component="span"
            sx={{ display: 'block', fontFamily: 'monospace', fontSize: 11, color: 'var(--on-surface-variant)' }}
          >
            {row.slug}
          </Box>
        </Box>
      ),
    },
    {
      key: 'status',
      label: t('common.table.status'),
      width: '120px',
      render: (row) => (
        <TonalPill
          label={row.is_active ? t('common.status.active') : t('common.status.inactive')}
          tone={row.is_active ? 'tertiary' : 'neutral'}
        />
      ),
    },
    {
      key: 'maintenance',
      label: t('common.table.maintenance'),
      width: '140px',
      render: (row) =>
        row.maintenance_mode ? (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <WarningIcon sx={{ fontSize: 14, color: 'var(--on-warn-container)' }} />
            <TonalPill label={t('common.status.maintenance')} tone="warn" />
          </Box>
        ) : (
          <Box component="span" sx={{ color: 'var(--on-surface-variant)' }}>–</Box>
        ),
    },
    {
      key: 'members',
      label: t('common.table.members'),
      width: '100px',
      align: 'right',
      render: (row) => String(row.member_count),
    },
    {
      key: 'storage',
      label: t('common.table.storage'),
      width: 'minmax(160px, 1fr)',
      render: (row) => {
        const pct = Math.min(row.storage_usage_percent, 100);
        const color =
          pct > 90 ? 'var(--err)' : pct > 70 ? 'var(--on-warn-container)' : 'var(--primary)';
        return (
          <Box sx={{ minWidth: 120 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                mb: 0.5,
                borderRadius: 999,
                height: 6,
                bgcolor: 'var(--surface-container-high)',
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 },
              }}
            />
            <Box component="span" sx={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              {formatBytes(row.total_storage_bytes)} / {formatBytes(row.storage_quota_bytes)}
            </Box>
          </Box>
        );
      },
    },
    {
      key: 'created',
      label: t('common.table.created'),
      width: '140px',
      muted: true,
      render: (row) => fmt(row.created_at, 'PP'),
    },
  ];

  return (
    <Box data-testid="system.sites">
      <Toolbar>
        <Box sx={{ flex: '1 1 auto', maxWidth: 520 }}>
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t('common.search.placeholder')}
            data-testid="system.sites.search"
            fullWidth
          />
        </Box>
        <ToolbarSpacer />
        <M3Button variant="filled" icon="add" onClick={() => setWizardOpen(true)} data-testid="system.sites.create">
          {t('sites.createButton')}
        </M3Button>
      </Toolbar>

      <DataTableV2<SiteOverviewEntry>
        columns={columns}
        rows={paginatedSites}
        getKey={(row) => row.site_id}
        renderActions={(row) => (
          <Box sx={{ display: 'inline-flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <M3IconButton
              name="open_in_new"
              size={32}
              tooltip={t('common.actions.viewDetails')}
              onClick={() => navigate(`/sites/${row.site_id}`)}
            />
            <M3IconButton
              name="delete"
              size={32}
              tooltip={t('common.actions.delete')}
              onClick={() => setDeletingSite({ id: row.site_id, name: row.site_name })}
            />
          </Box>
        )}
        emptyMessage={t('common.table.noData')}
        data-testid="system.sites.table"
      />

      {filteredSites.length > 0 && (
        <Pagination
          total={filteredSites.length}
          page={page}
          perPage={rowsPerPage}
          onPage={setPage}
          onPerPage={(n) => {
            setRowsPerPage(n);
            setPage(1);
          }}
          options={[5, 10, 25]}
        />
      )}

      <SiteCreationWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <ConfirmDialog
        open={!!deletingSite}
        title={t('sites.deleteDialog.title')}
        message={t('sites.deleteDialog.message', { name: deletingSite?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingSite && deleteMutation.mutate(deletingSite.id)}
        onCancel={() => setDeletingSite(null)}
        loading={deleteMutation.isPending}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
