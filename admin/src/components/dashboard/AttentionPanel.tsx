import {
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Skeleton,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import type { BlogListItem, PageListItem } from '@/types/api';

interface AttentionPanelProps {
  inReviewBlogs: BlogListItem[];
  inReviewPages: PageListItem[];
  draftBlogs: BlogListItem[];
  draftPages: PageListItem[];
  publishedBlogs: BlogListItem[];
  loading?: boolean;
}

export default function AttentionPanel({
  inReviewBlogs,
  inReviewPages,
  draftBlogs,
  draftPages,
  publishedBlogs,
  loading,
}: AttentionPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentSiteRole, canWrite } = useAuth();

  // Determine what to show based on role
  const isReviewer = currentSiteRole === 'reviewer';
  const isViewer = !canWrite && !isReviewer;

  let title: string;
  let emptyMessage: string;
  let items: Array<{ id: string; label: string; type: 'blog' | 'page'; path: string }>;

  if (isReviewer) {
    title = t('dashboard.attention.awaitingReview');
    emptyMessage = t('dashboard.attention.noItemsReview');
    items = [
      ...inReviewBlogs.map((b) => ({
        id: b.id,
        label: b.slug || t('common.labels.untitled'),
        type: 'blog' as const,
        path: `/blogs/${b.id}`,
      })),
      ...inReviewPages.map((p) => ({
        id: p.id,
        label: p.route || t('common.labels.untitled'),
        type: 'page' as const,
        path: `/pages/${p.id}`,
      })),
    ];
  } else if (isViewer) {
    title = t('dashboard.attention.recentlyPublished');
    emptyMessage = t('dashboard.attention.noItemsPublished');
    items = publishedBlogs.slice(0, 5).map((b) => ({
      id: b.id,
      label: b.slug || t('common.labels.untitled'),
      type: 'blog' as const,
      path: `/blogs/${b.id}`,
    }));
  } else {
    title = t('dashboard.attention.draftsToFinish');
    emptyMessage = t('dashboard.attention.noItemsDrafts');
    items = [
      ...draftBlogs.map((b) => ({
        id: b.id,
        label: b.slug || t('common.labels.untitled'),
        type: 'blog' as const,
        path: `/blogs/${b.id}`,
      })),
      ...draftPages.map((p) => ({
        id: p.id,
        label: p.route || t('common.labels.untitled'),
        type: 'page' as const,
        path: `/pages/${p.id}`,
      })),
    ];
  }

  const displayItems = items.slice(0, 5);

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {items.length > 5 && (
          <Button size="small" onClick={() => navigate(isReviewer ? '/blogs' : '/my-drafts')}>
            {t('dashboard.attention.viewAll')}
          </Button>
        )}
      </Stack>

      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : displayItems.length === 0 ? (
        <Alert severity="success" variant="outlined">
          {emptyMessage}
        </Alert>
      ) : (
        <List disablePadding>
          {displayItems.map((item) => (
            <ListItem
              key={item.id}
              divider
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {item.type === 'blog' ? (
                  <ArticleIcon color="primary" fontSize="small" />
                ) : (
                  <DescriptionIcon color="primary" fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText primary={item.label} />
              <Chip
                label={item.type === 'blog' ? t('layout.sidebar.blogs') : t('layout.sidebar.pages')}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
