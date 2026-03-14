import { Avatar, Box, Card, CardContent, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import type { FederationSettings, FederationStats } from '@/types/api';

interface ProfileCardProps {
  settings: FederationSettings;
  stats: FederationStats | undefined;
}

export default function ProfileCard({ settings, stats }: ProfileCardProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const handleCopyHandle = () => {
    if (settings.webfinger_address) {
      navigator.clipboard.writeText(`@${settings.webfinger_address}`);
      enqueueSnackbar(t('federation.handle.copied'), { variant: 'success' });
    }
  };

  if (!settings.webfinger_address) return null;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar
            src={settings.avatar_url || undefined}
            sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}
          >
            <HubIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                fontFamily="monospace"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                @{settings.webfinger_address}
              </Typography>
              <Tooltip title={t('federation.handle.copy')}>
                <IconButton size="small" onClick={handleCopyHandle} aria-label={t('federation.handle.copy')}>
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('federation.handle.description')}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={0}
          sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}
        >
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>{stats?.follower_count ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">{t('federation.stats.followers')}</Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>{stats?.outbound_activities ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">{t('federation.stats.postsSyndicated')}</Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>{stats?.inbound_activities ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">{t('federation.stats.inbound')}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
