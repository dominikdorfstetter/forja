import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { Box, Grid, Container, Typography, Alert, Stack } from '@mui/material';
import WebIcon from '@mui/icons-material/Web';
import ExploreIcon from '@mui/icons-material/Explore';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useMutation } from '@tanstack/react-query';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import SiteCard from '@/components/sites/SiteCard';
import SiteCreationWizard from '@/components/sites/SiteCreationWizard';
import { ForjaBrandMark, M3Button } from '@/components/design-system';
import { joinDemoSite } from '@/services/auth';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { Site } from '@/types/api';

export default function SitesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sites, isLoading, setSelectedSiteId, selectedSiteId } = useSiteContext();
  const { isGuest, siteId: authSiteId, getRoleForSite, demoMode, memberships, refreshAuth } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  const { showError } = useErrorSnackbar();

  const joinDemoMutation = useMutation({
    mutationFn: () => joinDemoSite(),
    onSuccess: () => {
      refreshAuth();
    },
    onError: (err) => {
      showError(err);
    },
  });

  const isSiteScoped = !!authSiteId;

  const handlePaletteAction = useCallback((e: Event) => {
    if ((e as CustomEvent).detail === 'create-site') setWizardOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('command-palette:action', handlePaletteAction);
    return () => window.removeEventListener('command-palette:action', handlePaletteAction);
  }, [handlePaletteAction]);

  useEffect(() => {
    if (!isSiteScoped && !selectedSiteId && sites && sites.length === 1) {
      setSelectedSiteId(sites[0].id);
      navigate('/', { replace: true });
    }
  }, [sites, isSiteScoped, selectedSiteId, setSelectedSiteId, navigate]);

  const handleSelectSite = (site: Site) => {
    setSelectedSiteId(site.id);
    navigate('/');
  };

  if (isSiteScoped) return <Navigate to="/" replace />;

  if (isLoading) return <LoadingState label={t('sites.loading')} />;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }} data-testid="site-launcher">
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <ForjaBrandMark size={48} sx={{ mx: 'auto', mb: 2 }} />
        <Typography
          component="h1"
          gutterBottom
          sx={{
            fontSize: { xs: 28, sm: 34 },
            fontWeight: 700,
            fontVariationSettings: '"wght" 700, "opsz" 32',
            letterSpacing: -0.4,
            color: 'var(--on-surface)',
          }}
        >
          {t('sites.launcher.title')}
        </Typography>
        <Typography
          sx={{
            fontSize: 15,
            color: 'var(--on-surface-variant)',
            fontVariationSettings: '"wght" 500, "opsz" 15',
          }}
        >
          {t('sites.launcher.subtitle')}
        </Typography>
      </Box>

      {demoMode && memberships.length === 0 && (
        <Alert
          severity="info"
          icon={<ExploreIcon />}
          sx={{ mb: 4 }}
          data-testid="demo-join-prompt"
          action={
            <Stack direction="row" spacing={1}>
              <M3Button
                variant="filled"
                size="md"
                icon="explore"
                onClick={() => joinDemoMutation.mutate()}
                disabled={joinDemoMutation.isPending}
                data-testid="demo-join-accept"
              >
                {t('sites.demoJoin.accept')}
              </M3Button>
              <M3Button
                variant="text"
                size="md"
                onClick={() => setWizardOpen(true)}
                data-testid="demo-join-create"
              >
                {t('sites.createButton')}
              </M3Button>
            </Stack>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {t('sites.demoJoin.title')}
          </Typography>
          <Typography variant="body2">
            {t('sites.demoJoin.description')}
          </Typography>
        </Alert>
      )}

      {sites && sites.length > 0 ? (
        <Grid container spacing={3}>
          {sites.map((site) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={site.id}>
              <SiteCard
                site={site}
                role={getRoleForSite(site.id)}
                onSelect={handleSelectSite}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState
          icon={<WebIcon sx={{ fontSize: 64 }} />}
          title={t('sites.empty.title')}
          description={t('sites.empty.description')}
          action={{ label: t('sites.createButton'), onClick: () => setWizardOpen(true) }}
        />
      )}

      {sites && sites.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 4, flexWrap: 'wrap' }}>
          {selectedSiteId && (
            <M3Button
              variant="text"
              icon="close"
              onClick={() => navigate('/')}
              data-testid="site-launcher-cancel"
            >
              {t('common.actions.cancel')}
            </M3Button>
          )}
          {!isGuest && (
            <M3Button
              variant="filled"
              icon="add"
              onClick={() => setWizardOpen(true)}
              data-testid="site-launcher-create"
            >
              {t('sites.createButton')}
            </M3Button>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <M3Button
          variant="text"
          size="sm"
          icon="restore_from_trash"
          onClick={() => navigate('/sites/deleted')}
          data-testid="sites.recently-deleted"
        >
          {t('siteSettings.deletedSites.entry')}
        </M3Button>
      </Box>

      <SiteCreationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </Container>
  );
}
