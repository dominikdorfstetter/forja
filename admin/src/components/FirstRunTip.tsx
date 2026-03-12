import { useState } from 'react';
import { Alert, AlertTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

interface FirstRunTipProps {
  onDismiss: () => void;
}

export default function FirstRunTip({ onDismiss }: FirstRunTipProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    onDismiss();
  };

  return (
    <Alert
      severity="info"
      variant="outlined"
      sx={{ mb: 2 }}
      action={
        <IconButton size="small" onClick={handleClose} aria-label={t('common.actions.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      }
    >
      <AlertTitle>{t('firstRunTip.title')}</AlertTitle>
      {t('firstRunTip.description')}
    </Alert>
  );
}
