import { Box, Switch, Typography } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import WebIcon from '@mui/icons-material/Web';
import WorkIcon from '@mui/icons-material/Work';
import GavelIcon from '@mui/icons-material/Gavel';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

const MODULE_DEFS = [
  { key: 'blog' as const, icon: <ArticleIcon />, defaultOn: true },
  { key: 'pages' as const, icon: <WebIcon />, defaultOn: true },
  { key: 'cv' as const, icon: <WorkIcon />, defaultOn: false },
  { key: 'legal' as const, icon: <GavelIcon />, defaultOn: false },
  { key: 'documents' as const, icon: <DescriptionIcon />, defaultOn: false },
  { key: 'ai' as const, icon: <AutoAwesomeIcon />, defaultOn: false },
] as const;

interface SiteWizardModulesStepProps {
  control: Control<never>;
}

export default function SiteWizardModulesStep({ control }: SiteWizardModulesStepProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('sites.wizard.modulesDescription')}
      </Typography>
      {MODULE_DEFS.map(({ key, icon }) => (
        <Controller
          key={key}
          name={`modules.${key}` as never}
          control={control}
          render={({ field }) => (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: field.value ? 'primary.main' : 'divider',
                bgcolor: field.value ? 'action.selected' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ color: field.value ? 'primary.main' : 'text.secondary' }}>
                  {icon}
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t(`sites.wizard.modules.${key}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`sites.wizard.modules.${key}Desc`)}
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={field.value as boolean}
                onChange={(_, checked) => field.onChange(checked)}
                data-testid={`site-wizard.module.${key}`}
              />
            </Box>
          )}
        />
      ))}
    </Box>
  );
}
