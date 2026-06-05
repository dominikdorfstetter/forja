import { type ReactNode } from 'react';

export interface CardGroupProps {
  label: ReactNode;
  /**
   * Optional right-aligned action slot that sits on the same row as the
   * uppercase label — typically Save/Reset buttons for the card below.
   * Keeping actions at the group header means users don't need to scroll
   * past long forms to find them.
   */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Named grouping above one or more SettingsCards — e.g. "Identity",
 * "Localization". Uppercase tracked label in on-surface-variant, with
 * 10px of breathing room before the card below. An optional actions
 * slot renders right-aligned on the label row.
 */
export function CardGroup({ label, actions, children }: CardGroupProps) {
  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
          minHeight: 28,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1.1,
            color: 'var(--on-surface-variant)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
