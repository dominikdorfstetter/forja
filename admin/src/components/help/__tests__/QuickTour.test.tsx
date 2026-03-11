import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import QuickTour from '../QuickTour';

const mockOnComplete = vi.fn();

describe('QuickTour', () => {
  let tourElements: HTMLElement[];

  beforeEach(() => {
    mockOnComplete.mockClear();

    // Create mock DOM elements with data-tour attributes
    tourElements = [
      'dashboard-stats',
      'sidebar-nav',
      'site-selector',
      'command-palette',
      'help-menu',
    ].map((id) => {
      const el = document.createElement('div');
      el.setAttribute('data-tour', id);
      el.style.position = 'absolute';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100px';
      el.style.height = '50px';
      document.body.appendChild(el);
      return el;
    });
  });

  afterEach(() => {
    tourElements.forEach((el) => el.remove());
  });

  it('renders first step text when active and a target element exists', () => {
    renderWithProviders(
      <QuickTour active={true} onComplete={mockOnComplete} />,
    );

    expect(
      screen.getByText(
        "This is your dashboard — see your site's activity at a glance",
      ),
    ).toBeInTheDocument();
  });

  it('does not render when active is false', () => {
    renderWithProviders(
      <QuickTour active={false} onComplete={mockOnComplete} />,
    );

    expect(
      screen.queryByText(
        "This is your dashboard — see your site's activity at a glance",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Skip tour')).not.toBeInTheDocument();
  });

  it('shows step indicator', () => {
    renderWithProviders(
      <QuickTour active={true} onComplete={mockOnComplete} />,
    );

    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });

  it('calls onComplete when "Skip tour" is clicked', () => {
    renderWithProviders(
      <QuickTour active={true} onComplete={mockOnComplete} />,
    );

    fireEvent.click(screen.getByText('Skip tour'));
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });
});
