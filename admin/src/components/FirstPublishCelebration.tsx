import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface FirstPublishCelebrationProps {
  open: boolean;
  onClose: () => void;
  onViewPost?: () => void;
  onWriteAnother?: () => void;
}

export default function FirstPublishCelebration({
  open,
  onClose,
  onViewPost,
  onWriteAnother,
}: FirstPublishCelebrationProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  return (
    <Dialog open={visible} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
        <Typography variant="h4" component="span">
          {t('firstPublish.title')}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', pb: 1 }}>
        <Typography variant="body1" color="text.secondary">
          {t('firstPublish.description')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
        <Stack direction="row" spacing={2}>
          {onViewPost && (
            <Button variant="outlined" onClick={onViewPost}>
              {t('firstPublish.viewPost')}
            </Button>
          )}
          {onWriteAnother && (
            <Button variant="contained" onClick={onWriteAnother}>
              {t('firstPublish.writeAnother')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.actions.close')}</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
