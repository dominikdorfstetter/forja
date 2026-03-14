import { Box, Button, Card, CardContent, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { FederationInstanceHealth } from '@/types/api';

interface InstanceHealthCardProps {
  healthData: FederationInstanceHealth[];
  onBlockInstance?: (domain: string) => void;
}

export default function InstanceHealthCard({ healthData, onBlockInstance }: InstanceHealthCardProps) {
  const { t } = useTranslation();

  const unhealthyInstances = healthData.filter((h) => h.failed + h.dead > 0);

  if (unhealthyInstances.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          {t('federation.health.title')}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
          {t('federation.health.description')}
        </Typography>

        <Stack spacing={1.5}>
          {unhealthyInstances.slice(0, 5).map((instance) => {
            const successRate = instance.total > 0
              ? Math.round((instance.successful / instance.total) * 100)
              : 0;
            const isHighFailure = (instance.failed + instance.dead) > instance.total * 0.5;

            return (
              <Box key={instance.instance_domain}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.85rem" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {instance.instance_domain}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color={successRate >= 80 ? 'success.main' : successRate >= 50 ? 'warning.main' : 'error.main'}>
                      {successRate}%
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {instance.failed} {t('federation.health.failed').toLowerCase()}
                      {instance.dead > 0 && `, ${instance.dead} ${t('federation.health.dead').toLowerCase()}`}
                    </Typography>
                    {isHighFailure && onBlockInstance && (
                      <Tooltip title={t('federation.health.blockSuggestion')}>
                        <Button
                          size="small"
                          color="error"
                          sx={{ minWidth: 'auto', p: 0.5 }}
                          onClick={() => onBlockInstance(instance.instance_domain)}
                        >
                          <BlockIcon sx={{ fontSize: 16 }} />
                        </Button>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={successRate}
                  color={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'error'}
                  sx={{ height: 4, borderRadius: 2 }}
                />
                {instance.last_attempt && (
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
                    {t('federation.health.lastAttempt')}: {format(new Date(instance.last_attempt), 'PPp')}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
