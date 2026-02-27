import { Box, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import EntityHistoryPanel from '@/components/shared/EntityHistoryPanel';

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
}

export default function HistoryDrawer({ open, onClose, entityType, entityId }: HistoryDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">{t('entityHistory.title')}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <EntityHistoryPanel entityType={entityType} entityId={entityId} />
      </Box>
    </Drawer>
  );
}
