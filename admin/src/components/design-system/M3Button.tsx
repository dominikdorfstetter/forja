import { forwardRef, type MouseEventHandler, type ReactNode } from 'react';
import { Icon } from './Icon';

export type M3ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'ghost';
export type M3ButtonSize = 'sm' | 'md' | 'lg';

export interface M3ButtonProps {
  children: ReactNode;
  variant?: M3ButtonVariant;
  size?: M3ButtonSize;
  icon?: string;
  iconEnd?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  /**
   * When true, the button uses the error colour palette — red fill for
   * `filled`, red-tinted outline/ghost/tonal for the others. Intended for
   * destructive actions in the Danger zone.
   */
  danger?: boolean;
  /** Show a loading indicator and disable the button. */
  loading?: boolean;
  ariaLabel?: string;
  'data-testid'?: string;
}

const SIZES: Record<M3ButtonSize, { h: number; px: number; fs: number; gap: number; iconSize: number }> = {
  sm: { h: 32, px: 14, fs: 13, gap: 6, iconSize: 16 },
  md: { h: 40, px: 20, fs: 14, gap: 8, iconSize: 18 },
  lg: { h: 48, px: 24, fs: 15, gap: 10, iconSize: 20 },
};

const VARIANTS: Record<M3ButtonVariant, { background: string; color: string; border: string }> = {
  filled: { background: 'var(--primary)', color: 'var(--primary-c)', border: '1px solid transparent' },
  tonal: {
    background: 'var(--primary-container)',
    color: 'var(--on-primary-container)',
    border: '1px solid transparent',
  },
  outlined: { background: 'transparent', color: 'var(--on-surface)', border: '1px solid var(--outline)' },
  text: { background: 'transparent', color: 'var(--primary)', border: '1px solid transparent' },
  ghost: {
    background: 'var(--surface-container-high)',
    color: 'var(--on-surface)',
    border: '1px solid var(--outline-variant)',
  },
};

/** Red/error palette applied when `danger` is true. Mirrors VARIANTS keys. */
const DANGER_VARIANTS: Record<M3ButtonVariant, { background: string; color: string; border: string }> = {
  filled: { background: 'var(--err)', color: '#1a0a0a', border: '1px solid transparent' },
  tonal: {
    background: 'color-mix(in oklch, var(--err) 18%, transparent)',
    color: 'var(--err)',
    border: '1px solid transparent',
  },
  outlined: {
    background: 'transparent',
    color: 'var(--err)',
    border: '1px solid color-mix(in oklch, var(--err) 50%, transparent)',
  },
  text: { background: 'transparent', color: 'var(--err)', border: '1px solid transparent' },
  ghost: {
    background: 'color-mix(in oklch, var(--err) 10%, transparent)',
    color: 'var(--err)',
    border: '1px solid color-mix(in oklch, var(--err) 30%, transparent)',
  },
};

/**
 * M3 Expressive button. Five variants (filled/tonal/outlined/text/ghost) with
 * matching hit scales on press. Fully rounded (pill) by default — the
 * shape-morph motion on this component is a press-scale (0.97), not radius.
 */
export const M3Button = forwardRef<HTMLButtonElement, M3ButtonProps>(
  function M3Button(
    {
      children,
      variant = 'filled',
      size = 'md',
      icon,
      iconEnd,
      onClick,
      disabled,
      type = 'button',
      fullWidth,
      danger,
      loading,
      ariaLabel,
      ...rest
    },
    ref,
  ) {
    const s = SIZES[size];
    const v = danger ? DANGER_VARIANTS[variant] : VARIANTS[variant];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        aria-label={ariaLabel}
        data-testid={rest['data-testid']}
        style={{
          ...v,
          height: s.h,
          padding: `0 ${s.px}px`,
          borderRadius: s.h / 2,
          fontSize: s.fs,
          fontWeight: 600,
          fontFamily: 'inherit',
          display: fullWidth ? 'flex' : 'inline-flex',
          width: fullWidth ? '100%' : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.gap,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          letterSpacing: 0.2,
          opacity: isDisabled ? 0.5 : 1,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition:
            'var(--motion-press-scale), filter 120ms cubic-bezier(0.2, 0, 0, 1), background 160ms cubic-bezier(0.2, 0, 0, 1)',
        }}
        onMouseDown={(e) => {
          if (!isDisabled) e.currentTarget.style.transform = 'scale(0.97)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'none';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
        }}
      >
        {loading ? (
          <span
            className="m3-button-spinner"
            style={{
              width: s.iconSize,
              height: s.iconSize,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'm3-spin 600ms linear infinite',
              flexShrink: 0,
            }}
          />
        ) : (
          icon && <Icon name={icon} size={s.iconSize} />
        )}
        {children}
        {iconEnd && !loading && <Icon name={iconEnd} size={s.iconSize} />}
        <style>{'@keyframes m3-spin{to{transform:rotate(360deg)}}'}</style>
      </button>
    );
  },
);
