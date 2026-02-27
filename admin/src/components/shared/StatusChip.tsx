import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ApiKeyStatus, ContentStatus, ApiKeyPermission } from '@/types/api';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info' | 'primary' | 'secondary'> = {
  Active: 'success',
  Blocked: 'warning',
  Expired: 'default',
  Revoked: 'error',
  Draft: 'default',
  InReview: 'secondary',
  Scheduled: 'info',
  Published: 'success',
  Archived: 'warning',
  Master: 'error',
  Admin: 'warning',
  Write: 'info',
  Read: 'success',
};

const labelKeys: Record<string, string> = {
  Active: 'common.status.active',
  Blocked: 'common.status.blocked',
  Expired: 'common.status.expired',
  Revoked: 'common.status.revoked',
  Draft: 'common.status.draft',
  InReview: 'common.status.inReview',
  Scheduled: 'common.status.scheduled',
  Published: 'common.status.published',
  Archived: 'common.status.archived',
};

interface StatusChipProps {
  value: ApiKeyStatus | ContentStatus | ApiKeyPermission | string;
  size?: 'small' | 'medium';
}

export default function StatusChip({ value, size = 'small' }: StatusChipProps) {
  const { t } = useTranslation();
  const label = labelKeys[value] ? t(labelKeys[value], value) : value;

  return (
    <Chip
      label={label}
      size={size}
      color={statusColors[value] || 'default'}
      variant="outlined"
    />
  );
}
