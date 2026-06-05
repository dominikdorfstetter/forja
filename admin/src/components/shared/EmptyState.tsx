import { ReactNode } from 'react';
import InboxIcon from '@mui/icons-material/Inbox';
import { M3Button } from '@/components/design-system';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * M3 Expressive empty state. Large tonal icon tile over a centered
 * headline + description, with optional primary/secondary actions.
 * Used across every list page when a query returns zero rows.
 */
export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '56px 16px',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: 'var(--primary-container)',
          color: 'var(--on-primary-container)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        {icon || <InboxIcon sx={{ fontSize: 38 }} />}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--on-surface)',
          letterSpacing: -0.1,
          fontVariationSettings: '"wght" 600, "opsz" 20',
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--on-surface-variant)',
            lineHeight: 1.5,
            maxWidth: 420,
          }}
        >
          {description}
        </div>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {action && (
            <M3Button variant="filled" size="sm" onClick={action.onClick}>
              {action.label}
            </M3Button>
          )}
          {secondaryAction && (
            <M3Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </M3Button>
          )}
        </div>
      )}
    </div>
  );
}
