import { useTranslation } from 'react-i18next';
import { type ContentStatus, STATUS_META } from './statusMeta';

export interface StatusPillProps {
  status: ContentStatus;
  size?: 'sm' | 'md';
  withDot?: boolean;
}

const I18N_KEY: Record<ContentStatus, string> = {
  Draft: 'common.status.draft',
  InReview: 'common.status.inReview',
  Scheduled: 'common.status.scheduled',
  Published: 'common.status.published',
  Archived: 'common.status.archived',
};

export function StatusPill({ status, size = 'md', withDot = true }: StatusPillProps) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const sm = size === 'sm';
  const label = t(I18N_KEY[status], meta.label);

  return (
    <span
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: sm ? '2px 8px' : '4px 10px',
        background: meta.bg,
        color: meta.color,
        borderRadius: 999,
        fontSize: sm ? 11 : 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: 0.1,
      }}
    >
      {withDot && (
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }}
        />
      )}
      {label}
    </span>
  );
}
