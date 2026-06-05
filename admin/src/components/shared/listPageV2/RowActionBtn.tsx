import { forwardRef, type MouseEventHandler } from 'react';
import { Icon } from '@/components/design-system';

export interface RowActionBtnProps {
  open?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  'data-testid'?: string;
}

/**
 * Bordered 32px square-rounded trigger that lives in the trailing column of
 * every DataTable row. Matches the API-key action pattern: lifts background
 * + stronger border on hover, opens a popover `ActionMenu` on click.
 */
export const RowActionBtn = forwardRef<HTMLButtonElement, RowActionBtnProps>(
  function RowActionBtn({ open = false, onClick, ariaLabel = 'Actions', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={rest['data-testid']}
        style={{
          width: 32,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open ? 'var(--surface-container-high)' : 'var(--surface-container)',
          border: '1px solid ' + (open ? 'var(--outline)' : 'var(--outline-variant)'),
          borderRadius: 8,
          color: 'var(--on-surface)',
          cursor: 'pointer',
          padding: 0,
          transition: 'background 120ms, border-color 120ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-container-high)';
          e.currentTarget.style.borderColor = 'var(--outline)';
        }}
        onMouseLeave={(e) => {
          if (open) return;
          e.currentTarget.style.background = 'var(--surface-container)';
          e.currentTarget.style.borderColor = 'var(--outline-variant)';
        }}
      >
        <Icon name="more_vert" size={18} />
      </button>
    );
  },
);
