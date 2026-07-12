import { Box, Chip, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { getLegalVersions } from '@/services/legal';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import StatusChip from '@/components/shared/StatusChip';
import type { LegalVersionResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface LegalVersionPanelProps {
  documentId: string;
  currentVersion: number;
}

export default function LegalVersionPanel({ documentId, currentVersion }: LegalVersionPanelProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const navigate = useNavigate();

  const { data: versions, isLoading } = useQuery({
    queryKey: queryKeys.legalVersions(documentId),
    queryFn: () => getLegalVersions(documentId),
    enabled: !!documentId,
  });

  const hasMultiple = (versions?.length ?? 0) > 1;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: hasMultiple ? 0.5 : 1 }}>
        {t('legalDetail.versions.title')}
      </Typography>
      {hasMultiple && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('legalDetail.versions.rollbackHint')}
        </Typography>
      )}
      {isLoading ? (
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      ) : !versions?.length ? (
        <Typography variant="body2" color="text.secondary">
          {t('legalDetail.versions.noVersions')}
        </Typography>
      ) : (
        <List dense disablePadding data-testid="legal-version-list">
          {versions.map((v: LegalVersionResponse) => {
            const isLive = v.status === 'Published';
            return (
              <ListItemButton
                key={v.id}
                selected={v.version === currentVersion}
                onClick={() => navigate(`/legal/${v.id}`)}
                sx={{ borderRadius: 1, mb: 0.5 }}
                data-testid={`legal-version-item.v${v.version}`}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={`v${v.version}`} size="small" variant="outlined" />
                      <StatusChip value={v.status} size="small" />
                      {isLive && (
                        <Chip
                          label={t('legalDetail.versions.live')}
                          size="small"
                          color="success"
                          data-testid={`legal-version-live.v${v.version}`}
                        />
                      )}
                    </Box>
                  }
                  secondary={fmt(v.created_at, 'PPp')}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}
