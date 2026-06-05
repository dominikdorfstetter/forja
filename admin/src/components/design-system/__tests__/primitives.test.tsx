import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Icon,
  StatusPill,
  DocIcon,
  Kbd,
  Chip,
  Ring,
  SegmentedBar,
  Sparkline,
  Avatar,
  M3IconButton,
  M3Button,
} from '../index';

describe('design-system primitives', () => {
  describe('Icon', () => {
    it('renders the ligature name as text', () => {
      render(<Icon name="home" />);
      expect(screen.getByText('home')).toBeInTheDocument();
    });

    it('defaults to aria-hidden when no label is provided', () => {
      const { container } = render(<Icon name="home" />);
      expect(container.querySelector('.material-symbols-rounded')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('exposes a role and label when ariaLabel is set', () => {
      render(<Icon name="settings" ariaLabel="Open settings" />);
      const el = screen.getByRole('img', { name: 'Open settings' });
      expect(el).toBeInTheDocument();
    });

    it("toggles the FILL axis when filled", () => {
      const { container } = render(<Icon name="star" filled />);
      const el = container.querySelector('.material-symbols-rounded') as HTMLElement;
      expect(el.style.fontVariationSettings).toContain("'FILL' 1");
    });
  });

  describe('StatusPill', () => {
    it('renders the localized label for each status', () => {
      render(<StatusPill status="Published" />);
      expect(screen.getByLabelText('Published')).toBeInTheDocument();
    });

    it('omits the dot when withDot is false', () => {
      const { container } = render(<StatusPill status="Draft" withDot={false} />);
      expect(container.querySelectorAll('span').length).toBe(1);
    });

    it('uses smaller padding and font when size=sm', () => {
      const { container } = render(<StatusPill status="InReview" size="sm" />);
      const pill = container.firstElementChild as HTMLElement;
      expect(pill.style.padding).toBe('2px 8px');
      expect(pill.style.fontSize).toBe('11px');
    });
  });

  describe('DocIcon', () => {
    it('renders a blog marker with its icon', () => {
      render(<DocIcon type="blog" />);
      expect(screen.getByText('article')).toBeInTheDocument();
    });

    it('renders a legal marker with its icon', () => {
      render(<DocIcon type="legal" />);
      expect(screen.getByText('gavel')).toBeInTheDocument();
    });

    it('scales with the size prop', () => {
      const { container } = render(<DocIcon type="page" size={24} />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.style.width).toBe('30px');
      expect(wrapper.style.height).toBe('30px');
    });
  });

  describe('Kbd', () => {
    it('renders children inside a <kbd> element', () => {
      render(<Kbd>⌘K</Kbd>);
      const el = screen.getByText('⌘K');
      expect(el.tagName.toLowerCase()).toBe('kbd');
    });
  });

  describe('Chip', () => {
    it('reflects active state via aria-pressed', () => {
      const { rerender } = render(<Chip>Drafts</Chip>);
      expect(screen.getByRole('button', { name: /Drafts/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      rerender(<Chip active>Drafts</Chip>);
      expect(screen.getByRole('button', { name: /Drafts/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('renders the count badge when count is supplied', () => {
      render(<Chip count={7}>Drafts</Chip>);
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('invokes onClick when pressed', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Chip onClick={onClick}>Filter</Chip>);
      await user.click(screen.getByRole('button', { name: /Filter/ }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ring', () => {
    it('exposes an accessible label when provided', () => {
      render(<Ring value={3} max={10} label="3 of 10 published" />);
      expect(screen.getByRole('img', { name: '3 of 10 published' })).toBeInTheDocument();
    });

    it('clamps values outside [0, max]', () => {
      const { container } = render(<Ring value={-5} max={10} />);
      // Negative value clamps to 0 → offset equals full circumference (no fill)
      const circles = container.querySelectorAll('circle');
      const fill = circles[1] as SVGCircleElement;
      const dashArray = parseFloat(fill.getAttribute('stroke-dasharray') || '0');
      const dashOffset = parseFloat(fill.getAttribute('stroke-dashoffset') || '0');
      expect(dashOffset).toBeCloseTo(dashArray, 1);
    });
  });

  describe('SegmentedBar', () => {
    it('sizes each segment proportionally to its value', () => {
      const { container } = render(
        <SegmentedBar
          segments={[
            { value: 3, color: '#111', label: 'a' },
            { value: 1, color: '#222', label: 'b' },
          ]}
        />,
      );
      const children = container.firstElementChild!.children;
      expect((children[0] as HTMLElement).style.flex).toBe('0.75 1 0%');
      expect((children[1] as HTMLElement).style.flex).toBe('0.25 1 0%');
    });

    it('handles an all-zero input without dividing by zero', () => {
      const { container } = render(
        <SegmentedBar
          segments={[
            { value: 0, color: '#111', label: 'a' },
            { value: 0, color: '#222', label: 'b' },
          ]}
        />,
      );
      expect(container.firstElementChild).toBeInTheDocument();
    });
  });

  describe('Sparkline', () => {
    it('renders nothing for empty or single-point data', () => {
      const { container: c1 } = render(<Sparkline data={[]} />);
      expect(c1.firstElementChild).toBeNull();
      const { container: c2 } = render(<Sparkline data={[1]} />);
      expect(c2.firstElementChild).toBeNull();
    });

    it('renders a polyline + area polygon for multi-point data', () => {
      const { container } = render(<Sparkline data={[1, 2, 3, 4]} />);
      expect(container.querySelector('polyline')).toBeInTheDocument();
      expect(container.querySelector('polygon')).toBeInTheDocument();
    });

    it('exposes aria-label as an image when provided', () => {
      render(<Sparkline data={[1, 2, 3]} ariaLabel="Trend over 3 days" />);
      expect(screen.getByRole('img', { name: 'Trend over 3 days' })).toBeInTheDocument();
    });
  });

  describe('Avatar', () => {
    it('displays two-letter initials', () => {
      render(<Avatar name="John Forja" />);
      expect(screen.getByText('JF')).toBeInTheDocument();
    });

    it('falls back to a question mark for blank names', () => {
      render(<Avatar name="" />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('uses the accessible name for screen readers', () => {
      render(<Avatar name="Ana Ribeiro" />);
      expect(screen.getByRole('img', { name: 'Ana Ribeiro' })).toBeInTheDocument();
    });
  });

  describe('M3IconButton', () => {
    it('morphs radius from pill to squircle when active', () => {
      const { rerender, container } = render(<M3IconButton name="home" />);
      const btn = container.querySelector('button') as HTMLButtonElement;
      expect(btn.style.borderRadius).toBe('999px');
      rerender(<M3IconButton name="home" active />);
      expect(btn.style.borderRadius).toBe('14px');
    });

    it('reports active via aria-pressed', () => {
      render(<M3IconButton name="star" active ariaLabel="Favorite" />);
      expect(screen.getByRole('button', { name: 'Favorite' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('does not fire onClick when disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<M3IconButton name="home" disabled onClick={onClick} ariaLabel="Home" />);
      await user.click(screen.getByRole('button', { name: 'Home' }));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('shows an in-app tooltip on hover (not a native title attribute)', async () => {
      const user = userEvent.setup();
      render(<M3IconButton name="download" tooltip="View" />);
      const btn = screen.getByRole('button', { name: 'View' });
      // Native title would let screen readers double-announce and gives the
      // slow OS tooltip we are replacing — assert it is gone.
      expect(btn).not.toHaveAttribute('title');
      await user.hover(btn);
      expect(await screen.findByRole('tooltip', { name: 'View' })).toBeInTheDocument();
    });
  });

  describe('M3Button', () => {
    it('renders the label', () => {
      render(<M3Button>Create</M3Button>);
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });

    it('renders leading and trailing icons when provided', () => {
      render(
        <M3Button icon="add" iconEnd="chevron_right">
          Create
        </M3Button>,
      );
      expect(screen.getByText('add')).toBeInTheDocument();
      expect(screen.getByText('chevron_right')).toBeInTheDocument();
    });

    it('honours the disabled prop', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <M3Button disabled onClick={onClick}>
          Create
        </M3Button>,
      );
      await user.click(screen.getByRole('button', { name: 'Create' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
