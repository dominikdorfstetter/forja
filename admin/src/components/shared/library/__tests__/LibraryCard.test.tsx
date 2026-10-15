import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LibraryCard } from '../LibraryCard';

function renderCard(overrides: Partial<React.ComponentProps<typeof LibraryCard>> = {}) {
  const props = {
    testId: 'card',
    selected: false,
    previewLayout: 'tile' as const,
    preview: <span>preview</span>,
    title: 'report.pdf',
    subtitle: '1.0 KB',
    ...overrides,
  };
  render(<LibraryCard {...props} />);
  return props;
}

describe('LibraryCard', () => {
  it('renders the caption with the full title as a tooltip', () => {
    renderCard();
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTitle('report.pdf')).toHaveTextContent('report.pdf');
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('omits the optional badge, checkbox and action strip by default', () => {
    renderCard();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('badge')).not.toBeInTheDocument();
  });

  it('shows the badge and the actions when given', () => {
    renderCard({ badge: <span>badge</span>, actions: <button type="button">edit</button> });
    expect(screen.getByText('badge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'edit' })).toBeInTheDocument();
  });

  it('toggles selection from the checkbox without triggering the card click', () => {
    const onToggleSelect = vi.fn();
    const onClick = vi.fn();
    renderCard({ onToggleSelect, onClick, selected: true });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps action clicks from bubbling to the card', () => {
    const onClick = vi.fn();
    renderCard({ onClick, actions: <button type="button">edit</button> });
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
