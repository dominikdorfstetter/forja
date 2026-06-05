import { type ReactNode } from 'react';

export interface ToolbarProps {
  children: ReactNode;
}

/**
 * Horizontal container for the search field and chip filters on a list page.
 * Wraps on narrow viewports; consumers put a spacer (flex: 1) between search
 * and chips to push them apart.
 */
export function Toolbar({ children }: ToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <div style={{ flex: 1 }} />;
}
