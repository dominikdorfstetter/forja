import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput';

describe('TagInput', () => {
  const defaultProps = {
    tags: ['landscape', 'hero'],
    onChange: vi.fn(),
  };

  it('renders existing tags as chips', () => {
    render(<TagInput {...defaultProps} />);
    expect(screen.getByText('landscape')).toBeInTheDocument();
    expect(screen.getByText('hero')).toBeInTheDocument();
  });

  it('adds a tag on Enter', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['landscape']} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, 'nature{Enter}');
    expect(onChange).toHaveBeenCalledWith(['landscape', 'nature']);
  });

  it('adds a tag on comma', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, 'blog,');
    expect(onChange).toHaveBeenCalledWith(['blog']);
  });

  it('removes a tag when delete icon clicked', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['landscape', 'hero']} onChange={onChange} />);
    const deleteButtons = screen.getAllByTestId('tag-delete');
    await userEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledWith(['hero']);
  });

  it('normalizes tags to lowercase and trims whitespace', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, '  Hero  {Enter}');
    expect(onChange).toHaveBeenCalledWith(['hero']);
  });

  it('prevents duplicate tags', async () => {
    const onChange = vi.fn();
    render(<TagInput tags={['hero']} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add tag/i);
    await userEvent.type(input, 'hero{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables input when disabled prop is true', () => {
    render(<TagInput {...defaultProps} disabled />);
    const input = screen.getByPlaceholderText(/add tag/i);
    expect(input).toBeDisabled();
  });
});
