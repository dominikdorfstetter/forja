import { useTranslation } from 'react-i18next';

interface LoadingStateProps {
  label?: string;
}

/**
 * Lightweight loading surface used across list/detail views. The M3
 * Expressive treatment is a three-dot breathing animation over a
 * tonal primary-container disc; subtler than a solid spinner and
 * matches the motion language of other progress affordances in the
 * app (shape-morph, pulse).
 */
export default function LoadingState({ label }: LoadingStateProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('shared.loadingState.defaultLabel');
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '56px 16px',
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--primary-container)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--on-primary-container)',
        }}
      >
        <span
          role="progressbar"
          aria-label={displayLabel}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2.5px solid currentColor',
            borderTopColor: 'transparent',
            animation: 'm3-ls-spin 900ms linear infinite',
          }}
        />
      </span>
      {displayLabel && (
        <span
          style={{
            fontSize: 13.5,
            color: 'var(--on-surface-variant)',
            fontWeight: 500,
            letterSpacing: 0.1,
          }}
        >
          {displayLabel}
        </span>
      )}
      <style>{`
        @keyframes m3-ls-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="loading-state"] span[style*="m3-ls-spin"] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
