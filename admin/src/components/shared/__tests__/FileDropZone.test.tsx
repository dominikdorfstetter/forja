import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FileDropZone, { DropZoneFileContent } from '../FileDropZone';

function renderZone(overrides: Partial<React.ComponentProps<typeof FileDropZone>> = {}) {
  const props = {
    onFile: vi.fn(),
    dragOver: false,
    onDragOverChange: vi.fn(),
    hasError: false,
    padding: 3,
    inputTestId: 'zone-input',
    dropZoneTestId: 'zone',
    children: <span>drop here</span>,
    ...overrides,
  };
  render(<FileDropZone {...props} />);
  return props;
}

const file = new File(['x'], 'a.png', { type: 'image/png' });

describe('FileDropZone', () => {
  it('hands a dropped file to onFile and ends the drag-over state', () => {
    const props = renderZone();
    const zone = screen.getByTestId('zone');

    fireEvent.dragOver(zone);
    expect(props.onDragOverChange).toHaveBeenLastCalledWith(true);

    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(props.onDragOverChange).toHaveBeenLastCalledWith(false);
    expect(props.onFile).toHaveBeenCalledWith(file);
  });

  it('hands a picked file to onFile and clears the input for re-picks', () => {
    const props = renderZone();
    const input = screen.getByTestId('zone-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(props.onFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it('opens the file picker on click unless disabled', () => {
    renderZone();
    const input = screen.getByTestId('zone-input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('zone'));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('does not open the file picker while disabled', () => {
    renderZone({ disabled: true });
    const input = screen.getByTestId('zone-input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('zone'));
    expect(click).not.toHaveBeenCalled();
  });

  it('labels the hidden input for assistive tech', () => {
    renderZone();
    expect(screen.getByTestId('zone-input')).toHaveAttribute('aria-label');
  });
});

describe('DropZoneFileContent', () => {
  it('prompts for a file when none is picked', () => {
    render(<DropZoneFileContent file={null} dragOver={false} previewMaxHeight={120} />);
    expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
  });

  it('summarises the picked file', () => {
    const pdf = new File(['x'.repeat(2048)], 'report.pdf', { type: 'application/pdf' });
    render(<DropZoneFileContent file={pdf} dragOver={false} previewMaxHeight={120} />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf/)).toBeInTheDocument();
  });
});
