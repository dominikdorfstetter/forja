import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import MediaUploadDialog from '../MediaUploadDialog';

function fileOf(name: string, type: string, size = 10): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function pick(file: File) {
  fireEvent.change(screen.getByTestId('media-upload-input'), { target: { files: [file] } });
}

describe('MediaUploadDialog', () => {
  it('rejects files over 50 MB', async () => {
    renderWithProviders(<MediaUploadDialog open onSubmit={vi.fn()} onClose={vi.fn()} />);
    pick(fileOf('huge.png', 'image/png', 50 * 1024 * 1024 + 1));
    expect(await screen.findByText('File exceeds maximum size of 50.0 MB')).toBeInTheDocument();
  });

  it('rejects unsupported MIME types', async () => {
    renderWithProviders(<MediaUploadDialog open onSubmit={vi.fn()} onClose={vi.fn()} />);
    pick(fileOf('app.exe', 'application/x-msdownload'));
    expect(await screen.findByText('File type not supported')).toBeInTheDocument();
  });

  it('uploads an accepted file with the global flag', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<MediaUploadDialog open onSubmit={onSubmit} onClose={vi.fn()} />);

    const file = fileOf('notes.pdf', 'application/pdf');
    pick(file);
    expect(await screen.findByText('notes.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(file, true));
  });
});
