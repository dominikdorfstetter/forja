import { type ReactNode } from 'react';

export interface SettingsCardProps {
  children: ReactNode;
  danger?: boolean;
}

/**
 * Container for a group of related fields in a settings section. Rounded
 * 16px card with outline-variant border over surface-container-low.
 * `danger` variant switches the border to the error colour at low alpha
 * for destructive sections.
 */
export function SettingsCard({ children, danger }: SettingsCardProps) {
  return (
    <div
      style={{
        background: 'var(--surface-container-low)',
        border: danger
          ? '1px solid color-mix(in oklch, var(--err) 40%, transparent)'
          : '1px solid var(--outline-variant)',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {children}
    </div>
  );
}
