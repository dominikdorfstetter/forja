import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Box, Grid, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WebIcon from '@mui/icons-material/Web';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { Site, CreateSiteRequest } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SiteCard from '@/components/sites/SiteCard';
import SiteFormDialog from '@/components/sites/SiteFormDialog';

export default function SitesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { isAdmin, refreshAuth } = useAuth();
  const { setSelectedSiteId } = useSiteContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  const { data: sites, isLoading, error } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiService.getSites(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSiteRequest) => apiService.createSite(data),
    onSuccess: async (newSite) => {
      // Refresh auth to pick up the new owner membership
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setSelectedSiteId(newSite.id);
      setFormOpen(false);
      enqueueSnackbar(t('sites.messages.created'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateSiteRequest }) => apiService.updateSite(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setEditingSite(null);
      enqueueSnackbar(t('sites.messages.updated'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setDeletingSite(null);
      enqueueSnackbar(t('sites.messages.deleted'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  if (isLoading) return <LoadingState label={t('sites.loading')} />;
  if (error) return <Alert severity="error">{t('sites.loadError')}</Alert>;

  return (
    <Box>
      <PageHeader
        title={t('sites.title')}
        subtitle={t('sites.subtitle')}
        action={{ label: t('sites.createButton'), icon: <AddIcon />, onClick: () => setFormOpen(true) }}
      />

      {sites && sites.length > 0 ? (
        <Grid container spacing={3}>
          {sites.map((site) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={site.id}>
              <SiteCard
                site={site}
                onView={(s) => navigate(`/sites/${s.id}`)}
                onEdit={isAdmin ? (s) => setEditingSite(s) : undefined}
                onDelete={isAdmin ? (s) => setDeletingSite(s) : undefined}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState
          icon={<WebIcon sx={{ fontSize: 64 }} />}
          title={t('sites.empty.title')}
          description={t('sites.empty.description')}
          action={{ label: t('sites.createButton'), onClick: () => setFormOpen(true) }}
        />
      )}

      <SiteFormDialog
        open={formOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        onClose={() => setFormOpen(false)}
        loading={createMutation.isPending}
      />

      <SiteFormDialog
        open={!!editingSite}
        site={editingSite}
        onSubmit={(data) => editingSite && updateMutation.mutate({ id: editingSite.id, data })}
        onClose={() => setEditingSite(null)}
        loading={updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deletingSite}
        title={t('sites.deleteDialog.title')}
        message={t('sites.deleteDialog.message', { name: deletingSite?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingSite && deleteMutation.mutate(deletingSite.id)}
        onCancel={() => setDeletingSite(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
