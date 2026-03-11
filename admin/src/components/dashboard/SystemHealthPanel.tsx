import {
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';

interface HealthService {
  name: string;
  status: string;
  latency_ms?: number | null;
}

interface HealthStorage {
  name: string;
  status: string;
  latency_ms?: number | null;
}

interface HealthData {
  status: string;
  version?: string;
  services: HealthService[];
  storage?: HealthStorage;
}

interface SystemHealthPanelProps {
  healthData: HealthData;
  healthLoading: boolean;
  isMaster: boolean;
}

export default function SystemHealthPanel({ healthData, healthLoading, isMaster }: SystemHealthPanelProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <DnsIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" component="h2" fontWeight={600}>
          {t('dashboard.systemHealth')}
        </Typography>
        {healthLoading && <LinearProgress sx={{ flex: 1, ml: 2 }} />}
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {isMaster && healthData.services.map((svc) => {
          const icon = svc.status === 'up'
            ? <CheckCircleIcon />
            : svc.status === 'disabled'
              ? <InfoOutlinedIcon />
              : <ErrorIcon />;
          const color = svc.status === 'up'
            ? 'success' as const
            : svc.status === 'disabled'
              ? 'default' as const
              : 'error' as const;
          const suffix = svc.status === 'disabled'
            ? ' (disabled)'
            : svc.latency_ms != null
              ? ` (${svc.latency_ms}ms)`
              : '';
          return (
            <Chip
              key={svc.name}
              icon={icon}
              label={`${svc.name}${suffix}`}
              color={color}
              variant="outlined"
              size="small"
            />
          );
        })}
        {isMaster && healthData.storage && (() => {
          const s = healthData.storage;
          const icon = s.status === 'up' ? <CheckCircleIcon /> : <ErrorIcon />;
          const color = s.status === 'up' ? 'success' as const : 'error' as const;
          const suffix = s.latency_ms != null ? ` (${s.latency_ms}ms)` : '';
          return (
            <Chip
              key={s.name}
              icon={icon}
              label={`${s.name}${suffix}`}
              color={color}
              variant="outlined"
              size="small"
            />
          );
        })()}
        <Chip
          icon={healthData.status === 'healthy' ? <CheckCircleIcon /> : <ErrorIcon />}
          label={t('dashboard.overall', { status: healthData.status })}
          color={healthData.status === 'healthy' ? 'success' : 'warning'}
          size="small"
        />
        {healthData.version && (
          <Chip
            label={`v${healthData.version}`}
            size="small"
            variant="outlined"
          />
        )}
      </Stack>
    </Paper>
  );
}
