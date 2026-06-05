import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getMediaById } from '@/services/media';
import SocialPreview from '../SocialPreview';

const mockMedia = {
  id: 'media-cover',
  filename: 'cover.jpg',
  original_filename: 'cover.jpg',
  mime_type: 'image/jpeg',
  file_size: 2048,
  storage_provider: 'Local' as const,
  public_url: 'https://cdn.example.com/cover.jpg',
  is_global: false,
  focal_x: 0.5,
  focal_y: 0.5,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  variants: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SocialPreview', () => {
  it('renders title, description, domain and image when all fields populated (tracer)', async () => {
    vi.mocked(getMediaById).mockResolvedValue(mockMedia);

    renderWithProviders(
      <SocialPreview
        title="My great post"
        description="A short description of the post."
        coverImageId="media-cover"
        baseUrl="https://blog.example.com"
      />,
    );

    expect(screen.getByText('My great post')).toBeInTheDocument();
    expect(screen.getByText('A short description of the post.')).toBeInTheDocument();
    expect(screen.getByText(/blog\.example\.com/i)).toBeInTheDocument();

    await waitFor(() => {
      const img = screen.getByRole('img', { name: /my great post/i });
      expect(img.getAttribute('src')).toBe('https://cdn.example.com/cover.jpg');
    });
  });

  it('renders placeholder area when no cover image is set', () => {
    renderWithProviders(
      <SocialPreview
        title="Post"
        description="desc"
        coverImageId={null}
        baseUrl="https://blog.example.com"
      />,
    );

    expect(screen.getByTestId('social-preview-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('truncates title past 60 chars with an ellipsis', () => {
    const longTitle = 'A'.repeat(80);
    renderWithProviders(
      <SocialPreview title={longTitle} description="x" coverImageId={null} baseUrl="https://x.com" />,
    );

    const titleEl = screen.getByTestId('social-preview-title');
    expect(titleEl.textContent).toBe('A'.repeat(60) + '…');
  });

  it('truncates description past 160 chars with an ellipsis', () => {
    const longDesc = 'B'.repeat(200);
    renderWithProviders(
      <SocialPreview title="x" description={longDesc} coverImageId={null} baseUrl="https://x.com" />,
    );

    const descEl = screen.getByTestId('social-preview-description');
    expect(descEl.textContent).toBe('B'.repeat(160) + '…');
  });

  it('shows truncation warning chip when title exceeds 60 chars', () => {
    renderWithProviders(
      <SocialPreview
        title={'A'.repeat(80)}
        description="x"
        coverImageId={null}
        baseUrl="https://x.com"
      />,
    );

    expect(screen.getByTestId('social-preview-title-warning')).toBeInTheDocument();
  });

  it('shows truncation warning chip when description exceeds 160 chars', () => {
    renderWithProviders(
      <SocialPreview
        title="x"
        description={'B'.repeat(200)}
        coverImageId={null}
        baseUrl="https://x.com"
      />,
    );

    expect(screen.getByTestId('social-preview-description-warning')).toBeInTheDocument();
  });

  it('does NOT show warnings when fields are within limits', () => {
    renderWithProviders(
      <SocialPreview
        title={'A'.repeat(60)}
        description={'B'.repeat(160)}
        coverImageId={null}
        baseUrl="https://x.com"
      />,
    );

    expect(screen.queryByTestId('social-preview-title-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('social-preview-description-warning')).not.toBeInTheDocument();
  });

  it('falls back to "example.com" when no base_url is provided', () => {
    renderWithProviders(
      <SocialPreview title="x" description="y" coverImageId={null} baseUrl={null} />,
    );

    expect(screen.getByTestId('social-preview-domain').textContent).toBe('example.com');
  });

  it('strips protocol and trailing slash from base_url for the domain line', () => {
    renderWithProviders(
      <SocialPreview
        title="x"
        description="y"
        coverImageId={null}
        baseUrl="https://blog.example.com/"
      />,
    );

    expect(screen.getByTestId('social-preview-domain').textContent).toBe('blog.example.com');
  });
});
