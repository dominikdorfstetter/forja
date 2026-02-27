import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label }: LoadingStateProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('shared.loadingState.defaultLabel');
  return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
      <CircularProgress sx={{ mb: 2 }} />
      {displayLabel && <Typography color="text.secondary">{displayLabel}</Typography>}
    </Box>
  );
}
