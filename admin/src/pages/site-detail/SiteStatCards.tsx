import { Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { SiteMembership, StorageUsageResponse } from '@/types/api';
import StatCard from './StatCard';
import { formatBytes } from '@/utils/formatBytes';
import { summarizeOwner } from './siteDetailUtils';

interface SiteStatCardsProps {
  members: SiteMembership[];
  storage: StorageUsageResponse | undefined;
}

/** Members / owner / storage stat row — each card deep-links to its settings page. */
export default function SiteStatCards({ members, storage }: SiteStatCardsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const owner = summarizeOwner(members, t('siteDetail.stats.ownerMissing'));
  const storagePercent = storage?.usage_percent ?? 0;
  const storageUsedLabel = storage
    ? t('siteDetail.stats.storageOf', {
        used: formatBytes(storage.total_bytes),
        quota: formatBytes(storage.quota_bytes),
      })
    : undefined;

  return (
    <Grid container spacing={2.5} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          icon="group"
          label={t('siteDetail.stats.members')}
          primary={members.length}
          secondary={t('siteDetail.stats.membersHint')}
          onClick={() => navigate('/site-settings/members')}
          testId="site-detail.stat.members"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          icon="shield_person"
          label={t('siteDetail.stats.owner')}
          primary={
            <Box
              component="span"
              sx={{
                fontSize: owner.hasOwner ? 18 : 16,
                fontWeight: owner.hasOwner ? 700 : 500,
                color: owner.hasOwner ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {owner.label}
            </Box>
          }
          secondary={owner.email}
          onClick={() => navigate('/site-settings/members')}
          testId="site-detail.stat.owner"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          icon="database"
          label={t('siteDetail.stats.storage')}
          primary={`${Math.round(storagePercent)}%`}
          progress={storagePercent}
          secondary={storageUsedLabel}
          onClick={() => navigate('/site-settings/content')}
          testId="site-detail.stat.storage"
        />
      </Grid>
    </Grid>
  );
}
