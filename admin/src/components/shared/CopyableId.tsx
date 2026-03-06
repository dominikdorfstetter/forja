import { useState } from 'react';
import { Typography, Tooltip, ButtonBase } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface CopyableIdProps {
  value: string;
  variant?: 'body1' | 'body2';
}

export default function CopyableId({ value, variant = 'body2' }: CopyableIdProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip title={copied ? t('common.actions.copied') : t('common.actions.clickToCopy')}>
      <ButtonBase
        onClick={handleClick}
        aria-label={t('common.actions.copyLabel', { value })}
        data-testid="copyable-id"
        sx={{
          wordBreak: 'break-all',
          cursor: 'pointer',
          textAlign: 'left',
          borderRadius: 0.5,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          variant={variant}
          fontFamily="monospace"
          component="span"
        >
          {value}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}
