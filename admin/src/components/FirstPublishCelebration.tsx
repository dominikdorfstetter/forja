import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

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

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="celebration"
      title={t('firstPublish.title')}
      subtitle={t('firstPublish.description')}
      maxWidth="xs"
      actions={
        <>
          {onViewPost && (
            <M3Button variant="outlined" size="sm" onClick={onViewPost}>
              {t('firstPublish.viewPost')}
            </M3Button>
          )}
          {onWriteAnother && (
            <M3Button variant="filled" size="sm" onClick={onWriteAnother}>
              {t('firstPublish.writeAnother')}
            </M3Button>
          )}
          <M3Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.actions.close')}
          </M3Button>
        </>
      }
    >
      {null}
    </FormDialog>
  );
}
