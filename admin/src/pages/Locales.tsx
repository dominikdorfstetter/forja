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
  Divider,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type {
  Locale,
  CreateLocaleRequest,
  UpdateLocaleRequest,
} from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LocaleFormDialog from '@/components/locales/LocaleFormDialog';

export default function LocalesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { isAdmin } = useAuth();

  const [formOpen, setFormOpen] = useState(false);
  const [editingLocale, setEditingLocale] = useState<Locale | null>(null);
  const [deletingLocale, setDeletingLocale] = useState<Locale | null>(null);

  const { data: locales, isLoading } = useQuery({
    queryKey: ['locales', 'all'],
    queryFn: () => apiService.getLocales(true),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLocaleRequest) => apiService.createLocale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locales'] });
      setFormOpen(false);
      enqueueSnackbar(t('locales.messages.created'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLocaleRequest }) =>
      apiService.updateLocale(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locales'] });
      setEditingLocale(null);
      enqueueSnackbar(t('locales.messages.updated'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteLocale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locales'] });
      setDeletingLocale(null);
      enqueueSnackbar(t('locales.messages.deleted'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  return (
    <Box>
      <PageHeader title={t('locales.title')} subtitle={t('locales.subtitle')} />

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box />
          {isAdmin && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
              {t('locales.addLanguage')}
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />

        {isLoading ? (
          <LoadingState label={t('locales.loading')} />
        ) : !locales || locales.length === 0 ? (
          <EmptyState
            icon={<LanguageIcon sx={{ fontSize: 64 }} />}
            title={t('locales.empty.title')}
            description={t('locales.empty.description')}
            action={isAdmin ? { label: t('locales.addLanguage'), onClick: () => setFormOpen(true) } : undefined}
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell scope="col">{t('locales.columns.code')}</TableCell>
                  <TableCell scope="col">{t('locales.columns.name')}</TableCell>
                  <TableCell scope="col">{t('locales.columns.nativeName')}</TableCell>
                  <TableCell scope="col">{t('locales.columns.direction')}</TableCell>
                  <TableCell scope="col">{t('locales.columns.active')}</TableCell>
                  <TableCell scope="col">{t('locales.columns.created')}</TableCell>
                  {isAdmin && <TableCell scope="col" align="right">{t('locales.columns.actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {locales.map((locale) => (
                  <TableRow key={locale.id}>
                    <TableCell>
                      <Chip label={locale.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                    </TableCell>
                    <TableCell>{locale.name}</TableCell>
                    <TableCell>{locale.native_name || '\u2014'}</TableCell>
                    <TableCell>
                      <Chip
                        label={locale.direction === 'Rtl' ? 'RTL' : 'LTR'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={locale.is_active ? t('common.status.active') : t('common.status.inactive')}
                        size="small"
                        color={locale.is_active ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{format(new Date(locale.created_at), 'PP')}</TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        <Tooltip title={t('common.actions.edit')}>
                          <IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingLocale(locale)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.actions.delete')}>
                          <IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingLocale(locale)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create Dialog */}
      <LocaleFormDialog
        open={formOpen}
        onSubmitCreate={(data) => createMutation.mutate(data)}
        onClose={() => setFormOpen(false)}
        loading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <LocaleFormDialog
        open={!!editingLocale}
        locale={editingLocale}
        onSubmitUpdate={(data) => editingLocale && updateMutation.mutate({ id: editingLocale.id, data })}
        onClose={() => setEditingLocale(null)}
        loading={updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={!!deletingLocale}
        title={t('locales.deleteDialog.title')}
        message={t('locales.deleteDialog.message', { code: deletingLocale?.code })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingLocale && deleteMutation.mutate(deletingLocale.id)}
        onCancel={() => setDeletingLocale(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
