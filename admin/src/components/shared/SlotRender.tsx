import type { ReactNode } from 'react';

/**
 * Renders a consumer-supplied render-prop slot as its own component, so hooks
 * the slot uses belong to this element rather than the harness that hosts it.
 * Used by the EntityListPage / ContentDetailPage harnesses.
 */
export function SlotRender<TArgs>({ render, args }: { render: (a: TArgs) => ReactNode; args: TArgs }): ReactNode {
  return render(args);
}
