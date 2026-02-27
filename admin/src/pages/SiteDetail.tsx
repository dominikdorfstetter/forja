import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { Site, CreateSiteRequest } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SiteFormDialog from '@/components/sites/SiteFormDialog';
import SiteLocalesManager from '@/components/sites/SiteLocalesManager';
import EntityHistoryPanel from '@/components/shared/EntityHistoryPanel';
import InlineEditField from '@/components/shared/InlineEditField';

export default function SiteDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: site, isLoading, error } = useQuery({
    queryKey: ['site', id],
    queryFn: () => apiService.getSite(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateSiteRequest> & { is_active?: boolean }) =>
      apiService.updateSite(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setEditOpen(false);
      enqueueSnackbar(t('siteDetail.messages.updated'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiService.deleteSite(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      enqueueSnackbar(t('siteDetail.messages.deleted'), { variant: 'success' });
      navigate('/sites');
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const handleToggleActive = (site: Site) => {
    updateMutation.mutate({ is_active: !site.is_active });
  };

  if (isLoading) return <LoadingState label={t('siteDetail.loading')} />;
  if (error || !site) return <Alert severity="error">{t('siteDetail.loadFailed')}</Alert>;

  return (
    <Box>
      <PageHeader
        title={site.name}
        subtitle={site.slug}
        breadcrumbs={[
          { label: t('layout.sidebar.sites'), path: '/sites' },
          { label: site.name },
        ]}
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{t('siteDetail.siteInfo')}</Typography>
              {isAdmin && <Button variant="outlined" onClick={() => setEditOpen(true)}>{t('common.actions.edit')}</Button>}
            </Box>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.name')}</Typography>
                <InlineEditField
                  value={site.name}
                  variant="body1"
                  disabled={!isAdmin}
                  onSave={async (newName) => {
                    await apiService.updateSite(id!, { name: newName });
                    queryClient.invalidateQueries({ queryKey: ['site', id] });
                    queryClient.invalidateQueries({ queryKey: ['sites'] });
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.slug')}</Typography>
                <Typography variant="body1" fontFamily="monospace">{site.slug}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.description')}</Typography>
                <InlineEditField
                  value={site.description || ''}
                  variant="body1"
                  disabled={!isAdmin}
                  onSave={async (newDescription) => {
                    await apiService.updateSite(id!, { description: newDescription });
                    queryClient.invalidateQueries({ queryKey: ['site', id] });
                    queryClient.invalidateQueries({ queryKey: ['sites'] });
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.timezone')}</Typography>
                <Typography variant="body1">{site.timezone}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.status')}</Typography>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={site.is_active}
                        onChange={() => handleToggleActive(site)}
                        disabled={updateMutation.isPending}
                      />
                    }
                    label={site.is_active ? t('common.status.active') : t('common.status.inactive')}
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Box sx={{ mt: 3 }}>
            <SiteLocalesManager siteId={id!} />
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>{t('siteDetail.metadata')}</Typography>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.id')}</Typography>
            <Typography variant="body2" fontFamily="monospace" sx={{ mb: 1, wordBreak: 'break-all' }}>
              {site.id}
            </Typography>

            <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.status')}</Typography>
            <Box sx={{ mb: 1 }}>
              <Chip
                label={site.is_active ? t('common.status.active') : t('common.status.inactive')}
                size="small"
                color={site.is_active ? 'success' : 'default'}
              />
            </Box>

            <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.created')}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {format(new Date(site.created_at), 'PPpp')}
            </Typography>

            <Typography variant="caption" color="text.secondary">{t('siteDetail.fields.updated')}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {format(new Date(site.updated_at), 'PPpp')}
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" gutterBottom>{t('siteDetail.quickLinks')}</Typography>
            <Button size="small" onClick={() => navigate('/blogs')} sx={{ display: 'block' }}>
              {t('layout.sidebar.blogs')}
            </Button>
            <Button size="small" onClick={() => navigate('/media')} sx={{ display: 'block' }}>
              {t('layout.sidebar.media')}
            </Button>
            <Button size="small" onClick={() => navigate('/taxonomy')} sx={{ display: 'block' }}>
              {t('layout.sidebar.taxonomy')}
            </Button>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>{t('entityHistory.title')}</Typography>
            <Divider sx={{ mb: 2 }} />
            <EntityHistoryPanel entityType="site" entityId={id!} />
          </Paper>

          {isAdmin && <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            fullWidth
            onClick={() => setDeleteOpen(true)}
          >
            {t('siteDetail.deleteSite')}
          </Button>}
        </Grid>
      </Grid>

      <SiteFormDialog
        open={editOpen}
        site={site}
        onSubmit={(data) => updateMutation.mutate(data)}
        onClose={() => setEditOpen(false)}
        loading={updateMutation.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t('sites.deleteDialog.title')}
        message={t('sites.deleteDialog.message', { name: site.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
