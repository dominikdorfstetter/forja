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
import { useSiteContext } from '@/store/SiteContext';
import { useFederationSettings } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useState } from 'react';

interface FederationSettingsProps {
  embedded?: boolean;
}

export default function FederationSettingsPage({ embedded }: FederationSettingsProps = {}) {
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
        {!embedded && <PageHeader title="Federation Settings" subtitle="Configure ActivityPub federation" />}
        <EmptyState icon={<SettingsIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to manage settings." />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-settings.page">
        {!embedded && <PageHeader title="Federation Settings" subtitle="Configure ActivityPub federation" />}
        <LoadingState label="Loading settings..." />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-settings.page" sx={{ maxWidth: 800, mx: embedded ? undefined : 'auto', p: embedded ? 0 : 3 }}>
      {!embedded && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <HubIcon />
          <Typography variant="h5">Federation Settings</Typography>
        </Stack>
      )}

      <Paper sx={{ p: 3 }} elevation={embedded ? 0 : 1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {settings?.actorHandle && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Fediverse Handle</Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                {settings.actorHandle}
              </Typography>
            </Box>
          )}

          <Card variant="outlined">
            <CardHeader title="Signature Algorithm" />
            <CardContent>
              <FormControl fullWidth size="small">
                <InputLabel>Algorithm</InputLabel>
                <Select
                  value={settings?.signatureAlgorithm ?? 'rsa-sha256'}
                  label="Algorithm"
                  onChange={(e) => updateSettings.mutate({ signatureAlgorithm: e.target.value })}
                >
                  <MenuItem value="rsa-sha256">RSA-SHA256</MenuItem>
                  <MenuItem value="ed25519">Ed25519</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Moderation" />
            <CardContent>
              <FormControl fullWidth size="small">
                <InputLabel>Mode</InputLabel>
                <Select
                  value={settings?.moderationMode ?? 'queue_all'}
                  label="Mode"
                  onChange={(e) => updateSettings.mutate({ moderationMode: e.target.value })}
                >
                  <MenuItem value="queue_all">Queue All (manual review)</MenuItem>
                  <MenuItem value="auto_approve">Auto Approve</MenuItem>
                  <MenuItem value="followers_only">Followers Only</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                sx={{ mt: 2 }}
                control={
                  <Switch
                    checked={settings?.autoPublish ?? true}
                    onChange={(e) => updateSettings.mutate({ autoPublish: e.target.checked })}
                  />
                }
                label="Auto-publish new posts to federation"
              />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Key Management" />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Rotating keys will invalidate existing HTTP signatures. Remote servers will need to re-fetch your public key.
              </Typography>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<VpnKeyIcon />}
                onClick={() => setRotateConfirmOpen(true)}
                disabled={rotateKeysMutation.isPending}
              >
                Rotate Keys
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      <ConfirmDialog
        open={rotateConfirmOpen}
        title="Rotate Signing Keys"
        message="This will generate new signing keys. Remote servers will need to re-fetch your public key, which may temporarily disrupt federation. Continue?"
        confirmLabel="Rotate Keys"
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
