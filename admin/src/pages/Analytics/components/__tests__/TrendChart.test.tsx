import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import TrendChart from '../TrendChart';
import type { TrendDataPoint } from '@/types/api';

const sampleData: TrendDataPoint[] = [
  { date: '2025-06-01', total_views: 100, unique_visitors: 80 },
  { date: '2025-06-02', total_views: 150, unique_visitors: 120 },
];

describe('TrendChart', () => {
  it('renders empty state when data is empty', () => {
    renderWithProviders(<TrendChart data={[]} />);
    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });

  it('renders recharts container when data is present', () => {
    const { container } = renderWithProviders(
      <TrendChart data={sampleData} />,
    );
    expect(
      container.querySelector('.recharts-responsive-container'),
    ).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    const { container } = renderWithProviders(
      <TrendChart data={[]} loading />,
    );
    expect(
      container.querySelector('.MuiSkeleton-root'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No data for this period'),
    ).not.toBeInTheDocument();
  });
});
