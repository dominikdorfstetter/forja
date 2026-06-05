import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import { WEBHOOK_TEMPLATES, type WebhookTemplate } from '@/data/webhookTemplates';

interface WebhookTemplatePickerProps {
  onSelect: (template: WebhookTemplate | null) => void;
  selected: string | null;
}

export default function WebhookTemplatePicker({ onSelect, selected }: WebhookTemplatePickerProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('webhooks.templates.title')}</Typography>
      <Box role="radiogroup" aria-label={t('webhooks.templates.title')} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {WEBHOOK_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            variant={selected === template.id ? 'elevation' : 'outlined'}
            sx={{
              flex: '1 1 0',
              minWidth: 140,
              border: selected === template.id ? 2 : 1,
              borderColor: selected === template.id ? 'primary.main' : 'divider',
            }}
            role="radio"
            aria-checked={selected === template.id}
            data-testid={`template-card-${template.id}`}
          >
            <CardActionArea onClick={() => onSelect(template)}>
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <CloudIcon color={selected === template.id ? 'primary' : 'action'} />
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>{t(template.nameKey)}</Typography>
                <Typography variant="caption" color="text.secondary">{t(template.descriptionKey)}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        <Card
          variant={selected === null ? 'elevation' : 'outlined'}
          sx={{
            flex: '1 1 0',
            minWidth: 140,
            border: selected === null ? 2 : 1,
            borderColor: selected === null ? 'primary.main' : 'divider',
          }}
          role="radio"
          aria-checked={selected === null}
          data-testid="template-card-custom"
        >
          <CardActionArea onClick={() => onSelect(null)}>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <SettingsIcon color={selected === null ? 'primary' : 'action'} />
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>{t('webhooks.templates.custom')}</Typography>
              <Typography variant="caption" color="text.secondary">{t('webhooks.templates.customDesc')}</Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  );
}
