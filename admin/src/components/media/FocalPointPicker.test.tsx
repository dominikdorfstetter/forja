import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import FocalPointPicker from './FocalPointPicker';

const defaultProps = {
  src: 'https://cdn.example.com/image.jpg',
  focalX: 0.5,
  focalY: 0.5,
  onSave: vi.fn(),
};

describe('FocalPointPicker', () => {
  it('renders the image and crosshair', () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} />);
    expect(screen.getByTestId('focal-point-picker')).toBeInTheDocument();
    expect(screen.getByTestId('focal-point-crosshair')).toBeInTheDocument();
  });

  it('does not show save button when focal point has not changed', () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} />);
    expect(screen.queryByTestId('focal-point-save')).not.toBeInTheDocument();
  });

  it('shows save button after moving the focal point', async () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} />);
    const picker = screen.getByTestId('focal-point-picker');
    picker.focus();
    await userEvent.setup().keyboard('{ArrowLeft}');
    // After nudge, local state differs from server value → save button appears
    expect(screen.getByTestId('focal-point-save')).toBeInTheDocument();
  });

  it('does not call onSave on nudge — only on save button', async () => {
    const onSave = vi.fn();
    renderWithProviders(<FocalPointPicker {...defaultProps} onSave={onSave} />);
    const picker = screen.getByTestId('focal-point-picker');
    picker.focus();
    await userEvent.setup().keyboard('{ArrowRight}');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', async () => {
    const onSave = vi.fn();
    renderWithProviders(<FocalPointPicker {...defaultProps} focalX={0.5} focalY={0.5} onSave={onSave} />);

    const picker = screen.getByTestId('focal-point-picker');
    const user = userEvent.setup();

    // Nudge with keyboard to create a dirty state
    picker.focus();
    await user.keyboard('{ArrowRight}');

    const saveBtn = screen.getByTestId('focal-point-save');
    await user.click(saveBtn);
    expect(onSave).toHaveBeenCalledWith(0.51, 0.5);
  });

  it('does not show reset button when focal point is at center', () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} focalX={0.5} focalY={0.5} />);
    expect(screen.queryByTestId('focal-point-reset')).not.toBeInTheDocument();
  });

  it('shows reset button when focal point is off-center', () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} focalX={0.3} focalY={0.7} />);
    expect(screen.getByTestId('focal-point-reset')).toBeInTheDocument();
  });

  it('resets crosshair to center and shows save button when reset is clicked', async () => {
    const onSave = vi.fn();
    renderWithProviders(<FocalPointPicker {...defaultProps} focalX={0.2} focalY={0.8} onSave={onSave} />);

    const resetBtn = screen.getByTestId('focal-point-reset');
    await userEvent.setup().click(resetBtn);

    // Reset moves to center locally — onSave is NOT called yet
    expect(onSave).not.toHaveBeenCalled();
    // Save button should now appear (dirty: local 0.5,0.5 != server 0.2,0.8)
    expect(screen.getByTestId('focal-point-save')).toBeInTheDocument();
  });

  it('nudges focal point with arrow keys', async () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} focalX={0.5} focalY={0.5} />);

    const picker = screen.getByTestId('focal-point-picker');
    picker.focus();

    await userEvent.setup().keyboard('{ArrowRight}');
    // Save button should appear since local state changed
    expect(screen.getByTestId('focal-point-save')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    renderWithProviders(<FocalPointPicker {...defaultProps} />);
    const picker = screen.getByTestId('focal-point-picker');
    expect(picker).toHaveAttribute('role', 'application');
    expect(picker).toHaveAttribute('tabindex', '0');
  });

});
