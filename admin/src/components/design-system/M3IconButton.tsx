import { forwardRef, type MouseEventHandler } from 'react';
import { Tooltip } from '@mui/material';
import { Icon } from './Icon';

export interface M3IconButtonProps {
  name: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
  filled?: boolean;
  tooltip?: string;
  size?: number;
  ariaLabel?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * M3 Expressive icon button with the shape-morph active state:
 * border-radius animates from pill (999) to squircle (14) when active.
 * The transition is driven by the --motion-shape-morph CSS var so
 * prefers-reduced-motion can disable it globally.
 */
export const M3IconButton = forwardRef<HTMLButtonElement, M3IconButtonProps>(
  function M3IconButton(
    { name, onClick, active = false, filled, tooltip, size = 40, ariaLabel, disabled, ...rest },
    ref,
  ) {
    const button = (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel || tooltip || name}
        aria-pressed={active}
        data-testid={rest['data-testid']}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: active ? 14 : 999,
          background: active ? 'var(--primary-container)' : 'transparent',
          color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition:
            'background 160ms cubic-bezier(0.2, 0, 0, 1), var(--motion-shape-morph), color 120ms, var(--motion-press-scale)',
          flexShrink: 0,
          padding: 0,
        }}
        onMouseEnter={(e) => {
          if (!active && !disabled) {
            e.currentTarget.style.background = 'var(--surface-container-high)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active && !disabled) {
            e.currentTarget.style.background = 'transparent';
          }
          e.currentTarget.style.transform = 'none';
        }}
        onMouseDown={(e) => {
          if (!disabled) e.currentTarget.style.transform = 'scale(0.92)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'none';
        }}
      >
        <Icon name={name} size={size * 0.5} filled={filled ?? active} />
      </button>
    );

    if (!tooltip) return button;

    // MUI Tooltip can't bind hover/focus listeners to a disabled element,
    // so a disabled button is wrapped in a span to keep the tooltip live.
    return (
      <Tooltip title={tooltip} arrow enterDelay={300} disableInteractive>
        {disabled ? (
          <span style={{ display: 'inline-flex' }}>{button}</span>
        ) : (
          button
        )}
      </Tooltip>
    );
  },
);
