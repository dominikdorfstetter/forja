import { useReducer, useCallback, useRef } from 'react';
import { Box, Button, Typography, Stack } from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import SaveIcon from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';

interface FocalPointPickerProps {
  src: string;
  focalX: number;
  focalY: number;
  saving?: boolean;
  onSave: (x: number, y: number) => void;
}

const NUDGE_STEP = 0.01;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface FocalState { x: number; y: number }

function focalReducer(_: FocalState, next: FocalState): FocalState {
  return next;
}

export default function FocalPointPicker({ src, focalX, focalY, saving, onSave }: FocalPointPickerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state for immediate crosshair feedback.
  // Parent uses key={`${focal_x}-${focal_y}`} to reset on server change.
  const [local, setLocal] = useReducer(focalReducer, { x: focalX, y: focalY });

  const isDirty = Math.abs(local.x - focalX) > 0.001 || Math.abs(local.y - focalY) > 0.001;
  const isCenter = Math.abs(local.x - 0.5) < 0.001 && Math.abs(local.y - 0.5) < 0.001;

  const setPoint = useCallback((x: number, y: number) => {
    setLocal({ x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) });
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPoint(clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height));
    },
    [setPoint],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'ArrowLeft':
          dx = -NUDGE_STEP;
          break;
        case 'ArrowRight':
          dx = NUDGE_STEP;
          break;
        case 'ArrowUp':
          dy = -NUDGE_STEP;
          break;
        case 'ArrowDown':
          dy = NUDGE_STEP;
          break;
        default:
          return;
      }
      e.preventDefault();
      setPoint(clamp(local.x + dx), clamp(local.y + dy));
    },
    [local, setPoint],
  );

  const handleReset = useCallback(() => {
    setPoint(0.5, 0.5);
  }, [setPoint]);

  const handleSave = useCallback(() => {
    onSave(local.x, local.y);
  }, [local, onSave]);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {t('forms.mediaDetail.fields.focalPoint')}
      </Typography>
      <Box
        ref={containerRef}
        role="application"
        tabIndex={0}
        aria-label={t('forms.mediaDetail.focalPoint.instruction')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid="focal-point-picker"
        sx={{
          position: 'relative',
          width: '100%',
          cursor: 'crosshair',
          borderRadius: 1,
          overflow: 'hidden',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <Box
          component="img"
          src={src}
          alt=""
          sx={{
            width: '100%',
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        {/* Crosshair indicator */}
        <Box
          data-testid="focal-point-crosshair"
          sx={{
            position: 'absolute',
            left: `${local.x * 100}%`,
            top: `${local.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              background: 'white',
              boxShadow: '0 0 1px rgba(0,0,0,0.5)',
            },
            '&::before': {
              left: '50%',
              top: -4,
              bottom: -4,
              width: 2,
              transform: 'translateX(-50%)',
            },
            '&::after': {
              top: '50%',
              left: -4,
              right: -4,
              height: 2,
              transform: 'translateY(-50%)',
            },
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {t('forms.mediaDetail.focalPoint.instruction')}
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
        {isDirty && (
          <Button
            size="small"
            variant="contained"
            fullWidth
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            data-testid="focal-point-save"
          >
            {t('common.actions.save')}
          </Button>
        )}
        {!isCenter && (
          <Button
            size="small"
            fullWidth
            startIcon={<CenterFocusStrongIcon />}
            onClick={handleReset}
            data-testid="focal-point-reset"
          >
            {t('forms.mediaDetail.focalPoint.reset')}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
