import { Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItemButton, ListItemText, Stack, Tooltip, Typography } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import apiService from '@/services/api';
import type { FederationFeaturedPost } from '@/types/api';

interface PinPostDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  alreadyPinned: Set<string>;
  onSelect: (contentId: string) => void;
}

function PinPostDialog({ open, onClose, siteId, alreadyPinned, onSelect }: PinPostDialogProps) {
  const { t } = useTranslation();

  const { data: blogsData, isLoading } = useQuery({
    queryKey: ['blogs-for-pin', siteId],
    queryFn: () => apiService.getBlogs(siteId, { page: 1, page_size: 100, status: 'Published' }),
    enabled: open && !!siteId,
  });

  const blogs = (blogsData?.data ?? []).filter((b) => !alreadyPinned.has(b.content_id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('federation.featured.selectPost')}</DialogTitle>
      <DialogContent dividers>
        {isLoading && <Typography variant="body2" color="text.secondary">Loading...</Typography>}
        {!isLoading && blogs.length === 0 && (
          <Typography variant="body2" color="text.secondary">{t('federation.featured.empty')}</Typography>
        )}
        <List disablePadding>
          {blogs.map((blog) => (
            <ListItemButton key={blog.id} onClick={() => onSelect(blog.content_id)}>
              <ListItemText primary={blog.slug ?? blog.id} secondary={blog.author} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

interface PinnedPostsCardProps {
  siteId: string;
  featuredPosts: FederationFeaturedPost[];
}

export default function PinnedPostsCard({ siteId, featuredPosts }: PinnedPostsCardProps) {
  const { t } = useTranslation();
  const { pinPostMutation, unpinPostMutation } = useFederationMutations(siteId);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const maxReached = featuredPosts.length >= 3;

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PushPinIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.secondary">
                {t('federation.featured.title')}
              </Typography>
            </Stack>
            <Tooltip title={maxReached ? t('federation.featured.maxReached') : t('federation.featured.pin')}>
              <span>
                <IconButton size="small" onClick={() => setPinDialogOpen(true)} disabled={maxReached}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
            {t('federation.featured.description')}
          </Typography>
          {featuredPosts.length === 0 && (
            <Typography variant="body2" color="text.disabled" fontStyle="italic">
              {t('federation.featured.empty')}
            </Typography>
          )}
          {featuredPosts.map((post) => (
            <Stack key={post.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {post.title ?? post.slug ?? post.content_id}
              </Typography>
              <Tooltip title={t('federation.featured.unpin')}>
                <IconButton size="small" onClick={() => unpinPostMutation.mutate(post.content_id)}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </CardContent>
      </Card>

      <PinPostDialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        siteId={siteId}
        alreadyPinned={new Set(featuredPosts.map((p) => p.content_id))}
        onSelect={(contentId) => {
          pinPostMutation.mutate(contentId);
          setPinDialogOpen(false);
        }}
      />
    </>
  );
}
