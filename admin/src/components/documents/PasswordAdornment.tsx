import { IconButton, InputAdornment, Tooltip } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useTranslation } from 'react-i18next';

interface PasswordAdornmentProps {
  visible: boolean;
  onToggleVisible: () => void;
  onGenerate: () => void;
}

/** End adornment of a document password field: show/hide toggle plus "generate password". */
export default function PasswordAdornment({ visible, onToggleVisible, onGenerate }: PasswordAdornmentProps) {
  const { t } = useTranslation();
  return (
    <InputAdornment position="end">
      <IconButton size="small" onClick={onToggleVisible}>
        {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
      <Tooltip title={t('documents.privacy.generate')}>
        <IconButton size="small" onClick={onGenerate}>
          <AutorenewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );
}
