import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from '@/services/notifications';
import { useSiteContext } from '@/store/SiteContext';
import { M3Button, M3IconButton } from '@/components/design-system';
import { m3MenuPaperSx } from '@/components/layout/m3MenuSx';
import type { NotificationResponse, NotificationType } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

const POLL_INTERVAL = 30_000;

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'content_submitted': return <RateReviewIcon fontSize="small" color="info" />;
    case 'content_approved': return <CheckCircleIcon fontSize="small" color="success" />;
    case 'changes_requested': return <EditIcon fontSize="small" color="warning" />;
    default: return <InfoOutlinedIcon fontSize="small" color="action" />;
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
    queryKey: queryKeys.notificationsUnread(selectedSiteId),
    queryFn: () => getUnreadCount(selectedSiteId!),
    enabled: !!selectedSiteId,
    refetchInterval: POLL_INTERVAL,
  });

  const { data: notificationsData } = useQuery({
    queryKey: queryKeys.notifications(selectedSiteId),
    queryFn: () => getNotifications(selectedSiteId!, { page_size: 20 }),
    enabled: !!selectedSiteId && !!anchorEl,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsUnread(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(selectedSiteId) });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(selectedSiteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsUnread(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(selectedSiteId) });
    },
  });

  const handleClick = useCallback((notification: NotificationResponse) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    setAnchorEl(null);
    if (notification.entity_type === 'blog') {
      navigate(`/blogs/${notification.entity_id}`);
    } else if (notification.entity_type === 'page') {
      navigate(`/pages/${notification.entity_id}`);
    }
    // For other entity types (system, site, etc.), just close — no navigation
  }, [markReadMutation, navigate]);

  const unreadCount = unreadData?.unread_count ?? 0;
  const notifications = notificationsData?.data ?? [];

  if (!selectedSiteId) return null;

  return (
    <>
      <Badge
        badgeContent={unreadCount}
        max={99}
        overlap="circular"
        sx={{
          '& .MuiBadge-badge': {
            bgcolor: 'var(--err)',
            color: 'var(--primary-c)',
            fontWeight: 700,
            right: 6,
            top: 6,
          },
        }}
      >
        <M3IconButton
          name="notifications"
          size={40}
          tooltip={unreadCount > 0 ? t('notifications.bellWithCount', { count: unreadCount }) : t('notifications.bell')}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          data-testid="notifications-icon"
        />
      </Badge>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { ...m3MenuPaperSx, width: 380, maxHeight: 480 },
            role: 'dialog',
            'aria-label': t('notifications.title'),
          },
        }}
        data-testid="notifications.popover"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Typography
            component="div"
            sx={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--on-surface)',
              fontVariationSettings: '"wght" 700, "opsz" 15',
            }}
          >
            {t('notifications.title')}
          </Typography>
          {unreadCount > 0 && (
            <M3Button
              size="sm"
              variant="text"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="notifications.btn.mark-all-read"
            >
              {t('notifications.markAllRead')}
            </M3Button>
          )}
        </Box>
        <Divider sx={{ borderColor: 'var(--outline-variant)' }} />
        {notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'var(--on-surface-variant)' }}>
              {t('notifications.empty')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', maxHeight: 380, py: 0.5 }}>
            {notifications.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => handleClick(n)}
                sx={{
                  py: 1.25,
                  px: 2,
                  mx: 0.5,
                  my: 0.25,
                  borderRadius: '10px',
                  bgcolor: n.is_read
                    ? 'transparent'
                    : 'color-mix(in srgb, var(--primary) 10%, transparent)',
                  '&:hover': {
                    bgcolor: n.is_read
                      ? 'var(--surface-container-highest)'
                      : 'color-mix(in srgb, var(--primary) 16%, transparent)',
                  },
                }}
              >
                <Box sx={{ mr: 1.5, mt: 0.25 }}>{typeIcon(n.notification_type)}</Box>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 13.5,
                          fontWeight: n.is_read ? 500 : 700,
                          color: 'var(--on-surface)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.title}
                      </Typography>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 11,
                          color: 'var(--on-surface-variant)',
                          flexShrink: 0,
                          fontVariationSettings: '"wght" 500, "opsz" 11',
                        }}
                      >
                        {timeAgo(n.created_at)}
                      </Typography>
                    </Box>
                  }
                  secondary={n.message && (
                    <Typography
                      component="span"
                      sx={{
                        display: 'block',
                        mt: 0.25,
                        fontSize: 12,
                        color: 'var(--on-surface-variant)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.message}
                    </Typography>
                  )}
                  slotProps={{
                    primary: { component: 'div' },
                    secondary: { component: 'div' }
                  }} />
              </ListItemButton>
            ))}
          </List>
        )}
        <Divider sx={{ borderColor: 'var(--outline-variant)' }} />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <M3Button
            size="sm"
            variant="text"
            onClick={() => {
              setAnchorEl(null);
              navigate('/notifications');
            }}
            data-testid="notifications.btn.view-all"
          >
            {t('notifications.viewAll')}
          </M3Button>
        </Box>
      </Popover>
    </>
  );
}
