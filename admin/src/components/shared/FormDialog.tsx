import { type ReactNode } from 'react';
import { Dialog } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button, M3IconButton, Icon } from '@/components/design-system';

export interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (e?: React.FormEvent) => void;
  title: ReactNode;
  /** Optional Material Symbols ligature for the tonal header icon tile. */
  icon?: string;
  /** Optional short description under the title. */
  subtitle?: ReactNode;
  submitLabel?: ReactNode;
  cancelLabel?: ReactNode;
  submitDisabled?: boolean;
  submitDanger?: boolean;
  submitTestId?: string;
  cancelTestId?: string;
  loading?: boolean;
  /** If provided, the footer renders custom actions instead of the default cancel/submit pair. */
  actions?: ReactNode;
  /** Optional custom width — mirrors MUI Dialog maxWidth prop. */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
  'data-testid'?: string;
  children: ReactNode;
}

/**
 * M3 Expressive form dialog shell. Any create/edit modal across the
 * admin can wrap its form fields in this component to inherit the
 * same rounded paper, tonal header tile, close affordance, and
 * pill-shaped action buttons. MUI Dialog still handles focus trap,
 * portal, backdrop, ESC, and scroll lock — we only restyle the paint.
 *
 * Wraps children in a <form> when `onSubmit` is given; otherwise
 * renders a plain section so callers can provide their own form
 * wrapper (useful for multi-step wizards that handle submission
 * outside the dialog shell).
 */
export default function FormDialog({
  open,
  onClose,
  onSubmit,
  title,
  icon,
  subtitle,
  submitLabel,
  cancelLabel,
  submitDisabled,
  submitDanger,
  submitTestId,
  cancelTestId,
  loading,
  actions,
  maxWidth = 'sm',
  children,
  ...rest
}: FormDialogProps) {
  const { t } = useTranslation();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  const body = (
    <>
      <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {icon && (
            <div
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'var(--primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={22} color="var(--on-primary-container)" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
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
            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: 'var(--on-surface-variant)',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <M3IconButton
            name="close"
            ariaLabel={t('common.actions.close')}
            onClick={onClose}
            size={36}
          />
        </div>
      </div>

      <div
        style={{
          padding: '4px 24px 20px',
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {children}
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
        {actions ?? (
          <>
            <M3Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={loading}
              data-testid={cancelTestId}
            >
              {cancelLabel ?? t('common.actions.cancel')}
            </M3Button>
            <M3Button
              type={onSubmit ? 'submit' : 'button'}
              variant="filled"
              size="sm"
              danger={submitDanger}
              disabled={submitDisabled || loading}
              loading={loading}
              data-testid={submitTestId}
            >
              {submitLabel ?? t('common.actions.save')}
            </M3Button>
          </>
        )}
      </div>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      data-testid={rest['data-testid']}
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
      {onSubmit ? (
        <form onSubmit={handleFormSubmit}>{body}</form>
      ) : (
        body
      )}
    </Dialog>
  );
}
