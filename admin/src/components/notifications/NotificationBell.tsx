import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { NotificationResponse, NotificationType } from '@/types/api';

const POLL_INTERVAL = 30_000;

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'content_submitted': return <RateReviewIcon fontSize="small" color="info" />;
    case 'content_approved': return <CheckCircleIcon fontSize="small" color="success" />;
    case 'changes_requested': return <EditIcon fontSize="small" color="warning" />;
  }
}

function typeLabel(type: NotificationType, t: (key: string) => string): string {
  switch (type) {
    case 'content_submitted': return t('notifications.types.submitted');
    case 'content_approved': return t('notifications.types.approved');
    case 'changes_requested': return t('notifications.types.changesRequested');
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return '<1m';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread', selectedSiteId],
    queryFn: () => apiService.getUnreadCount(selectedSiteId!),
    enabled: !!selectedSiteId,
    refetchInterval: POLL_INTERVAL,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', selectedSiteId],
    queryFn: () => apiService.getNotifications(selectedSiteId!, { per_page: 20 }),
    enabled: !!selectedSiteId && !!anchorEl,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiService.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['notifications', selectedSiteId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiService.markAllNotificationsRead(selectedSiteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['notifications', selectedSiteId] });
    },
  });

  const handleClick = useCallback((notification: NotificationResponse) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    setAnchorEl(null);
    const basePath = notification.entity_type === 'blog' ? '/blogs' : '/pages';
    navigate(`${basePath}/${notification.entity_id}`);
  }, [markReadMutation, navigate]);

  const unreadCount = unreadData?.unread_count ?? 0;
  const notifications = notificationsData?.data ?? [];

  if (!selectedSiteId) return null;

  return (
    <>
      <Tooltip title={t('notifications.bell')}>
        <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 480 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>{t('notifications.title')}</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('notifications.empty')}</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', maxHeight: 380 }}>
            {notifications.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => handleClick(n)}
                sx={{
                  py: 1.5,
                  px: 2,
                  bgcolor: n.is_read ? 'transparent' : 'action.hover',
                }}
              >
                <Box sx={{ mr: 1.5, mt: 0.5 }}>{typeIcon(n.notification_type)}</Box>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 600, flex: 1 }} noWrap>
                        {n.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {timeAgo(n.created_at)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={typeLabel(n.notification_type, t)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      {n.message && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }} noWrap>
                          {n.message}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={() => {
              setAnchorEl(null);
              navigate('/notifications');
            }}
          >
            {t('notifications.viewAll')}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
