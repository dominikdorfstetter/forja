import type { ReactNode } from 'react';
import { Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import { useTranslation } from 'react-i18next';
import type { ProfileResponse } from '@/types/api';
import { permissionColor, type ProfileIdentity } from './profileUtils';

interface AccountInfoCardProps {
  identity: ProfileIdentity;
  permission: string | null;
  isClerkUser: boolean;
  onManageAccount: () => void;
}

export function AccountInfoCard({ identity, permission, isClerkUser, onManageAccount }: AccountInfoCardProps) {
  const { t } = useTranslation();
  const { displayName } = identity;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('profile.accountInfo')}
      </Typography>
      <Stack direction="row" spacing={3} sx={{ mb: 3, alignItems: "center" }}>
        <Avatar
          src={identity.imageUrl}
          alt={displayName ?? 'User'}
          sx={{ width: 80, height: 80, fontSize: '2rem' }}
        >
          {(displayName ?? 'U').charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h6">
            {displayName ?? t('profile.unknownUser')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {identity.email}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              label={identity.role}
              color={permissionColor(permission) || 'default'}
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
          onClick={onManageAccount}
          fullWidth
        >
          {t('profile.manageAccount')}
        </Button>
      )}
    </Paper>
  );
}

/** Caption + value pair in the security card. */
function SecurityField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Box>
  );
}

interface SecurityCardProps {
  profile: ProfileResponse | undefined;
  permission: string | null;
  isClerkUser: boolean;
}

export function SecurityCard({ profile, permission, isClerkUser }: SecurityCardProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        {t('profile.security')}
      </Typography>
      <Stack spacing={2}>
        <SecurityField label={t('profile.authMethod')}>
          <Typography variant="body1">
            {isClerkUser ? 'Clerk JWT (SSO)' : 'API Key'}
          </Typography>
        </SecurityField>
        <SecurityField label={t('profile.permissionLevel')}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <ShieldIcon fontSize="small" color={permissionColor(permission) || 'inherit'} />
            <Typography variant="body1">{permission}</Typography>
          </Stack>
        </SecurityField>
        {profile?.site_id && (
          <SecurityField label={t('profile.siteScope')}>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {profile.site_id}
            </Typography>
          </SecurityField>
        )}
        {profile?.created_at && (
          <SecurityField label={t('profile.memberSince')}>
            <Typography variant="body1">
              {new Date(profile.created_at).toLocaleDateString()}
            </Typography>
          </SecurityField>
        )}
        {profile?.last_sign_in_at && (
          <SecurityField label={t('profile.lastSignIn')}>
            <Typography variant="body1">
              {new Date(profile.last_sign_in_at).toLocaleString()}
            </Typography>
          </SecurityField>
        )}
      </Stack>
    </Paper>
  );
}
