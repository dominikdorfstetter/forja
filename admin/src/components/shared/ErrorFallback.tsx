import { useState } from 'react';
import { Box, Typography, Button, Collapse, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
  showDashboardLink?: boolean;
}

export default function ErrorFallback({ error, onReset, showDashboardLink }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Box sx={{ textAlign: 'center', mt: 8, px: 2 }}>
      <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h5" component="h1" gutterBottom>
        {t('shared.errorBoundary.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t('shared.errorBoundary.description')}
      </Typography>

      {error && (
        <Box sx={{ mb: 3 }}>
          <Button size="small" onClick={() => setShowDetails((v) => !v)}>
            {showDetails
              ? t('shared.errorBoundary.hideDetails')
              : t('shared.errorBoundary.showDetails')}
          </Button>
          <Collapse in={showDetails}>
            <Paper
              variant="outlined"
              sx={{
                mt: 1,
                p: 2,
                mx: 'auto',
                maxWidth: 600,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              <Typography variant="body2" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </Typography>
            </Paper>
          </Collapse>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        {onReset && (
          <Button variant="contained" onClick={onReset}>
            {t('shared.errorBoundary.tryAgain')}
          </Button>
        )}
        {showDashboardLink && (
          <Button variant="outlined" onClick={() => navigate('/dashboard')}>
            {t('shared.errorBoundary.goToDashboard')}
          </Button>
        )}
      </Box>
    </Box>
  );
}
