import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Chip, Divider, IconButton, Tooltip, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { Locale, CreateLocaleRequest, UpdateLocaleRequest } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import LocaleFormDialog from '@/components/locales/LocaleFormDialog';

export default function LocalesPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const {
    formOpen, editing, deleting,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
  } = useListPageState<Locale>();

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-language') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data: locales, isLoading } = useQuery({
    queryKey: ['locales', 'all'],
    queryFn: () => apiService.getLocales(true),
  });

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateLocaleRequest, UpdateLocaleRequest
  >({
    queryKey: 'locales',
    create: {
      mutationFn: (data) => apiService.createLocale(data),
      successMessage: t('locales.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateLocale(id, data),
      successMessage: t('locales.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => apiService.deleteLocale(id),
      successMessage: t('locales.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const columns: DataTableColumn<Locale>[] = [
    { header: t('locales.columns.code'), scope: 'col', render: (locale) => <Chip label={locale.code} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} /> },
    { header: t('locales.columns.name'), scope: 'col', render: (locale) => locale.name },
    { header: t('locales.columns.nativeName'), scope: 'col', render: (locale) => locale.native_name || '\u2014' },
    { header: t('locales.columns.direction'), scope: 'col', render: (locale) => <Chip label={locale.direction === 'Rtl' ? 'RTL' : 'LTR'} size="small" variant="outlined" /> },
    { header: t('locales.columns.active'), scope: 'col', render: (locale) => <Chip label={locale.is_active ? t('common.status.active') : t('common.status.inactive')} size="small" color={locale.is_active ? 'success' : 'default'} variant="outlined" /> },
    { header: t('locales.columns.created'), scope: 'col', render: (locale) => format(new Date(locale.created_at), 'PP') },
    ...(isAdmin ? [{
      header: t('locales.columns.actions'),
      scope: 'col',
      align: 'right' as const,
      render: (locale: Locale) => (
        <>
          <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => openEdit(locale)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => openDelete(locale)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </>
      ),
    }] : []),
  ];

  return (
    <Box data-testid="locales.page">
      <PageHeader title={t('locales.title')} subtitle={t('locales.subtitle')} />

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box />
          {isAdmin && (
            <Button size="small" startIcon={<AddIcon />} onClick={openCreate}>
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
            action={isAdmin ? { label: t('locales.addLanguage'), onClick: openCreate } : undefined}
          />
        ) : (
          <DataTable
            data={locales}
            columns={columns}
            getRowKey={(locale) => locale.id}
          />
        )}
      </Paper>

      <LocaleFormDialog open={formOpen} onSubmitCreate={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <LocaleFormDialog open={!!editing} locale={editing} onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('locales.deleteDialog.title')} message={t('locales.deleteDialog.message', { code: deleting?.code })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
