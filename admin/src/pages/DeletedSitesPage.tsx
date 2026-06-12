import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Box, Container, Typography } from '@mui/material';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeletedSites, restoreSite } from '@/services/sites';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { ForjaBrandMark, M3Button } from '@/components/design-system';
import type { ProblemDetails, Site } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

const GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const isProblem = (e: unknown): e is ProblemDetails =>
  typeof e === 'object' && e !== null && 'status' in e;

/** Whole days left in the 30-day restore window (clamped at 0). */
function graceDaysRemaining(deletedAt: string | null | undefined): number {
  if (!deletedAt) return GRACE_DAYS;
  const expiresAt = new Date(deletedAt).getTime() + GRACE_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / DAY_MS));
}

/**
 * Deleted-sites restore view (#713). Surfaced from the site launcher — runs
 * without a selected site (you may have just deleted your only one), so it
 * wears launcher chrome rather than the in-app Layout. The backend
 * `/sites/deleted` list is already membership-scoped; we further narrow to
 * sites the caller can actually restore (owner — `getRoleForSite` returns
 * `'owner'` for system admins too), satisfying the owner/sysadmin gate.
 */
export default function DeletedSitesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useLocalizedFormat();
  const { getRoleForSite } = useAuth();
  const queryClient = useQueryClient();
  const { showError, showSuccess, enqueueSnackbar } = useErrorSnackbar();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.sitesDeleted(),
    queryFn: () => getDeletedSites(),
  });

  const sites = (data ?? []).filter((s) => getRoleForSite(s.id) === 'owner');

  const mutation = useMutation({
    mutationFn: (id: string) => restoreSite(id),
    onSuccess: () => {
      showSuccess(t('siteSettings.deletedSites.restored'));
      queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
    },
    onError: (err: unknown) => {
      if (isProblem(err) && err.status === 410) {
        enqueueSnackbar(t('siteSettings.deletedSites.expired'), {
          variant: 'error',
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.sitesDeleted() });
        return;
      }
      showError(err);
    },
  });

  if (isLoading) return <LoadingState label={t('sites.loading')} />;

  return (
    <Container maxWidth="md" sx={{ py: 6 }} data-testid="deleted-sites.page">
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <ForjaBrandMark size={48} sx={{ mx: 'auto', mb: 2 }} />
        <Typography
          component="h1"
          gutterBottom
          sx={{
            fontSize: { xs: 26, sm: 32 },
            fontWeight: 700,
            fontVariationSettings: '"wght" 700, "opsz" 32',
            letterSpacing: -0.4,
            color: 'var(--on-surface)',
          }}
        >
          {t('siteSettings.deletedSites.title')}
        </Typography>
        <Typography
          sx={{
            fontSize: 15,
            color: 'var(--on-surface-variant)',
            fontVariationSettings: '"wght" 500, "opsz" 15',
          }}
        >
          {t('siteSettings.deletedSites.subtitle')}
        </Typography>
      </Box>

      {sites.length === 0 ? (
        <EmptyState
          icon={<RestoreFromTrashIcon sx={{ fontSize: 56 }} />}
          title={t('siteSettings.deletedSites.empty')}
        />
      ) : (
        <Box
          component="ul"
          aria-label={t('siteSettings.deletedSites.title')}
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}
        >
          {sites.map((s: Site) => {
            const days = graceDaysRemaining(s.deleted_at);
            return (
              <Box
                component="li"
                key={s.id}
                data-testid={`deleted-sites.row.${s.id}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderRadius: 3,
                  background: 'var(--surface-container)',
                  border: '1px solid var(--outline-variant)',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{ fontWeight: 600, fontSize: 15, color: 'var(--on-surface)' }}
                  >
                    {s.name}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 12.5, color: 'var(--on-surface-variant)' }}
                  >
                    {s.deleted_at
                      ? t('siteSettings.deletedSites.deletedOn', {
                          date: fmt(s.deleted_at, 'PP'),
                        })
                      : ''}
                    {' · '}
                    {t('siteSettings.deletedSites.expiresIn', { days })}
                  </Typography>
                </Box>
                <M3Button
                  variant="filled"
                  size="sm"
                  icon="restore"
                  loading={mutation.isPending && mutation.variables === s.id}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(s.id)}
                  ariaLabel={t('siteSettings.deletedSites.restoreLabel', {
                    site: s.name,
                  })}
                  data-testid={`deleted-sites.restore.${s.id}`}
                >
                  {t('siteSettings.deletedSites.restore')}
                </M3Button>
              </Box>
            );
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <M3Button
          variant="text"
          icon="arrow_back"
          onClick={() => navigate('/sites')}
          data-testid="deleted-sites.back"
        >
          {t('common.actions.back')}
        </M3Button>
      </Box>
    </Container>
  );
}
