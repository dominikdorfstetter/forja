import { Grid } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from '@/services/health';
import { getSites, getSystemStorageOverview } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import GlobalCacheSection from '@/components/cache/GlobalCacheSection';
import { queryKeys } from '@/lib/queryKeys';
import SitesTotalCard from './dashboard/SitesTotalCard';
import { HealthSummaryCard, ServiceHealthCard } from './dashboard/HealthCards';
import StorageOverviewCard from './dashboard/StorageOverviewCard';

export default function SystemDashboardPage() {
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => getHealth(),
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: queryKeys.sites(),
    queryFn: () => getSites(),
  });

  const { data: storageOverview } = useQuery({
    queryKey: queryKeys.systemStorageOverview(),
    queryFn: () => getSystemStorageOverview(),
  });

  if (healthLoading || sitesLoading) return <LoadingState />;

  return (
    <Grid container spacing={3} data-testid="system.dashboard">
      <Grid size={{ xs: 12, md: 4 }}>
        <SitesTotalCard count={sites?.length ?? 0} />
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <HealthSummaryCard health={health} error={healthError} />
      </Grid>

      <Grid size={12}>
        <ServiceHealthCard
          health={health}
          error={healthError}
          refreshing={healthLoading}
          onRefresh={() => refetchHealth()}
        />
      </Grid>

      {storageOverview && (
        <Grid size={12}>
          <StorageOverviewCard overview={storageOverview} />
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <GlobalCacheSection />
      </Grid>
    </Grid>
  );
}
