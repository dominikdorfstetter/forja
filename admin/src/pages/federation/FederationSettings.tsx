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
  Switch,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationSettings } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useState } from 'react';

export default function FederationSettingsPage() {
  const { selectedSiteId } = useSiteContext();
  const { data: settings, isLoading } = useFederationSettings(selectedSiteId);
  const {
    enableFederation,
    disableFederation,
    updateSettings,
    rotateKeysMutation,
  } = useFederationMutations(selectedSiteId);

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-settings.page">
        <PageHeader title="Federation Settings" subtitle="Configure ActivityPub federation" />
        <EmptyState icon={<SettingsIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to manage settings." />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-settings.page">
        <PageHeader title="Federation Settings" subtitle="Configure ActivityPub federation" />
        <LoadingState label="Loading settings..." />
      </Box>
    );
  }

  const handleToggle = () => {
    if (settings?.enabled) {
      disableFederation.mutate();
    } else {
      enableFederation.mutate();
    }
  };

  return (
    <Box data-testid="federation-settings.page">
      <PageHeader title="Federation Settings" subtitle="Configure ActivityPub federation" />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 700 }}>
        <Paper sx={{ p: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings?.enabled ?? false}
                onChange={handleToggle}
                disabled={enableFederation.isPending || disableFederation.isPending}
              />
            }
            label="Enable Federation"
          />
          {settings?.actorHandle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontFamily: 'monospace' }}>
              {settings.actorHandle}
            </Typography>
          )}
        </Paper>

        {settings?.enabled && (
          <>
            <Card>
              <CardHeader title="Signature Algorithm" />
              <CardContent>
                <FormControl fullWidth size="small">
                  <InputLabel>Algorithm</InputLabel>
                  <Select
                    value={settings.signatureAlgorithm}
                    label="Algorithm"
                    onChange={(e) => updateSettings.mutate({ signatureAlgorithm: e.target.value })}
                  >
                    <MenuItem value="rsa-sha256">RSA-SHA256</MenuItem>
                    <MenuItem value="ed25519">Ed25519</MenuItem>
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Moderation" />
              <CardContent>
                <FormControl fullWidth size="small">
                  <InputLabel>Mode</InputLabel>
                  <Select
                    value={settings.moderationMode}
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
                      checked={settings.autoPublish}
                      onChange={(e) => updateSettings.mutate({ autoPublish: e.target.checked })}
                    />
                  }
                  label="Auto-publish new posts to federation"
                />
              </CardContent>
            </Card>

            <Card>
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
          </>
        )}
      </Box>

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
