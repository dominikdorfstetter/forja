import { useMemo } from 'react';
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import type { BlogListItem, PageListItem, ContentStatus } from '@/types/api';

interface RecentActivityPanelProps {
  blogs: BlogListItem[];
  pages: PageListItem[];
  loading?: boolean;
}

interface ActivityItem {
  id: string;
  label: string;
  type: 'blog' | 'page';
  status: ContentStatus;
  timestamp: string;
  path: string;
}

const STATUS_COLOR: Record<ContentStatus, 'warning' | 'secondary' | 'info' | 'success' | 'default'> = {
  Draft: 'warning',
  InReview: 'secondary',
  Scheduled: 'info',
  Published: 'success',
  Archived: 'default',
};

export default function RecentActivityPanel({ blogs, pages, loading }: RecentActivityPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = useMemo<ActivityItem[]>(() => {
    const blogItems: ActivityItem[] = blogs.map((b) => ({
      id: b.id,
      label: b.slug || t('common.labels.untitled'),
      type: 'blog',
      status: b.status,
      timestamp: b.updated_at,
      path: `/blogs/${b.id}`,
    }));

    const pageItems: ActivityItem[] = pages.map((p) => ({
      id: p.id,
      label: p.route || t('common.labels.untitled'),
      type: 'page',
      status: p.status,
      timestamp: p.created_at,
      path: `/pages/${p.id}`,
    }));

    return [...blogItems, ...pageItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [blogs, pages, t]);

  return (
    <>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        {t('dashboard.recentActivity')}
      </Typography>

      {loading ? (
        <Stack spacing={1}>
          {(['activity-skel-0', 'activity-skel-1', 'activity-skel-2', 'activity-skel-3'] as const).map((id) => (
            <Skeleton key={id} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('dashboard.recentActivityEmpty')}
        </Typography>
      ) : (
        <List disablePadding>
          {items.map((item) => (
            <ListItem
              key={`${item.type}-${item.id}`}
              divider
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {item.type === 'blog' ? (
                  <ArticleIcon fontSize="small" color="primary" />
                ) : (
                  <DescriptionIcon fontSize="small" color="primary" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={item.status}
                      size="small"
                      color={STATUS_COLOR[item.status]}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Typography variant="caption" color="text.secondary" component="span">
                      {t('dashboard.updatedAgo', {
                        time: formatDistanceToNow(new Date(item.timestamp), { addSuffix: false }),
                      })}
                    </Typography>
                  </Stack>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
              <Box sx={{ ml: 1 }}>
                <Chip
                  label={item.type === 'blog' ? t('layout.sidebar.blogs') : t('layout.sidebar.pages')}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
