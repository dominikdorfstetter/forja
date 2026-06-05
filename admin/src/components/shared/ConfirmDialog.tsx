import { useState, useEffect } from 'react';
import {
  Dialog,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button, Icon } from '@/components/design-system';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'error' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmationText?: string;
  children?: React.ReactNode;
}

type Tone = {
  /** Material Symbols ligature for the lead icon. */
  icon: string;
  /** Background colour for the 56px icon tile. */
  tileBg: string;
  /** Foreground colour for the lead icon. */
  tileFg: string;
  /** Whether the confirm button is rendered in the error palette. */
  danger: boolean;
};

const TONES: Record<'error' | 'warning' | 'primary', Tone> = {
  error: {
    icon: 'error',
    tileBg: 'color-mix(in oklch, var(--err) 18%, transparent)',
    tileFg: 'var(--err)',
    danger: true,
  },
  warning: {
    icon: 'warning',
    tileBg: 'color-mix(in oklch, var(--warn, #f5b76f) 22%, transparent)',
    tileFg: 'var(--warn, #f5b76f)',
    danger: false,
  },
  primary: {
    icon: 'check_circle',
    tileBg: 'var(--primary-container)',
    tileFg: 'var(--on-primary-container)',
    danger: false,
  },
};

/**
 * M3 Expressive confirm dialog. MUI Dialog still provides the modal
 * mechanics (focus trap, portal, backdrop, scroll lock, ESC handler),
 * but the paper, headline, and action row are restyled with M3 tokens.
 * A tonal icon tile replaces the legacy coloured banner so the tone
 * reads instantly without dominating the dialog.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmColor = 'error',
  onConfirm,
  onCancel,
  loading,
  confirmationText,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (!open) setTypedValue('');
  }, [open]);

  const isConfirmDisabled =
    loading || (!!confirmationText && typedValue.toLowerCase() !== confirmationText.toLowerCase());
  const tone = TONES[confirmColor];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isConfirmDisabled) {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      data-testid="confirm-dialog"
      slotProps={{
        paper: {
          sx: {
            borderRadius: '28px',
            background: 'var(--surface-container-high)',
            border: '1px solid var(--outline-variant)',
            boxShadow: '0 24px 60px -16px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          },
        },
        backdrop: {
          sx: {
            background: 'color-mix(in oklch, var(--shadow, #000) 62%, transparent)',
            backdropFilter: 'blur(2px)',
          },
        },
      }}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 16,
              background: tone.tileBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={tone.icon} size={24} color={tone.tileFg} filled />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="confirm-dialog-title"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: -0.2,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 600, "opsz" 24',
              }}
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-description"
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--on-surface-variant)',
              }}
            >
              {message}
            </p>
          </div>
        </div>

        {children}

        {confirmationText && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            onKeyDown={handleKeyDown}
            helperText={t('common.confirmDialog.typeToConfirm', { word: confirmationText })}
            aria-label={t('shared.confirmDialog.confirmationInput')}
            data-testid="confirm-input"
          />
        )}
      </div>

      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          background: 'var(--surface-container)',
          borderTop: '1px solid var(--outline-variant)',
        }}
      >
        <M3Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={loading}
          data-testid="confirm-dialog-cancel"
        >
          {t('common.actions.cancel')}
        </M3Button>
        <M3Button
          variant="filled"
          size="sm"
          danger={tone.danger}
          onClick={onConfirm}
          disabled={isConfirmDisabled}
          loading={loading}
          data-testid="confirm-dialog-confirm"
        >
          {confirmLabel || t('common.actions.confirm')}
        </M3Button>
      </div>
    </Dialog>
  );
}
