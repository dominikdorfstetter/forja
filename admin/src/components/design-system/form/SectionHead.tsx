import { type ReactNode } from 'react';
import { Icon } from '../Icon';

export interface SectionHeadProps {
  icon?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  danger?: boolean;
}

/**
 * Section header used at the top of each settings detail pane. Icon-tile
 * (primary-container bg) + title (Roboto Flex opsz 32) + optional subtitle
 * in the muted foreground. Danger variant uses the error colour.
 */
export function SectionHead({ icon, title, subtitle, danger }: SectionHeadProps) {
  const color = danger ? 'var(--err)' : 'var(--primary)';
  const bg = danger
    ? 'color-mix(in oklch, var(--err) 16%, transparent)'
    : 'var(--primary-container)';
  return (
    <header style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {icon && (
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={22} color={danger ? color : 'var(--on-primary-container)'} />
          </div>
        )}
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            fontVariationSettings: '"wght" 600, "opsz" 32',
            letterSpacing: -0.3,
            color: danger ? color : 'var(--on-surface)',
          }}
        >
          {title}
        </h2>
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--on-surface-variant)',
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      )}
    </header>
  );
}
