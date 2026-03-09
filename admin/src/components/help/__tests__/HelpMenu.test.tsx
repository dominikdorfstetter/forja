import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import HelpMenu from '../HelpMenu';

// Mock useHelpState to control tour behavior
const mockStartTour = vi.fn();
vi.mock('@/store/HelpStateContext', () => ({
  useHelpState: () => ({
    state: { tour_completed: false, hotspots_seen: [], field_help_seen: [] },
    isLoading: false,
    tourActive: false,
    startTour: mockStartTour,
    completeTour: vi.fn(),
    resetTour: vi.fn(),
    dismissHotspot: vi.fn(),
    dismissFieldHelp: vi.fn(),
    isHotspotSeen: () => false,
    isFieldHelpSeen: () => false,
  }),
}));

describe('HelpMenu', () => {
  it('renders the help button', () => {
    renderWithProviders(<HelpMenu />);
    expect(screen.getByLabelText('Help & Resources')).toBeInTheDocument();
  });

  it('opens menu on click', () => {
    renderWithProviders(<HelpMenu />);
    fireEvent.click(screen.getByLabelText('Help & Resources'));
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Quick tour')).toBeInTheDocument();
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('calls startTour when quick tour is clicked', () => {
    renderWithProviders(<HelpMenu />);
    fireEvent.click(screen.getByLabelText('Help & Resources'));
    fireEvent.click(screen.getByText('Quick tour'));
    expect(mockStartTour).toHaveBeenCalled();
  });

  it('opens keyboard shortcuts dialog', () => {
    renderWithProviders(<HelpMenu />);
    fireEvent.click(screen.getByLabelText('Help & Resources'));
    fireEvent.click(screen.getByText('Keyboard shortcuts'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Open command palette')).toBeInTheDocument();
  });
});
