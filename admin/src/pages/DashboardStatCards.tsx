import {
  Card,
  CardContent,
  Box,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material';
import WebIcon from '@mui/icons-material/Web';
import ArticleIcon from '@mui/icons-material/Article';
import ImageIcon from '@mui/icons-material/Image';
import KeyIcon from '@mui/icons-material/Key';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';

const STATUS_COLORS: Record<ContentStatus, string> = {
  Draft: '#ed6c02',
  InReview: '#9c27b0',
  Scheduled: '#0288d1',
  Published: '#2e7d32',
  Archived: '#757575',
};

function StatCard({
  icon, label, value, loading, onClick, statusBreakdown,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
  onClick?: () => void;
  statusBreakdown?: Record<ContentStatus, number>;
}) {
  const total = statusBreakdown ? Object.values(statusBreakdown).reduce((s, n) => s + n, 0) : 0;

  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': onClick ? { boxShadow: 6 } : undefined,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{label}</Typography>
        </Box>
        {loading ? (
          <Skeleton variant="text" width={60} height={48} />
        ) : (
          <Typography variant="h3" fontWeight="bold">{value}</Typography>
        )}
        {statusBreakdown && total > 0 && !loading && (
          <Box sx={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', mt: 1.5 }}>
            {(Object.entries(statusBreakdown) as [ContentStatus, number][])
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <Box key={status} sx={{ width: `${(count / total) * 100}%`, bgcolor: STATUS_COLORS[status] }} />
              ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardStatCardsProps {
  hasSite: boolean;
  isAdmin: boolean;
  totalSites: number;
  sitesLoading: boolean;
  totalBlogs: number;
  blogsLoading: boolean;
  blogStatusCounts?: Record<ContentStatus, number>;
  totalPages: number;
  pagesLoading: boolean;
  pageStatusCounts?: Record<ContentStatus, number>;
  totalMedia: number;
  mediaLoading: boolean;
  totalApiKeys: number;
  apiKeysLoading: boolean;
}

export default function DashboardStatCards({
  hasSite, isAdmin,
  totalSites, sitesLoading,
  totalBlogs, blogsLoading, blogStatusCounts,
  totalPages, pagesLoading, pageStatusCounts,
  totalMedia, mediaLoading,
  totalApiKeys, apiKeysLoading,
}: DashboardStatCardsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Grid container spacing={3} sx={{ mb: 3 }} data-tour="dashboard-stats">
      <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
        <StatCard icon={<WebIcon color="primary" />} label={t('dashboard.stats.sites')} value={totalSites} loading={sitesLoading} onClick={() => navigate('/sites')} />
      </Grid>
      {hasSite && (
        <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
          <StatCard icon={<ArticleIcon color="primary" />} label={t('dashboard.stats.blogPosts')} value={totalBlogs} loading={blogsLoading} onClick={() => navigate('/blogs')} statusBreakdown={blogStatusCounts} />
        </Grid>
      )}
      {hasSite && (
        <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
          <StatCard icon={<DescriptionIcon color="primary" />} label={t('dashboard.stats.pages')} value={totalPages} loading={pagesLoading} onClick={() => navigate('/pages')} statusBreakdown={pageStatusCounts} />
        </Grid>
      )}
      {hasSite && (
        <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
          <StatCard icon={<ImageIcon color="primary" />} label={t('dashboard.stats.mediaFiles')} value={totalMedia} loading={mediaLoading} onClick={() => navigate('/media')} />
        </Grid>
      )}
      {isAdmin && (
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard icon={<KeyIcon color="primary" />} label={t('dashboard.stats.apiKeys')} value={totalApiKeys} loading={apiKeysLoading} onClick={() => navigate('/api-keys')} />
        </Grid>
      )}
    </Grid>
  );
}
