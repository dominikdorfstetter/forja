/**
 * Navigable breadcrumb for the Collections pages. PageHeader accepts a
 * ReactNode breadcrumb and applies the muted row styling; here we render
 * the non-final segments as clickable buttons (router navigation) and the
 * final segment as the emphasised current location — matching the visual
 * language of PageHeader's plain-string breadcrumb while making the trail
 * actually navigable.
 */
import { Fragment } from 'react';
import { useNavigate } from 'react-router';

export interface Crumb {
  label: string;
  /** When set (and not the last crumb), the segment is a navigable link. */
  to?: string;
}

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--on-surface-variant)',
  cursor: 'pointer',
  textDecoration: 'none',
};

const lastStyle: React.CSSProperties = {
  color: 'var(--on-surface)',
  fontWeight: 600,
  fontVariationSettings: '"wght" 600, "opsz" 13',
};

export function CollectionsBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const navigate = useNavigate();
  const lastIndex = crumbs.length - 1;
  return (
    <>
      {crumbs.map((crumb, index) => {
        const isLast = index === lastIndex;
        return (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <span aria-hidden="true"> / </span>}
            {crumb.to && !isLast ? (
              <button
                type="button"
                style={linkStyle}
                onClick={() => navigate(crumb.to as string)}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {crumb.label}
              </button>
            ) : (
              <span style={isLast ? lastStyle : undefined}>{crumb.label}</span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
