import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import ReferrerChart from '../ReferrerChart';
import type { ReferrerItem } from '@/types/api';

const data: ReferrerItem[] = [
  { domain: 'google.com', views: 300 },
  { domain: 'twitter.com', views: 150 },
];

describe('ReferrerChart', () => {
  it('renders empty state when no data', () => {
    renderWithProviders(<ReferrerChart data={[]} />);
    expect(screen.getByText('No data for this period')).toBeInTheDocument();
  });

  it('renders recharts container when data is present', () => {
    const { container } = renderWithProviders(
      <ReferrerChart data={data} />,
    );
    expect(
      container.querySelector('.recharts-responsive-container'),
    ).toBeInTheDocument();
  });
});
