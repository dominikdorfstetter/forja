import { Box, Card, CardContent, Chip, Grid, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SendIcon from '@mui/icons-material/Send';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HubIcon from '@mui/icons-material/Hub';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationStats, useFederationSettings } from '@/hooks/useFederationData';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, icon, color = 'primary.main' }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h4" fontWeight={700}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function FederationOverview() {
  const { selectedSiteId } = useSiteContext();
  const { data: stats, isLoading: statsLoading } = useFederationStats(selectedSiteId);
  const { data: settings, isLoading: settingsLoading } = useFederationSettings(selectedSiteId);

  const isLoading = statsLoading || settingsLoading;

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-overview.page">
        <PageHeader title="Federation" subtitle="ActivityPub federation overview" />
        <EmptyState icon={<HubIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to view federation status." />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-overview.page">
        <PageHeader title="Federation" subtitle="ActivityPub federation overview" />
        <LoadingState label="Loading federation data..." />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-overview.page">
      <PageHeader title="Federation" subtitle="ActivityPub federation overview" />

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip
          label={settings?.enabled ? 'Enabled' : 'Disabled'}
          color={settings?.enabled ? 'success' : 'default'}
          size="small"
        />
        {settings?.actorHandle && (
          <Typography variant="body1" fontFamily="monospace">
            {settings.actorHandle}
          </Typography>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Followers"
            value={stats?.followersCount ?? 0}
            icon={<PeopleIcon fontSize="large" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Posts Syndicated"
            value={stats?.postsSyndicated ?? 0}
            icon={<SendIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Pending Comments"
            value={stats?.pendingComments ?? 0}
            icon={<CommentIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Failed Deliveries"
            value={stats?.failedDeliveries ?? 0}
            icon={<ErrorOutlineIcon fontSize="large" />}
            color="error.main"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
