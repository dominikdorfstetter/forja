import {
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

interface ApiKey {
  id: string;
  name: string;
  permission: string;
  status: string;
  total_requests: number;
}

interface ApiKeysPanelProps {
  loading: boolean;
  apiKeys: ApiKey[];
}

export default function ApiKeysPanel({ loading, apiKeys }: ApiKeysPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" component="h2">{t('dashboard.stats.apiKeys')}</Typography>
        <Button size="small" onClick={() => navigate('/api-keys')}>
          {t('common.actions.manage')}
        </Button>
      </Stack>
      {loading ? (
        <Stack spacing={1}>
          {(['apikey-skel-0', 'apikey-skel-1', 'apikey-skel-2'] as const).map((id) => (
            <Skeleton key={id} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : (
        <List disablePadding>
          {apiKeys.slice(0, 5).map((key) => (
            <ListItem key={key.id} divider>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <KeyIcon fontSize="small" color={key.status === 'Active' ? 'primary' : 'disabled'} />
              </ListItemIcon>
              <ListItemText
                primary={key.name}
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center" component="span">
                    <Chip
                      label={key.permission}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Typography variant="caption" component="span">
                      {t('dashboard.requests', { count: key.total_requests.toLocaleString() } as Record<string, unknown>)}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
