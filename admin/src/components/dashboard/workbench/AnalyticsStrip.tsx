import { useTranslation } from 'react-i18next';
import { Icon, Sparkline } from '@/components/design-system';

export interface AnalyticsStripProps {
  totalViews?: number;
  deltaPercent?: number;
  trendData?: number[];
}

/**
 * Ambient analytics strip — total page views + vs-last-week delta + inline
 * sparkline. When the analytics feature is disabled or has no data, the
 * strip shows a neutral "analytics unavailable" message and omits the
 * numeric claim so we never report fake telemetry.
 */
export function AnalyticsStrip({ totalViews, deltaPercent, trendData }: AnalyticsStripProps) {
  const { t } = useTranslation();
  const hasData = typeof totalViews === 'number' && trendData && trendData.length >= 2;

  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 20,
        background: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Icon name="trending_up" size={22} color="var(--primary)" />
      <div style={{ flex: 1 }}>
        {hasData ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>
              {t('dashboard.workbench.analytics.totalViews', '{{count}} page views', {
                count: totalViews!,
              })}
            </div>
            {typeof deltaPercent === 'number' && (
              <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                {deltaPercent >= 0 ? '+' : ''}
                {deltaPercent}%{' '}
                {t('dashboard.workbench.analytics.vsLastWeek', 'vs last week')}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            {t('dashboard.workbench.analytics.noData', 'Analytics unavailable')}
          </div>
        )}
      </div>
      {hasData && <Sparkline data={trendData!} width={120} height={32} />}
    </div>
  );
}
