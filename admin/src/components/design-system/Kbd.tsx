import type { ReactNode } from 'react';

export interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return (
    <kbd
      style={{
        padding: '2px 6px',
        borderRadius: 5,
        background: 'var(--surface-container-high)',
        border: '1px solid var(--outline-variant)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--on-surface-variant)',
        fontWeight: 500,
      }}
    >
      {children}
    </kbd>
  );
}
