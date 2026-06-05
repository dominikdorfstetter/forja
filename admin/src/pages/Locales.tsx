import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  Box, Paper, Typography, Chip, Divider, TextField,
  InputAdornment, Stack, Grid, Table, TableBody, TableCell,
  TableContainer, TableRow, IconButton, Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { getLocales, updateLocale } from '@/services/locales';
import type { Locale } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function LocalesPage() {
  const { t, i18n } = useTranslation();
  const { isMaster } = useAuth();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const location = useLocation();
  // When Locales renders inside SystemLayout (/system/languages) its
  // outer shell already shows a "Systemverwaltung / Sprachen" header —
  // rendering a second PageHeader here duplicates title + icon +
  // subtitle. Hide it in that embedded case.
  const embeddedInSystem = location.pathname.startsWith('/system');
  const [search, setSearch] = useState('');
  const [deactivating, setDeactivating] = useState<Locale | null>(null);

  const displayNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'language' }),
    [i18n.language]
  );

  const localizedName = useCallback(
    (locale: Locale): string => {
      try {
        const name = displayNames.of(locale.code);
        if (name && name !== locale.code) return name;
      } catch { /* Intl can throw for non-standard codes */ }
      return locale.name;
    },
    [displayNames],
  );

  const { data: locales, isLoading } = useQuery({
    queryKey: ['locales', 'all'],
    queryFn: () => getLocales(true),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateLocale(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locales'] });
      enqueueSnackbar(t('locales.messages.updated'), { variant: 'success' });
      setDeactivating(null);
    },
    onError: () => {
      enqueueSnackbar(t('common.errors.saveFailed'), { variant: 'error' });
      setDeactivating(null);
    },
  });

  const active = useMemo(() => locales?.filter((l) => l.is_active) ?? [], [locales]);
  const inactive = useMemo(() => {
    const all = locales?.filter((l) => !l.is_active) ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((l) =>
      l.code.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      (l.native_name?.toLowerCase().includes(q)) ||
      localizedName(l).toLowerCase().includes(q)
    );
  }, [locales, search, localizedName]);

  const handleToggle = (locale: Locale, newActive: boolean) => {
    if (!newActive && locale.site_count > 0) {
      setDeactivating(locale);
    } else {
      toggleMutation.mutate({ id: locale.id, is_active: newActive });
    }
  };

  if (isLoading) {
    return (
      <Box data-testid="locales.page">
        {!embeddedInSystem && (
          <PageHeader icon="language" title={t('locales.title')} subtitle={t('locales.subtitle')} />
        )}
        <LoadingState label={t('locales.loading')} />
      </Box>
    );
  }

  return (
    <Box data-testid="locales.page">
      {!embeddedInSystem && (
        <PageHeader icon="language" title={t('locales.title')} subtitle={t('locales.subtitle')} />
      )}

      {/* ── Active Languages ─────────────────────────────── */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('locales.active.title')} ({active.length})
      </Typography>

      {active.length === 0 ? (
        <Paper sx={{ p: 3, mb: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('locales.active.empty')}</Typography>
        </Paper>
      ) : (
        <Grid container spacing={1.5} sx={{ mb: 4 }}>
          {active.map((locale) => (
            <Grid key={locale.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: 'primary.main',
                }}
                data-testid={`locales.lang.${locale.code}`}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <CheckCircleIcon color="primary" sx={{ fontSize: 18 }} />
                    <Typography variant="body1" noWrap sx={{ fontWeight: 500 }}>
                      {localizedName(locale)}
                    </Typography>
                    {locale.direction === 'Rtl' && (
                      <Chip label="RTL" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
                    {locale.native_name ?? locale.name} · <code>{locale.code}</code>
                    {locale.site_count > 0 && ` · ${locale.site_count} site${locale.site_count !== 1 ? 's' : ''}`}
                  </Typography>
                </Box>
                {isMaster && (
                  <Tooltip title={t('locales.deactivate.confirm')}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggle(locale, false)}
                      disabled={toggleMutation.isPending}
                      data-testid={`locales.toggle.${locale.code}`}
                    >
                      <RemoveCircleOutlineIcon fontSize="small" color="error" />
                    </IconButton>
                  </Tooltip>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Available Languages Catalog ───────────────────── */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('locales.catalog.title')} ({inactive.length})
      </Typography>

      <Paper sx={{ p: 2 }}>
        <TextField
          size="small"
          placeholder={t('common.actions.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            },
          }}
          fullWidth
          sx={{ mb: 1.5 }}
          data-testid="locales.search"
        />
        <Divider />

        <TableContainer sx={{ maxHeight: 480 }}>
          <Table size="small" stickyHeader>
            <TableBody>
              {inactive.map((locale) => (
                <TableRow key={locale.id} hover data-testid={`locales.lang.${locale.code}`}>
                  <TableCell sx={{ width: 70 }}>
                    <Chip label={locale.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {localizedName(locale)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {locale.native_name ?? locale.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: 50 }}>
                    {locale.direction === 'Rtl' && (
                      <Chip label="RTL" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ width: 50 }}>
                    {isMaster && (
                      <Tooltip title={t('locales.catalog.enable')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleToggle(locale, true)}
                          disabled={toggleMutation.isPending}
                        >
                          <AddCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {inactive.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">{t('common.table.noData')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ConfirmDialog
        open={!!deactivating}
        title={t('locales.deactivate.title')}
        message={t('locales.deactivate.message', {
          name: deactivating ? localizedName(deactivating) : '',
          count: deactivating?.site_count ?? 0,
        })}
        confirmLabel={t('locales.deactivate.confirm')}
        onConfirm={() => deactivating && toggleMutation.mutate({ id: deactivating.id, is_active: false })}
        onCancel={() => setDeactivating(null)}
        loading={toggleMutation.isPending}
      />
    </Box>
  );
}
