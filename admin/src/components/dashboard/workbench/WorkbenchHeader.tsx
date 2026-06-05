import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';

export interface WorkbenchHeaderProps {
  siteName: string | null;
  siteColor?: string;
  actions?: ReactNode;
}

/**
 * "Your workbench" greeting block. Large variable-weight title + muted
 * date line with the active site accented in the foreground colour,
 * plus a right-aligned actions slot for primary CTAs (Create / Import).
 */
export function WorkbenchHeader({ siteName, siteColor, actions }: WorkbenchHeaderProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const today = fmt(new Date(), 'EEEE, LLLL d');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 28,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--on-surface-variant)',
            fontWeight: 500,
            marginBottom: 4,
          }}
        >
          {today}
          {siteName && (
            <>
              {' · '}
              <span style={{ color: siteColor || 'var(--on-surface)' }}>{siteName}</span>
            </>
          )}
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 42,
            fontWeight: 600,
            fontVariationSettings: '"wght" 600, "opsz" 48',
            letterSpacing: -1,
            color: 'var(--on-surface)',
          }}
        >
          {t('dashboard.workbench.title', 'Your workbench')}
        </h1>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
