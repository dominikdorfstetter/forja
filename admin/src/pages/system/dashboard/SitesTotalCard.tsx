import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import DashboardCard from './DashboardCard';

/** Big-number card: how many sites this instance serves. */
export default function SitesTotalCard({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <DashboardCard icon="web" title={t('system.dashboard.sites')}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Box
          component="span"
          sx={{
            fontSize: 40,
            fontWeight: 700,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 700, "opsz" 40',
            letterSpacing: -0.5,
          }}
        >
          {count}
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
          {t('system.dashboard.sitesLabel', { count })}
        </Box>
      </Box>
    </DashboardCard>
  );
}
