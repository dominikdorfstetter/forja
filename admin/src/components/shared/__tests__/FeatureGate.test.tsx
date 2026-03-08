import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeatureGate from '../FeatureGate';
import type { SiteContextFeatures } from '@/types/api';

const defaultFeatures: SiteContextFeatures = {
  editorial_workflow: false,
  scheduling: true,
  versioning: true,
  analytics: false,
};

let mockFeatures = { ...defaultFeatures };

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    context: {
      member_count: 1,
      current_user_role: 'admin',
      features: mockFeatures,
      suggestions: { show_team_workflow_prompt: false },
      modules: { blog: true, pages: true, cv: false, legal: false, documents: false, ai: false },
    },
    modules: { blog: true, pages: true, cv: false, legal: false, documents: false, ai: false },
  }),
}));

describe('FeatureGate', () => {
  it('renders children when feature is enabled', () => {
    mockFeatures = { ...defaultFeatures, editorial_workflow: true };

    render(
      <FeatureGate feature="editorial_workflow">
        <span>Workflow Content</span>
      </FeatureGate>,
    );

    expect(screen.getByText('Workflow Content')).toBeInTheDocument();
  });

  it('hides children when feature is disabled', () => {
    mockFeatures = { ...defaultFeatures, editorial_workflow: false };

    render(
      <FeatureGate feature="editorial_workflow">
        <span>Workflow Content</span>
      </FeatureGate>,
    );

    expect(screen.queryByText('Workflow Content')).not.toBeInTheDocument();
  });

  it('renders fallback when feature is disabled', () => {
    mockFeatures = { ...defaultFeatures, analytics: false };

    render(
      <FeatureGate feature="analytics" fallback={<span>Not Available</span>}>
        <span>Analytics Dashboard</span>
      </FeatureGate>,
    );

    expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Not Available')).toBeInTheDocument();
  });

  it('renders children for an enabled feature (scheduling)', () => {
    mockFeatures = { ...defaultFeatures, scheduling: true };

    render(
      <FeatureGate feature="scheduling">
        <span>Schedule Content</span>
      </FeatureGate>,
    );

    expect(screen.getByText('Schedule Content')).toBeInTheDocument();
  });
});
