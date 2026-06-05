import { Box } from '@mui/material';
import type { SiteTagItem } from '@/types/api';
import { Chip, Icon } from '@/components/design-system';

interface MediaTagFilterProps {
  tags: SiteTagItem[];
  activeTags: string[];
  onToggle: (tag: string) => void;
  /** When true and tags is empty, render a skeleton row so the chip
   *  strip doesn't disappear on initial load / refetch. */
  loading?: boolean;
}

/**
 * Tag filter strip. Reserves space while tags are loading so the layout
 * doesn't jump when the query resolves. Once loaded, chips use the
 * canonical design-system Chip so they share the pill vocabulary with
 * the MIME filter and the workbench focus-feed chips.
 */
export default function MediaTagFilter({ tags, activeTags, onToggle, loading = false }: MediaTagFilterProps) {
  const hasTags = tags.length > 0;
  if (!hasTags && !loading) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.75,
        flexWrap: 'wrap',
        alignItems: 'center',
        py: 1,
        mb: 0.5,
      }}
      data-testid="media-tag-filter"
    >
      <Icon name="sell" size={16} color="var(--on-surface-variant)" />
      {hasTags
        ? tags.map(({ tag, count }) => (
            <Chip
              key={tag}
              active={activeTags.includes(tag)}
              count={count}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </Chip>
          ))
        : // Skeleton placeholders while the tags query is resolving — 4
          // stub pills of varying widths so the strip occupies the same
          // vertical space it will once the tags arrive.
          [64, 88, 76, 96].map((w) => (
            <Box
              key={`skeleton-${w}`}
              sx={{
                height: 34,
                width: w,
                borderRadius: 999,
                bgcolor: 'var(--surface-container-high)',
                opacity: 0.5,
                animation: 'var(--motion-shape-morph)',
              }}
            />
          ))}
    </Box>
  );
}
