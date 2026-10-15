import { Box, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CardGroup, SettingsCard, Field } from '@/components/design-system';

interface FaviconColorsCardProps {
  themeColor: string;
  bgColor: string;
  onThemeColorChange: (value: string) => void;
  onBgColorChange: (value: string) => void;
}

/** Theme and background colour pickers for the web app manifest. */
export default function FaviconColorsCard({ themeColor, bgColor, onThemeColorChange, onBgColorChange }: FaviconColorsCardProps) {
  const { t } = useTranslation();

  return (
    <CardGroup label={t('settings.favicon.colors')}>
      <SettingsCard>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
          <Field
            fieldId="favicon-theme-color"
            label={t('settings.favicon.themeColor')}
          >
            <TextField
              id="favicon-theme-color"
              value={themeColor}
              onChange={(e) => onThemeColorChange(e.target.value)}
              size="small"
              type="color"
              sx={{ width: 150 }}
              data-testid="site-settings.favicon.theme-color"
            />
          </Field>
          <Field
            fieldId="favicon-bg-color"
            label={t('settings.favicon.bgColor')}
          >
            <TextField
              id="favicon-bg-color"
              value={bgColor}
              onChange={(e) => onBgColorChange(e.target.value)}
              size="small"
              type="color"
              sx={{ width: 150 }}
              data-testid="site-settings.favicon.bg-color"
            />
          </Field>
        </Box>
      </SettingsCard>
    </CardGroup>
  );
}
