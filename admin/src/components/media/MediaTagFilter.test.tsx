import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MediaTagFilter from './MediaTagFilter';

describe('MediaTagFilter', () => {
  const tags = [
    { tag: 'landscape', count: 10 },
    { tag: 'hero', count: 5 },
    { tag: 'blog', count: 3 },
  ];

  it('renders tag chips with counts', () => {
    render(<MediaTagFilter tags={tags} activeTags={[]} onToggle={vi.fn()} />);
    // Label and count render as separate nodes with the design-system Chip.
    expect(screen.getByText('landscape')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('blog')).toBeInTheDocument();
  });

  it('calls onToggle when a chip is clicked', async () => {
    const onToggle = vi.fn();
    render(<MediaTagFilter tags={tags} activeTags={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByText('landscape'));
    expect(onToggle).toHaveBeenCalledWith('landscape');
  });

  it('highlights active tag chips via aria-pressed', () => {
    render(<MediaTagFilter tags={tags} activeTags={['hero']} onToggle={vi.fn()} />);
    const heroButton = screen.getByText('hero').closest('button');
    expect(heroButton).toHaveAttribute('aria-pressed', 'true');
    const landscapeButton = screen.getByText('landscape').closest('button');
    expect(landscapeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders nothing when tags array is empty and not loading', () => {
    const { container } = render(<MediaTagFilter tags={[]} activeTags={[]} onToggle={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('reserves space with skeletons while tags are loading', () => {
    render(<MediaTagFilter tags={[]} activeTags={[]} onToggle={vi.fn()} loading />);
    expect(screen.getByTestId('media-tag-filter')).toBeInTheDocument();
  });
});
