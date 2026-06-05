import { Fragment, type ReactNode } from 'react';
import { Icon } from '@/components/design-system';

/**
 * Splits a breadcrumb string on " / " and renders the last segment with
 * the emphasised M3 weight so it visually anchors the user's position.
 * The separator itself is just a " / " text node to match the shared
 * PageHeader's visual language.
 */
function renderBreadcrumbString(value: string): ReactNode {
  const parts = value.split(' / ');
  const lastIndex = parts.length - 1;
  // Build a running path prefix so duplicate segment labels (e.g. "Settings
  // / Advanced / Settings") still yield unique keys.
  let prefix = '';
  return parts.map((part, position) => {
    prefix = prefix ? `${prefix}/${part}` : part;
    const isLast = position === lastIndex;
    return (
      <Fragment key={prefix}>
        <span
          style={
            isLast
              ? {
                  color: 'var(--on-surface)',
                  fontWeight: 600,
                  fontVariationSettings: '"wght" 600, "opsz" 13',
                }
              : undefined
          }
        >
          {part}
        </span>
        {!isLast && <span aria-hidden="true"> / </span>}
      </Fragment>
    );
  });
}

export interface PageHeaderProps {
  icon?: string;
  breadcrumb?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/**
 * List-page header with optional icon tile, breadcrumb, large
 * variable-weight title, and right-aligned action slot. The icon tile
 * mirrors SectionHead (48×48 primary-container) so every route aligns
 * the title + symbol the same way.
 */
export function PageHeader({ icon, breadcrumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <div>
        {breadcrumb && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--on-surface-variant)',
              fontWeight: 500,
              fontVariationSettings: '"wght" 500, "opsz" 13',
              marginBottom: 6,
            }}
          >
            {typeof breadcrumb === 'string' ? renderBreadcrumbString(breadcrumb) : breadcrumb}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {icon && (
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'var(--primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={icon} size={26} color="var(--on-primary-container)" />
            </div>
          )}
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 600,
              fontVariationSettings: '"wght" 600, "opsz" 40',
              letterSpacing: -0.5,
              color: 'var(--on-surface)',
            }}
          >
            {title}
          </h1>
        </div>
        {subtitle && (
          <div
            data-testid="page-header.subtitle"
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              fontWeight: 400,
              color: 'var(--on-surface-variant)',
              fontVariationSettings: '"wght" 400, "opsz" 14',
              marginTop: 8,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
