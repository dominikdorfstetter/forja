import { Icon } from './Icon';

export type DocType = 'blog' | 'page' | 'asset' | 'legal' | 'portfolio';

const TYPE_MAP: Record<DocType, { color: string; icon: string }> = {
  blog: { color: '#b8a4ff', icon: 'article' },
  page: { color: '#8ec5ff', icon: 'description' },
  asset: { color: '#ffc98a', icon: 'image' },
  legal: { color: '#ff9e9e', icon: 'gavel' },
  portfolio: { color: '#7edac6', icon: 'collections_bookmark' },
};

export interface DocIconProps {
  type: DocType;
  size?: number;
}

/**
 * Colored type marker used in list rows and grid tiles to make content kind
 * recognisable at a glance. The background alpha matches the design spec
 * (`color + '26'` = 15% opacity).
 */
export function DocIcon({ type, size = 20 }: DocIconProps) {
  const t = TYPE_MAP[type];

  return (
    <div
      aria-hidden="true"
      style={{
        width: size + 6,
        height: size + 6,
        borderRadius: 8,
        background: t.color + '26',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={t.icon} size={size * 0.75} color={t.color} />
    </div>
  );
}
