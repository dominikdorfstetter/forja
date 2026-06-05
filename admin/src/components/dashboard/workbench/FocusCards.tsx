import { useTranslation } from 'react-i18next';
import { Icon, STATUS_META } from '@/components/design-system';

export interface FocusCardsProps {
  needsReviewCount: number;
  draftsCount: number;
  scheduledCount: number;
  onFilterChange: (kind: 'review' | 'drafts' | 'scheduled') => void;
  activeFilter?: 'review' | 'drafts' | 'scheduled' | null;
}

/**
 * Three attention-driven focus tiles. Each card:
 * - Accent strip across the top using status metadata colour
 * - Icon tile + label in the top row
 * - Large 48px number + hint below
 * Clicking a card activates the matching chip in the WorkbenchFeed below,
 * so the dashboard reads as "pick a pile, then triage it".
 */
export function FocusCards({
  needsReviewCount,
  draftsCount,
  scheduledCount,
  onFilterChange,
  activeFilter,
}: FocusCardsProps) {
  const { t } = useTranslation();

  const cards = [
    {
      id: 'review' as const,
      accent: STATUS_META.InReview.dot,
      icon: 'rate_review',
      label: t('dashboard.workbench.focus.needsReview', 'Needs your review'),
      value: needsReviewCount,
      hint: t('dashboard.workbench.focus.needsReviewHint', {
        count: needsReviewCount,
        defaultValue_one: '{{count}} awaiting approval',
        defaultValue_other: '{{count}} awaiting approval',
      }),
    },
    {
      id: 'drafts' as const,
      accent: STATUS_META.Draft.dot,
      icon: 'edit_note',
      label: t('dashboard.workbench.focus.drafts', 'Drafts in progress'),
      value: draftsCount,
      hint: t('dashboard.workbench.focus.draftsHint', {
        count: draftsCount,
        defaultValue_one: '{{count}} work-in-progress',
        defaultValue_other: '{{count}} work-in-progress',
      }),
    },
    {
      id: 'scheduled' as const,
      accent: STATUS_META.Scheduled.dot,
      icon: 'schedule',
      label: t('dashboard.workbench.focus.publishingSoon', 'Publishing soon'),
      value: scheduledCount,
      hint: t('dashboard.workbench.focus.scheduledHint', {
        count: scheduledCount,
        defaultValue_one: '{{count}} scheduled',
        defaultValue_other: '{{count}} scheduled',
      }),
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        marginBottom: 24,
      }}
    >
      {cards.map((card) => {
        const isActive = activeFilter === card.id;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onFilterChange(card.id)}
            aria-pressed={isActive}
            aria-label={`${card.label}: ${card.value}. ${card.hint}`}
            style={{
              textAlign: 'left',
              fontFamily: 'inherit',
              padding: 20,
              borderRadius: 22,
              background: isActive ? 'var(--surface-container)' : 'var(--surface-container-low)',
              border: '1px solid ' + (isActive ? 'var(--outline)' : 'var(--outline-variant)'),
              cursor: 'pointer',
              transition: 'background 160ms, transform 160ms, border-color 160ms',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-container)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive
                ? 'var(--surface-container)'
                : 'var(--surface-container-low)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: card.accent,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  // color-mix with transparent gives us a 15% tint that
                  // survives whether card.accent is a hex, an rgba(), or
                  // a CSS var() — string-concatenating '22' on the end
                  // only worked for hex and broke when STATUS_META
                  // switched to token-driven values.
                  background: `color-mix(in oklch, ${card.accent} 15%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={card.icon} size={18} color={card.accent} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>
                {card.label}
              </div>
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1,
                fontVariationSettings: '"wght" 700, "opsz" 48',
                letterSpacing: -1,
                color: 'var(--on-surface)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 10 }}>
              {card.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}
