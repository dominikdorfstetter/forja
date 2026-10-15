import type { ReactNode } from 'react';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface WizardMethodOption<K extends string> {
  key: K;
  icon: ReactNode;
  labelKey: string;
  descKey: string;
}

interface WizardMethodCardsProps<K extends string> {
  options: WizardMethodOption<K>[];
  selected: K | null;
  onSelect: (key: K) => void;
  columns: number;
}

/** Grid of selectable "how do you want to start?" cards shared by the content wizards. */
export default function WizardMethodCards<K extends string>({ options, selected, onSelect, columns }: WizardMethodCardsProps<K>) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 2 }}>
      {options.map(({ key, icon, labelKey, descKey }) => (
        <Card
          key={key}
          variant="outlined"
          sx={{
            border: 2,
            borderColor: selected === key ? 'primary.main' : 'divider',
            bgcolor: selected === key ? 'action.selected' : 'background.paper',
            transition: 'border-color 0.15s, background-color 0.15s',
            display: 'flex',
          }}
        >
          <CardActionArea
            onClick={() => onSelect(key)}
            sx={{ p: 2.5, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <Box sx={{ color: selected === key ? 'primary.main' : 'text.secondary', mb: 1 }}>
              {icon}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(labelKey)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3, mt: 0.5 }}>
              {t(descKey)}
            </Typography>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
