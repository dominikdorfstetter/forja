import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { useForm, FormProvider } from 'react-hook-form';
import apiService from '@/services/api';
import type { BlogContentFormData } from '../blogDetailSchema';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/media/MediaPickerDialog', () => ({
  default: () => null,
}));

let BlogMediaSection: typeof import('../BlogMediaSection').default;

// Wrapper that provides react-hook-form context
function FormWrapper({
  defaults,
  children,
}: {
  defaults: Partial<BlogContentFormData>;
  children: (props: {
    control: ReturnType<typeof useForm<BlogContentFormData>>['control'];
    watch: ReturnType<typeof useForm<BlogContentFormData>>['watch'];
    setValue: ReturnType<typeof useForm<BlogContentFormData>>['setValue'];
  }) => React.ReactNode;
}) {
  const methods = useForm<BlogContentFormData>({
    defaultValues: {
      title: '',
      subtitle: '',
      excerpt: '',
      body: '',
      meta_title: '',
      meta_description: '',
      author: 'author-1',
      published_date: '2025-01-01',
      status: 'Draft',
      is_featured: false,
      allow_comments: false,
      cover_image_id: null,
      header_image_id: null,
      ...defaults,
    },
  });

  return (
    <FormProvider {...methods}>
      {children({
        control: methods.control,
        watch: methods.watch,
        setValue: methods.setValue,
      })}
    </FormProvider>
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../BlogMediaSection');
  BlogMediaSection = mod.default;
});

describe('BlogMediaSection', () => {
  it('shows placeholder cards when no images are set', () => {
    renderWithProviders(
      <FormWrapper defaults={{}}>
        {({ control, watch, setValue }) => (
          <BlogMediaSection
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={vi.fn()}
            siteId="site-1"
          />
        )}
      </FormWrapper>,
    );

    const selectTexts = screen.getAllByText('Select Image');
    expect(selectTexts).toHaveLength(2); // cover + header
  });

  it('fetches and displays public_url for cover image', async () => {
    vi.mocked(apiService.getMediaById).mockResolvedValue({
      id: 'media-cover',
      filename: 'cover.jpg',
      original_filename: 'cover.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048,
      storage_provider: 'local',
      public_url: 'https://cdn.example.com/cover.jpg',
      is_global: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      variants: [],
    });

    renderWithProviders(
      <FormWrapper defaults={{ cover_image_id: 'media-cover' }}>
        {({ control, watch, setValue }) => (
          <BlogMediaSection
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={vi.fn()}
            siteId="site-1"
          />
        )}
      </FormWrapper>,
    );

    await waitFor(() => {
      expect(apiService.getMediaById).toHaveBeenCalledWith('media-cover');
    });

    // The image element should use the public_url, not /api/media/.../file
    await waitFor(() => {
      const images = document.querySelectorAll('img');
      const coverImg = Array.from(images).find(
        (img) => img.getAttribute('src') === 'https://cdn.example.com/cover.jpg',
      );
      expect(coverImg).toBeTruthy();
    });
  });

  it('does not use broken /api/media/.../file URL pattern', async () => {
    vi.mocked(apiService.getMediaById).mockResolvedValue({
      id: 'media-cover',
      filename: 'cover.jpg',
      original_filename: 'cover.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048,
      storage_provider: 'local',
      public_url: 'https://cdn.example.com/cover.jpg',
      is_global: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      variants: [],
    });

    renderWithProviders(
      <FormWrapper defaults={{ cover_image_id: 'media-cover' }}>
        {({ control, watch, setValue }) => (
          <BlogMediaSection
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={vi.fn()}
            siteId="site-1"
          />
        )}
      </FormWrapper>,
    );

    await waitFor(() => {
      expect(apiService.getMediaById).toHaveBeenCalled();
    });

    // No img should have the broken /api/media/.../file pattern
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('src')).not.toMatch(/\/api\/media\/.*\/file/);
    });
  });

  it('shows media ID and change/remove buttons when image is set', async () => {
    vi.mocked(apiService.getMediaById).mockResolvedValue({
      id: 'media-cover',
      filename: 'cover.jpg',
      original_filename: 'cover.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048,
      storage_provider: 'local',
      public_url: 'https://cdn.example.com/cover.jpg',
      is_global: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      variants: [],
    });

    renderWithProviders(
      <FormWrapper defaults={{ cover_image_id: 'media-cover' }}>
        {({ control, watch, setValue }) => (
          <BlogMediaSection
            control={control}
            watch={watch}
            setValue={setValue}
            onSnapshot={vi.fn()}
            siteId="site-1"
          />
        )}
      </FormWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('media-cover')).toBeInTheDocument();
    });
    expect(screen.getByText('Change')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });
});
