import { Box, Card, CardActionArea, Typography } from '@mui/material';
import CreateIcon from '@mui/icons-material/Create';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';

type CreationMethod = 'scratch' | 'template' | 'import' | 'ai';

interface BlogWizardMethodStepProps {
  method: CreationMethod | null;
  onSelect: (method: CreationMethod) => void;
  aiAvailable: boolean;
}

export default function BlogWizardMethodStep({ method, onSelect, aiAvailable }: BlogWizardMethodStepProps) {
  const { t } = useTranslation();

  const methodCards: { key: CreationMethod; icon: React.ReactNode; labelKey: string; descKey: string }[] = [
    ...(aiAvailable
      ? [{ key: 'ai' as const, icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.ai', descKey: 'blogs.wizard.methods.aiDesc' }]
      : []),
    { key: 'scratch', icon: <CreateIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.scratch', descKey: 'blogs.wizard.methods.scratchDesc' },
    { key: 'template', icon: <DescriptionIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.template', descKey: 'blogs.wizard.methods.templateDesc' },
    { key: 'import', icon: <UploadFileIcon sx={{ fontSize: 32 }} />, labelKey: 'blogs.wizard.methods.import', descKey: 'blogs.wizard.methods.importDesc' },
  ];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
      {methodCards.map(({ key, icon, labelKey, descKey }) => (
        <Card
          key={key}
          variant="outlined"
          sx={{
            border: 2,
            borderColor: method === key ? 'primary.main' : 'divider',
            bgcolor: method === key ? 'action.selected' : 'background.paper',
            transition: 'border-color 0.15s, background-color 0.15s',
            display: 'flex',
          }}
        >
          <CardActionArea
            onClick={() => onSelect(key)}
            sx={{ p: 2.5, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <Box sx={{ color: method === key ? 'primary.main' : 'text.secondary', mb: 1 }}>
              {icon}
            </Box>
            <Typography variant="body2" fontWeight={600}>{t(labelKey)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3, mt: 0.5 }}>
              {t(descKey)}
            </Typography>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
