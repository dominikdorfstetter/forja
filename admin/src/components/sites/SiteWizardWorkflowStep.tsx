import { Box, Card, CardActionArea, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface SiteWizardWorkflowStepProps {
  control: Control<never>;
}

export default function SiteWizardWorkflowStep({ control }: SiteWizardWorkflowStepProps) {
  const { t } = useTranslation();

  return (
    <Controller
      name={'workflowMode' as never}
      control={control}
      render={({ field }) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('sites.wizard.workflowDescription')}
          </Typography>
          {(['solo', 'team'] as const).map((mode) => (
            <Card
              key={mode}
              variant="outlined"
              sx={{
                border: 2,
                borderColor: field.value === mode ? 'primary.main' : 'divider',
                bgcolor: field.value === mode ? 'action.selected' : 'background.paper',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <CardActionArea
                onClick={() => field.onChange(mode)}
                sx={{ p: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 2 }}
                data-testid={`site-wizard.workflow.${mode}`}
              >
                <Box sx={{ color: field.value === mode ? 'primary.main' : 'text.secondary', mt: 0.5 }}>
                  {mode === 'solo' ? <PersonIcon sx={{ fontSize: 32 }} /> : <GroupIcon sx={{ fontSize: 32 }} />}
                </Box>
                <Box>
                  <Typography variant="body1" fontWeight={600}>
                    {t(`sites.wizard.workflow.${mode}`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`sites.wizard.workflow.${mode}Desc`)}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    />
  );
}
