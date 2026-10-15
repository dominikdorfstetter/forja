import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** "Change" / "Remove" buttons for a picked image; the caller lays them out. */
export default function ImagePickActions({ onChange, onRemove }: { onChange: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Button size="small" variant="outlined" onClick={onChange}>{t('blogDetail.images.changeImage')}</Button>
      <Button size="small" color="error" onClick={onRemove}>{t('blogDetail.images.removeImage')}</Button>
    </>
  );
}
