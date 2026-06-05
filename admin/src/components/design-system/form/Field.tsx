import { type ReactNode } from 'react';

export interface FieldProps {
  fieldId?: string;
  label?: ReactNode;
  hint?: ReactNode;
  /** Lay out label and control horizontally (label left, control right). */
  inline?: boolean;
  /** Temporarily highlight the field (used by the settings jump-to-field search). */
  highlighted?: boolean;
  children: ReactNode;
}

/**
 * Label + hint + control stack. Stacked by default (label on top), or
 * `inline` for horizontal layout (typically used for small selects or
 * numeric inputs where the label doesn't need to dominate the row).
 *
 * `highlighted` flashes a primary border — consumed by the settings
 * jump-to-field search overlay (follow-up issue).
 */
export function Field({
  fieldId,
  label,
  hint,
  inline,
  highlighted,
  children,
}: FieldProps) {
  const borderStyle = highlighted
    ? '1px solid var(--primary)'
    : '1px solid transparent';

  if (inline) {
    return (
      <div
        data-field-id={fieldId}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'center',
          padding: '12px 0',
          border: borderStyle,
          borderRadius: 10,
          margin: '-1px',
          transition: 'border-color 200ms',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {label && (
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>
              {label}
            </div>
          )}
          {hint && (
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--on-surface-variant)',
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {hint}
            </div>
          )}
        </div>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div
      data-field-id={fieldId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '2px 0',
        border: borderStyle,
        borderRadius: 10,
        margin: '-1px',
        transition: 'border-color 200ms',
      }}
    >
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--on-surface)',
          }}
        >
          {label}
        </label>
      )}
      {hint && (
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--on-surface-variant)',
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
