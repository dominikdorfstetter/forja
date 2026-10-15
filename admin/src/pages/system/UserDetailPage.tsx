import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Box, Paper, Typography, Avatar, Chip, Grid, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClerkUser, getUserAuditLogs } from '@/services/clerkUsers';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { queryKeys } from '@/lib/queryKeys';
import type { ClerkUser, PaginatedAuditLogs } from '@/types/api';

const MODERATION_CHIP_COLOR: Record<string, 'error' | 'warning'> = {
  banned: 'error',
  suspended: 'warning',
};

/** Clerk timestamps are unix seconds. */
const formatUnixDate = (seconds: number | null | undefined): string =>
  seconds ? new Date(seconds * 1000).toLocaleDateString() : '—';

function UserProfileCard({ user }: { user: ClerkUser }) {
  const { t } = useTranslation();
  return (
    <Paper sx={{ p: 3, textAlign: 'center' }} data-testid="user-detail.profile">
      <Avatar
        src={user.image_url ?? undefined}
        alt={user.name}
        sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}
      />
      <Typography variant="h6">{user.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {user.email}
      </Typography>
      <Chip
        label={t(`system.users.status.${user.moderation_status}`)}
        color={MODERATION_CHIP_COLOR[user.moderation_status] ?? 'success'}
        size="small"
        sx={{ mb: 1 }}
      />
      {user.moderation_reason && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic', display: "block" }}>
          {t('system.users.moderationReason')}: {user.moderation_reason}
        </Typography>
      )}
      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {t('system.users.joined')}: {formatUnixDate(user.created_at)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {t('system.users.lastSignIn')}: {formatUnixDate(user.last_sign_in_at)}
      </Typography>
    </Paper>
  );
}

function UserActivityTable({ entries }: { entries: PaginatedAuditLogs['data'] | undefined }) {
  const { t } = useTranslation();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('audit.action')}</TableCell>
            <TableCell>{t('audit.entityType')}</TableCell>
            <TableCell>{t('audit.ipAddress')}</TableCell>
            <TableCell>{t('audit.timestamp')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries?.map((entry) => (
            <TableRow key={entry.id} data-testid="user-detail.activity-row">
              <TableCell>
                <Chip label={entry.action} size="small" variant="outlined" />
              </TableCell>
              <TableCell>{entry.entity_type}</TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                  {entry.ip_address || '—'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">
                  {new Date(entry.created_at).toLocaleString()}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {(!entries || entries.length === 0) && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="body2" color="text.secondary">
                  {t('system.users.noActivity')}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

interface UserActivityCardProps {
  auditData: PaginatedAuditLogs | undefined;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function UserActivityCard({
  auditData,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: UserActivityCardProps) {
  const { t } = useTranslation();
  return (
    <Paper sx={{ p: 3 }} data-testid="user-detail.activity">
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('system.users.activity')}
      </Typography>

      {loading ? (
        <LoadingState label={t('system.users.loadingActivity')} />
      ) : (
        <>
          <UserActivityTable entries={auditData?.data} />
          {auditData && (
            <TablePagination
              component="div"
              count={auditData.meta?.total_items ?? 0}
              page={page}
              onPageChange={(_, p) => onPageChange(p)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              rowsPerPageOptions={[10, 20, 50]}
            />
          )}
        </>
      )}
    </Paper>
  );
}

export default function UserDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(20);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: queryKeys.clerkUser(id),
    queryFn: () => getClerkUser(id!),
    enabled: !!id,
  });

  const { data: auditData, isLoading: isAuditLoading } = useQuery({
    queryKey: queryKeys.userAudit(id, auditPage, auditPageSize),
    queryFn: () =>
      getUserAuditLogs(id!, {
        page: auditPage + 1,
        page_size: auditPageSize,
      }),
    enabled: !!id,
  });

  if (isUserLoading) {
    return <LoadingState label={t('system.users.loading')} />;
  }

  if (!user) {
    return <Typography>{t('system.users.notFound')}</Typography>;
  }

  return (
    <Box data-testid="user-detail.page">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/system/users')} data-testid="user-detail.back">
          <ArrowBackIcon />
        </IconButton>
        <PageHeader icon="person" title={user.name || t('system.users.unknownUser')} subtitle={user.email || ''} />
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <UserProfileCard user={user} />
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <UserActivityCard
            auditData={auditData}
            loading={isAuditLoading}
            page={auditPage}
            pageSize={auditPageSize}
            onPageChange={setAuditPage}
            onPageSizeChange={(size) => {
              setAuditPageSize(size);
              setAuditPage(0);
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
