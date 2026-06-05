import { useState, type ChangeEvent } from 'react';
import { Icon } from '@/components/design-system';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  fullWidth?: boolean;
  ariaLabel?: string;
  clearAriaLabel?: string;
  'data-testid'?: string;
}

/**
 * Pill-shaped search input (999px radius, 40px tall) matching the M3
 * Expressive language. Always shows a leading search icon; consumers supply
 * placeholder text per-surface. Fully controlled — debouncing lives in the
 * page hook (`useListPageState.debouncedSearch`).
 *
 * When `value` is non-empty a trailing clear button surfaces so users don't
 * have to select-and-delete; the clear is keyboard-reachable and carries an
 * accessible name via `clearAriaLabel`.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  width = 320,
  fullWidth = false,
  ariaLabel,
  clearAriaLabel = 'Clear search',
  ...rest
}: SearchFieldProps) {
  // Render a visible focus ring on the label wrapper while the inner input
  // holds focus — lets us keep the outer pill's rounded chrome while still
  // surfacing keyboard focus clearly (a :focus-visible equivalent for the
  // container, since inline style can't express pseudo-selectors).
  const [focused, setFocused] = useState(false);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 40,
        padding: '0 12px 0 16px',
        background: 'var(--surface-container-low)',
        border: '1px solid ' + (focused ? 'var(--primary)' : 'var(--outline-variant)'),
        boxShadow: focused
          ? '0 0 0 3px color-mix(in oklch, var(--primary) 28%, transparent)'
          : 'none',
        borderRadius: 999,
        color: 'var(--on-surface-variant)',
        width: fullWidth ? '100%' : width,
        minWidth: 240,
        transition: 'border-color 120ms, box-shadow 120ms',
      }}
    >
      <Icon name="search" size={18} />
      <input
        type="search"
        className="forja-search-input"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        data-testid={rest['data-testid']}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 13,
          color: 'var(--on-surface)',
        }}
      />
      {value && (
        <button
          type="button"
          aria-label={clearAriaLabel}
          onClick={() => onChange('')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            color: 'var(--on-surface-variant)',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </label>
  );
}
