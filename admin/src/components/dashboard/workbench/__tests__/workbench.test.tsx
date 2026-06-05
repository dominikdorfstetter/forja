import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import en from '@/i18n/locales/en.json';
import { renderWithProviders } from '@/test/test-utils';
import type { HealthResponse } from '@/types/api';
import {
  FocusCards,
  HealthStrip,
  AnalyticsStrip,
  WorkbenchFeed,
} from '../index';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
}

function wrap(ui: React.ReactElement) {
  // renderWithProviders already wraps with MemoryRouter + QueryClient; just
  // layer in the i18n provider so string lookups resolve.
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('FocusCards', () => {
  it('renders three cards with the supplied counts', () => {
    renderWithProviders(
      wrap(
        <FocusCards
          needsReviewCount={5}
          draftsCount={12}
          scheduledCount={2}
          onFilterChange={() => {}}
        />,
      ),
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onFilterChange with the right kind when a card is clicked', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderWithProviders(
      wrap(
        <FocusCards
          needsReviewCount={3}
          draftsCount={0}
          scheduledCount={0}
          onFilterChange={onFilterChange}
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: /Needs your review/ }));
    expect(onFilterChange).toHaveBeenCalledWith('review');
  });

  it('reflects active filter via aria-pressed', () => {
    renderWithProviders(
      wrap(
        <FocusCards
          needsReviewCount={1}
          draftsCount={0}
          scheduledCount={0}
          onFilterChange={() => {}}
          activeFilter="review"
        />,
      ),
    );
    const card = screen.getByRole('button', { name: /Needs your review/ });
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('HealthStrip', () => {
  const healthyData: HealthResponse = {
    status: 'healthy',
    version: '1.3.0',
    services: [
      { name: 'database', status: 'up', latency_ms: 12 },
      { name: 'redis', status: 'up', latency_ms: 3 },
    ],
  };

  it('shows "All systems healthy" when status is healthy', () => {
    renderWithProviders(wrap(<HealthStrip healthData={healthyData} loading={false} />));
    expect(screen.getByText('All systems healthy')).toBeInTheDocument();
  });

  it('renders the version with v prefix', () => {
    renderWithProviders(wrap(<HealthStrip healthData={healthyData} loading={false} />));
    expect(screen.getByText('v1.3.0')).toBeInTheDocument();
  });

  it('shows service names capitalized and joined', () => {
    renderWithProviders(wrap(<HealthStrip healthData={healthyData} loading={false} />));
    expect(screen.getByText('Database · Redis')).toBeInTheDocument();
  });

  it('shows degraded state when status is not healthy', () => {
    const degraded: HealthResponse = {
      status: 'degraded',
      services: [{ name: 'redis', status: 'down' }],
    };
    renderWithProviders(wrap(<HealthStrip healthData={degraded} loading={false} />));
    expect(screen.getByText('Service degraded')).toBeInTheDocument();
  });

  it('shows checking state while loading', () => {
    renderWithProviders(wrap(<HealthStrip healthData={undefined} loading={true} />));
    expect(screen.getByText('Checking services…')).toBeInTheDocument();
  });
});

describe('AnalyticsStrip', () => {
  it('shows "Analytics unavailable" when no data is supplied', () => {
    renderWithProviders(wrap(<AnalyticsStrip />));
    expect(screen.getByText('Analytics unavailable')).toBeInTheDocument();
  });

  it('renders total views and sparkline when data is present', () => {
    const { container } = renderWithProviders(
      wrap(
        <AnalyticsStrip
          totalViews={34820}
          deltaPercent={18}
          trendData={[1, 2, 3, 4, 5]}
        />,
      ),
    );
    expect(screen.getByText(/34820 page views|34,820 page views/)).toBeInTheDocument();
    expect(container.querySelector('svg polyline')).toBeInTheDocument();
  });
});

describe('WorkbenchFeed', () => {
  const empty = {
    Draft: 0,
    InReview: 0,
    Scheduled: 0,
    Published: 0,
    Archived: 0,
  };

  it('shows the empty "All caught up" state when no items', () => {
    renderWithProviders(
      wrap(
        <WorkbenchFeed
          inReviewBlogs={[]}
          inReviewPages={[]}
          draftBlogs={[]}
          draftPages={[]}
          blogStatusCounts={empty}
          pageStatusCounts={empty}
          filter="attention"
          onFilterChange={() => {}}
        />,
      ),
    );
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });

  it('fires onFilterChange when a chip is clicked', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderWithProviders(
      wrap(
        <WorkbenchFeed
          inReviewBlogs={[]}
          inReviewPages={[]}
          draftBlogs={[]}
          draftPages={[]}
          blogStatusCounts={empty}
          pageStatusCounts={empty}
          filter="attention"
          onFilterChange={onFilterChange}
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: /Drafts/ }));
    expect(onFilterChange).toHaveBeenCalledWith('drafts');
  });
});
