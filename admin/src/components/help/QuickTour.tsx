import { useState, useEffect, useCallback, useMemo } from 'react';
import { Backdrop, Paper, Typography, Button, Stack, Box, Popper } from '@mui/material';
import { useTranslation } from 'react-i18next';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

const TOUR_STEPS = [
  { target: 'dashboard-stats', textKey: 'help.tour.step1' },
  { target: 'sidebar-nav', textKey: 'help.tour.step2' },
  { target: 'site-selector', textKey: 'help.tour.step3' },
  { target: 'command-palette', textKey: 'help.tour.step4' },
  { target: 'help-menu', textKey: 'help.tour.step5' },
] as const;

interface QuickTourProps {
  active: boolean;
  onComplete: () => void;
}

export default function QuickTour({ active, onComplete }: QuickTourProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // Memoize available steps to avoid re-creating the array every render
  const availableSteps = useMemo(
    () => TOUR_STEPS.filter(
      (step) => document.querySelector(`[data-tour="${step.target}"]`) !== null,
    ),
    [active], // eslint-disable-line react-hooks/exhaustive-deps -- re-check DOM when tour activates
  );

  const updateAnchor = useCallback(() => {
    if (!active || availableSteps.length === 0) {
      setAnchorEl(null);
      return;
    }
    const step = availableSteps[currentStep];
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    setAnchorEl(el);
  }, [active, currentStep, availableSteps]);

  useEffect(() => {
    updateAnchor();
  }, [updateAnchor]);

  // Reset step when tour becomes active
  useEffect(() => {
    if (active) setCurrentStep(0);
  }, [active]);

  if (!active || availableSteps.length === 0) return null;

  const step = availableSteps[currentStep];
  const isLastStep = currentStep === availableSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return (
    <>
      <Backdrop
        open
        sx={{
          zIndex: (theme) => theme.zIndex.tooltip - 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
        onClick={onComplete}
      />

      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
        modifiers={[
          { name: 'offset', options: { offset: [0, 12] } },
          { name: 'preventOverflow', options: { padding: 16 } },
        ]}
      >
        <Paper
          elevation={8}
          sx={{
            p: 2.5,
            maxWidth: 340,
            borderRadius: 2,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 12,
              height: 12,
              bgcolor: 'background.paper',
              boxShadow: '-2px -2px 4px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {t('help.tour.stepOf', { current: currentStep + 1, total: availableSteps.length })}
          </Typography>

          <Typography variant="body2" sx={{ mb: 2 }}>
            {step ? t(step.textKey, { shortcut: shortcutLabel }) : ''}
          </Typography>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" onClick={onComplete} color="inherit">
              {t('help.tour.skip')}
            </Button>
            <Box>
              <Button size="small" variant="contained" onClick={handleNext}>
                {isLastStep ? t('help.tour.done') : t('help.tour.next')}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Popper>
    </>
  );
}
