import { useState } from 'react';
import { Box, Grid, Dialog, DialogContent } from '@mui/material';
import { UserProfile } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPiiInventory, getProfile } from '@/services/auth';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { queryKeys } from '@/lib/queryKeys';
import { AccountInfoCard, SecurityCard } from './profile/ProfileCards';
import DataPrivacyCard from './profile/DataPrivacyCard';
import { resolveProfileIdentity } from './profile/profileUtils';
import { useAccountDataActions } from './profile/useAccountDataActions';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { permission, userFullName, userImageUrl, userEmail } = useAuth();
  const [clerkProfileOpen, setClerkProfileOpen] = useState(false);
  const { exportMutation, deleteMutation, deleteOpen, setDeleteOpen } = useAccountDataActions();

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => getProfile(),
  });

  // GDPR Art. 15 transparency view — non-fatal: export/deletion stay
  // available if the inventory fails to load.
  const { data: piiInventory } = useQuery({
    queryKey: queryKeys.piiInventory(),
    queryFn: () => getPiiInventory(),
    retry: false,
  });

  if (isLoading) return <LoadingState />;

  const isClerkUser = profile?.auth_method === 'clerk_jwt';
  const identity = resolveProfileIdentity(profile, { permission, userFullName, userImageUrl, userEmail });

  return (
    <Box data-testid="profile.page">
      <PageHeader
        icon="account_circle"
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AccountInfoCard
            identity={identity}
            permission={permission}
            isClerkUser={isClerkUser}
            onManageAccount={() => setClerkProfileOpen(true)}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SecurityCard profile={profile} permission={permission} isClerkUser={isClerkUser} />
        </Grid>

        <Grid size={12}>
          <DataPrivacyCard
            piiInventory={piiInventory}
            isClerkUser={isClerkUser}
            exporting={exportMutation.isPending}
            onExport={() => exportMutation.mutate()}
            onDeleteAccount={() => setDeleteOpen(true)}
          />
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
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
