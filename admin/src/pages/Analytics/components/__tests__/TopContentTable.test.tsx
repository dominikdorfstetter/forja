import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import TopContentTable from '../TopContentTable';
import type { TopContentItem } from '@/types/api';

const items: TopContentItem[] = [
  { path: '/blog/hello', total_views: 500, unique_visitors: 300 },
  { path: '/about', total_views: 200, unique_visitors: 150 },
];

describe('TopContentTable', () => {
  it('renders all content items with path, views, visitors', () => {
    renderWithProviders(
      <TopContentTable items={items} onRowClick={vi.fn()} />,
    );

    expect(screen.getByText('/blog/hello')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('/about')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('calls onRowClick with path when a row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderWithProviders(
      <TopContentTable items={items} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText('/blog/hello'));
    expect(onRowClick).toHaveBeenCalledWith('/blog/hello');
  });

  it('renders empty state when no items', () => {
    renderWithProviders(
      <TopContentTable items={[]} onRowClick={vi.fn()} />,
    );

    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });
});
