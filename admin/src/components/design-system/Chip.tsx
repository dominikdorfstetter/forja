import { type ReactNode } from 'react';
import { Icon } from './Icon';

export interface ChipProps {
  children: ReactNode;
  active?: boolean;
  icon?: string;
  count?: number;
  accent?: string;
  onClick?: () => void;
  'aria-pressed'?: boolean;
}

/**
 * M3 Expressive chip with optional leading icon and trailing count badge.
 * Used as a filter selector across dashboard feed and list-page toolbars —
 * `aria-pressed` semantics match the design's "chip as filter tab" pattern.
 */
export function Chip({
  children,
  active = false,
  icon,
  count,
  accent,
  onClick,
  'aria-pressed': ariaPressed,
}: ChipProps) {
  // Active state pulls directly from --primary (the chosen accent)
  // rather than --primary-container (a muted 22% tint of primary) so
  // the chip visibly reflects the active accent — otherwise the
  // container token reads as a neutral grayish tint across every
  // accent, and "Alle" looks lavender regardless of whether the user
  // picked violet, coral, teal, or amber.
  const bg = active
    ? accent || 'color-mix(in srgb, var(--primary) 24%, var(--surface-container-high))'
    : 'var(--surface-container-high)';
  const color = active ? (accent ? '#13131a' : 'var(--primary)') : 'var(--on-surface)';
  const borderColor = active
    ? accent
      ? 'transparent'
      : 'color-mix(in srgb, var(--primary) 45%, transparent)'
    : 'var(--outline-variant)';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed ?? active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 34,
        padding: '0 14px',
        borderRadius: 999,
        border: '1px solid ' + borderColor,
        background: bg,
        color,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 120ms, color 120ms',
        letterSpacing: 0.1,
      }}
    >
      {icon && <Icon name={icon} size={16} filled={active} />}
      {children}
      {count != null && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 999,
            // Active badge: opaque primary tile so the number sits on a
            // strong accent background with its contrast foreground. The
            // previous rgba(0,0,0,0.18) veil on top of the chip's tinted
            // bg faded the number to near-invisibility on light flavors.
            background: active ? 'var(--primary)' : 'var(--surface-container)',
            color: active ? 'var(--primary-c)' : 'var(--on-surface-variant)',
            marginLeft: 2,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
