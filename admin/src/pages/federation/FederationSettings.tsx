import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HubIcon from '@mui/icons-material/Hub';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationSettings } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useState } from 'react';

interface FederationSettingsProps {
  embedded?: boolean;
}

export default function FederationSettingsPage({ embedded }: FederationSettingsProps = {}) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { data: settings, isLoading } = useFederationSettings(selectedSiteId);
  const {
    updateSettings,
    rotateKeysMutation,
  } = useFederationMutations(selectedSiteId);

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-settings.page">
        <EmptyState icon={<SettingsIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.settings.noSite')} />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-settings.page">
        <LoadingState label={t('federation.settings.loading')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-settings.page" sx={{ maxWidth: 800, mx: embedded ? undefined : 'auto', p: embedded ? 0 : 3 }}>
      {!embedded && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <HubIcon />
          <Typography variant="h5">{t('federation.settings.title')}</Typography>
        </Stack>
      )}

      <Paper sx={{ p: 3 }} elevation={embedded ? 0 : 1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card variant="outlined">
            <CardHeader title={t('federation.settings.signatureAlgorithm')} />
            <CardContent>
              <FormControl fullWidth size="small">
                <InputLabel>{t('federation.settings.algorithm')}</InputLabel>
                <Select
                  value={settings?.signature_algorithm ?? 'rsa-sha256'}
                  label={t('federation.settings.algorithm')}
                  onChange={(e) => updateSettings.mutate({ signature_algorithm: e.target.value })}
                >
                  <MenuItem value="rsa-sha256">RSA-SHA256</MenuItem>
                  <MenuItem value="ed25519">Ed25519</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title={t('federation.settings.moderation')} />
            <CardContent>
              <FormControl fullWidth size="small">
                <InputLabel>{t('federation.settings.mode')}</InputLabel>
                <Select
                  value={settings?.moderation_mode ?? 'queue_all'}
                  label={t('federation.settings.mode')}
                  onChange={(e) => updateSettings.mutate({ moderation_mode: e.target.value })}
                >
                  <MenuItem value="queue_all">{t('federation.settings.modeQueueAll')}</MenuItem>
                  <MenuItem value="auto_approve">{t('federation.settings.modeAutoApprove')}</MenuItem>
                  <MenuItem value="followers_only">{t('federation.settings.modeFollowersOnly')}</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                sx={{ mt: 2 }}
                control={
                  <Switch
                    checked={settings?.auto_publish ?? true}
                    onChange={(e) => updateSettings.mutate({ auto_publish: e.target.checked })}
                  />
                }
                label={t('federation.settings.autoPublish')}
              />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title={t('federation.settings.keyManagement')} />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('federation.settings.keyRotateWarning')}
              </Typography>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<VpnKeyIcon />}
                onClick={() => setRotateConfirmOpen(true)}
                disabled={rotateKeysMutation.isPending}
              >
                {t('federation.settings.rotateKeys')}
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      <ConfirmDialog
        open={rotateConfirmOpen}
        title={t('federation.settings.rotateKeysConfirm')}
        message={t('federation.settings.rotateKeysMessage')}
        confirmLabel={t('federation.settings.rotateKeys')}
        confirmColor="warning"
        onConfirm={() => {
          rotateKeysMutation.mutate();
          setRotateConfirmOpen(false);
        }}
        onCancel={() => setRotateConfirmOpen(false)}
        loading={rotateKeysMutation.isPending}
      />
    </Box>
  );
}
