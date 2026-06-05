import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/design-system';

export interface ActionMenuItem {
  icon?: string;
  label: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  onClose: () => void;
  'data-testid'?: string;
}

interface MenuPosition {
  top: number;
  right: number;
}

/**
 * Popover action menu. Portaled to document.body with position: fixed so it
 * escapes overflow: hidden ancestors (e.g. DataTableV2's rounded-corner
 * container would otherwise clip it). A hidden marker renders in the
 * mount-tree position so the menu can read its previousElementSibling —
 * typically the RowActionBtn trigger — and align underneath it.
 *
 * Interactions:
 * - Esc or outside mousedown closes (mousedown, not click, because
 *   RowActionBtn calls e.stopPropagation() on click and would block it).
 * - Mousedown inside the menu is ignored (ref check).
 * - Window scroll or resize closes the menu; the portal can't track the
 *   anchor's position reliably once the page moves, so close-on-move is
 *   the pragmatic choice.
 */
export function ActionMenu({ items, onClose, ...rest }: ActionMenuProps) {
  const markerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  // Compute the menu position once on mount from the marker's preceding
  // sibling (the RowActionBtn). useLayoutEffect so we paint at the final
  // position rather than flashing at a default first.
  useLayoutEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const anchor = marker.previousElementSibling;
    if (anchor instanceof HTMLElement) {
      const rect = anchor.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    } else {
      // Fallback for lightweight test harnesses that render ActionMenu
      // without a trigger. Positions the menu in a visible region so DOM
      // queries can still find it, even though the layout isn't realistic.
      setPos({ top: 80, right: 80 });
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onScrollOrResize = () => onClose();

    window.addEventListener('keydown', onKeyDown);
    // Register mousedown on next tick so the opening click doesn't
    // immediately close us. Not `{ once: true }` — needs to keep firing.
    const timer = window.setTimeout(() => {
      window.addEventListener('mousedown', onDown);
    }, 0);
    // Capture scroll so we catch ancestor scroll containers, not just window.
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [onClose]);

  const menu = pos ? (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      data-testid={rest['data-testid']}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        right: pos.right,
        zIndex: 30,
        minWidth: 180,
        background: 'var(--surface-container-highest)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 12,
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
        padding: 6,
        animation: 'fadeIn 140ms ease-out',
      }}
    >
      {items.map((it) => {
        const disabled = it.disabled;
        const itemKey =
          typeof it.label === 'string' ? it.label : it.icon ?? String(it.label);
        return (
          <button
            key={itemKey}
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              it.onClick?.();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              fontFamily: 'inherit',
              color: it.danger ? 'var(--err)' : 'var(--on-surface)',
              fontSize: 13,
              textAlign: 'left',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) => {
              if (disabled) return;
              e.currentTarget.style.background = it.danger
                ? 'color-mix(in oklch, var(--err) 14%, transparent)'
                : 'var(--surface-container)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {it.icon && (
              <Icon
                name={it.icon}
                size={16}
                color={it.danger ? 'var(--err)' : 'var(--on-surface-variant)'}
              />
            )}
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <div ref={markerRef} aria-hidden="true" style={{ display: 'none' }} />
      {menu && createPortal(menu, document.body)}
    </>
  );
}
