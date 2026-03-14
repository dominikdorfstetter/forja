import { Card, CardContent, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import type { FederationSettings } from '@/types/api';

interface ModerationCardProps {
  settings: FederationSettings;
  siteId: string;
}

export default function ModerationCard({ settings, siteId }: ModerationCardProps) {
  const { t } = useTranslation();
  const { updateSettings } = useFederationMutations(siteId);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('federation.settings.moderation')}
        </Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('federation.settings.mode')}</InputLabel>
          <Select
            value={settings.moderation_mode ?? 'queue_all'}
            label={t('federation.settings.mode')}
            onChange={(e) => updateSettings.mutate({ moderation_mode: e.target.value })}
          >
            <MenuItem value="queue_all">{t('federation.settings.modeQueueAll')}</MenuItem>
            <MenuItem value="auto_approve">{t('federation.settings.modeAutoApprove')}</MenuItem>
            <MenuItem value="followers_only">{t('federation.settings.modeFollowersOnly')}</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={settings.auto_publish ?? true}
              onChange={(e) => updateSettings.mutate({ auto_publish: e.target.checked })}
            />
          }
          label={t('federation.settings.autoPublish')}
        />
      </CardContent>
    </Card>
  );
}
