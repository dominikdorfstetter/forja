import { useEffect, useCallback } from 'react';
import { Box, IconButton, Tooltip, Fade } from '@mui/material';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { useTranslation } from 'react-i18next';

interface ZenModeOverlayProps {
  children: React.ReactNode;
  onExit: () => void;
}

export default function ZenModeOverlay({ children, onExit }: ZenModeOverlayProps) {
  const { t } = useTranslation();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    },
    [onExit],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Fade in timeout={200}>
      <Box
        role="dialog"
        aria-label={t('editor.zen.tooltip')}
        data-testid="zen-mode-overlay"
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'auto',
        }}
      >
        {/* Exit button */}
        <Tooltip title={t('editor.zen.exit')} arrow>
          <IconButton
            onClick={onExit}
            data-testid="zen-mode-exit"
            sx={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 1,
              bgcolor: 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <FullscreenExitIcon />
          </IconButton>
        </Tooltip>

        {/* Centered content area */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 720,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            px: 3,
            py: 4,
          }}
        >
          {children}
        </Box>
      </Box>
    </Fade>
  );
}
