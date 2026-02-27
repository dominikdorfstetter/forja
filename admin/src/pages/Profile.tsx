import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Chip,
  Button,
  Grid,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogContent,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import { UserProfile } from '@clerk/clerk-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const PERMISSION_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  Master: 'error',
  Admin: 'warning',
  Write: 'info',
  Read: 'success',
};

export default function ProfilePage() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { logout, permission, userFullName, userImageUrl, userEmail } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clerkProfileOpen, setClerkProfileOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiService.getProfile(),
  });

  const exportMutation = useMutation({
    mutationFn: () => apiService.exportUserData(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      enqueueSnackbar(t('profile.exportSuccess'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('profile.exportError'), { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiService.deleteAccount(),
    onSuccess: async () => {
      enqueueSnackbar(t('profile.deleteSuccess'), { variant: 'success' });
      setDeleteOpen(false);
      await logout();
      navigate('/login');
    },
    onError: () => {
      enqueueSnackbar(t('profile.deleteError'), { variant: 'error' });
    },
  });

  if (isLoading) return <LoadingState />;

  const isClerkUser = profile?.auth_method === 'clerk_jwt';

  return (
    <Box>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      <Grid container spacing={3}>
        {/* Account Info Card */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('profile.accountInfo')}
            </Typography>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 3 }}>
              <Avatar
                src={profile?.image_url || userImageUrl || undefined}
                alt={profile?.name || userFullName || 'User'}
                sx={{ width: 80, height: 80, fontSize: '2rem' }}
              >
                {(profile?.name || userFullName || 'U').charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">
                  {profile?.name || userFullName || t('profile.unknownUser')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {profile?.email || userEmail || ''}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip
                    label={profile?.role || permission || 'read'}
                    color={PERMISSION_COLORS[permission || 'Read'] || 'default'}
                    size="small"
                  />
                  <Chip
                    label={isClerkUser ? 'Clerk SSO' : 'API Key'}
                    variant="outlined"
                    size="small"
                  />
                </Stack>
              </Box>
            </Stack>
            {isClerkUser && (
              <Button
                variant="outlined"
                startIcon={<ManageAccountsIcon />}
                onClick={() => setClerkProfileOpen(true)}
                fullWidth
              >
                {t('profile.manageAccount')}
              </Button>
            )}
          </Paper>
        </Grid>

        {/* Security & Sessions Card */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              {t('profile.security')}
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('profile.authMethod')}
                </Typography>
                <Typography variant="body1">
                  {isClerkUser ? 'Clerk JWT (SSO)' : 'API Key'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('profile.permissionLevel')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShieldIcon fontSize="small" color={PERMISSION_COLORS[permission || 'Read'] || 'inherit'} />
                  <Typography variant="body1">{permission}</Typography>
                </Stack>
              </Box>
              {profile?.site_id && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.siteScope')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {profile.site_id}
                  </Typography>
                </Box>
              )}
              {profile?.created_at && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.memberSince')}
                  </Typography>
                  <Typography variant="body1">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
              {profile?.last_sign_in_at && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.lastSignIn')}
                  </Typography>
                  <Typography variant="body1">
                    {new Date(profile.last_sign_in_at).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Data & Privacy Card */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('profile.dataPrivacy')}
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              {t('profile.dataPrivacyInfo')}
            </Alert>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={exportMutation.isPending ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? t('profile.exporting') : t('profile.exportData')}
              </Button>
              {isClerkUser && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteForeverIcon />}
                  onClick={() => setDeleteOpen(true)}
                >
                  {t('profile.deleteAccount')}
                </Button>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Clerk UserProfile Dialog */}
      <Dialog
        open={clerkProfileOpen}
        onClose={() => setClerkProfileOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <UserProfile routing="virtual" />
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title={t('profile.deleteAccountTitle')}
        message={t('profile.deleteAccountMessage')}
        confirmLabel={t('profile.deleteAccountConfirm')}
        confirmColor="error"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
