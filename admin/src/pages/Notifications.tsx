import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Typography,
  Tooltip,
} from '@mui/material';
import { formatDistanceToNow, format } from 'date-fns';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import type { NotificationResponse, NotificationType } from '@/types/api';

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

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', selectedSiteId, page, rowsPerPage],
    queryFn: () => apiService.getNotifications(selectedSiteId!, { page: page + 1, per_page: rowsPerPage }),
    enabled: !!selectedSiteId,
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

  const handleRowClick = useCallback((notification: NotificationResponse) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    const basePath = notification.entity_type === 'blog' ? '/blogs' : '/pages';
    navigate(`${basePath}/${notification.entity_id}`);
  }, [markReadMutation, navigate]);

  if (!selectedSiteId) {
    return (
      <Box>
        <PageHeader title={t('notifications.pageTitle')} subtitle={t('notifications.pageSubtitle')} />
        <Alert severity="info">{t('notifications.noSite')}</Alert>
      </Box>
    );
  }

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Box>
      <PageHeader
        title={t('notifications.pageTitle')}
        subtitle={t('notifications.pageSubtitle')}
        breadcrumbs={[{ label: t('notifications.pageTitle') }]}
        action={
          unreadCount > 0 ? {
            label: t('notifications.markAllRead'),
            icon: <DoneAllIcon />,
            onClick: () => markAllReadMutation.mutate(),
          } : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : notifications.length === 0 ? (
        <EmptyState title={t('notifications.empty')} />
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('notifications.columns.type')}</TableCell>
                  <TableCell>{t('notifications.columns.title')}</TableCell>
                  <TableCell>{t('notifications.columns.message')}</TableCell>
                  <TableCell>{t('notifications.columns.time')}</TableCell>
                  <TableCell>{t('notifications.columns.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notifications.map((n) => {
                  const fullDate = format(new Date(n.created_at), 'PPpp');
                  const relativeDate = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });

                  return (
                    <TableRow
                      key={n.id}
                      hover
                      onClick={() => handleRowClick(n)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: n.is_read ? 'transparent' : 'action.hover',
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {typeIcon(n.notification_type)}
                          <Chip
                            label={typeLabel(n.notification_type, t)}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.75rem' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 600 }}>
                          {n.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                          {n.message || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={fullDate} arrow>
                          <Typography variant="body2" color="text.secondary">
                            {relativeDate}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={n.is_read ? t('notifications.read') : t('notifications.unread')}
                          size="small"
                          color={n.is_read ? 'default' : 'primary'}
                          variant={n.is_read ? 'outlined' : 'filled'}
                          sx={{ height: 22, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.meta?.total_items || 0}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      )}
    </Box>
  );
}
