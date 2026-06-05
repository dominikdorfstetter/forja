import { Box, Chip, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { getLegalVersions } from '@/services/legal';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import StatusChip from '@/components/shared/StatusChip';
import type { LegalVersionResponse } from '@/types/api';

interface LegalVersionPanelProps {
  documentId: string;
  currentVersion: number;
}

export default function LegalVersionPanel({ documentId, currentVersion }: LegalVersionPanelProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const navigate = useNavigate();

  const { data: versions, isLoading } = useQuery({
    queryKey: ['legal-versions', documentId],
    queryFn: () => getLegalVersions(documentId),
    enabled: !!documentId,
  });

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('legalDetail.versions.title')}
      </Typography>
      {isLoading ? (
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      ) : !versions?.length ? (
        <Typography variant="body2" color="text.secondary">
          {t('legalDetail.versions.noVersions')}
        </Typography>
      ) : (
        <List dense disablePadding>
          {versions.map((v: LegalVersionResponse) => (
            <ListItemButton
              key={v.id}
              selected={v.version === currentVersion}
              onClick={() => navigate(`/legal/${v.id}`)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`v${v.version}`} size="small" variant="outlined" />
                    <StatusChip value={v.status} size="small" />
                  </Box>
                }
                secondary={fmt(v.created_at, 'PPp')}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
