import { useEffect, useState } from 'react';
import { Dialog, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { M3Button } from './M3Button';

export interface DangerConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  /** Exact text the user must type before the confirm button enables. */
  confirmPhrase: string;
  /** Label for the destructive confirm button. */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

const TITLE_ID = 'danger-confirm-dialog-title';
const BODY_ID = 'danger-confirm-dialog-description';

/**
 * GitHub-style destructive confirmation. The user must type the exact
 * `confirmPhrase` (trimmed, case-sensitive) before the confirm button
 * enables. MUI Dialog supplies the modal mechanics (focus trap, portal,
 * backdrop, scroll lock, ESC handler); the paper/headline/action row are
 * restyled with M3 tokens to match the rest of the Danger zone.
 *
 * Distinct from `shared/ConfirmDialog` on purpose: that one matches
 * case-insensitively against a generic word and is shared by ~37 call
 * sites — this one is the single source of truth for site-name
 * exact-match confirmations in Site Settings (#708).
 */
export function DangerConfirmDialog({
  open,
  title,
  body,
  confirmPhrase,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
}: DangerConfirmDialogProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const matches = typed.trim() === confirmPhrase.trim();
  const showMismatch = typed.trim().length > 0 && !matches;
  const isConfirmDisabled = loading || !matches;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isConfirmDisabled) {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={TITLE_ID}
      aria-describedby={BODY_ID}
      data-testid="danger-confirm-dialog"
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
              background: 'color-mix(in oklch, var(--err) 18%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="error" size={24} color="var(--err)" filled />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id={TITLE_ID}
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
              id={BODY_ID}
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--on-surface-variant)',
              }}
            >
              {body}
            </p>
          </div>
        </div>

        <TextField
          autoFocus
          fullWidth
          size="small"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={handleKeyDown}
          label={t('siteSettings.danger.confirm.typeToConfirm', { phrase: confirmPhrase })}
          placeholder={t('siteSettings.danger.confirm.placeholder')}
          error={showMismatch}
          helperText={showMismatch ? t('siteSettings.danger.confirm.mismatch') : ' '}
          slotProps={{ htmlInput: { 'data-testid': 'danger-confirm-dialog.input' } }}
        />
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
          onClick={onClose}
          disabled={loading}
          data-testid="danger-confirm-dialog.cancel"
        >
          {t('siteSettings.danger.confirm.cancel')}
        </M3Button>
        <M3Button
          variant="filled"
          size="sm"
          danger
          onClick={onConfirm}
          disabled={isConfirmDisabled}
          loading={loading}
          data-testid="danger-confirm-dialog.confirm"
        >
          {confirmLabel}
        </M3Button>
      </div>
    </Dialog>
  );
}
