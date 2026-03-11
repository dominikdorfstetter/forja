import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import PageSeoTab from '../PageSeoTab';
import { pageDetailSchema, type PageDetailFormData } from '../pageDetailSchema';

interface WrapperProps {
  defaultValues?: Partial<PageDetailFormData>;
  route?: string;
  onSnapshot?: () => void;
}

function SeoTabWrapper({
  defaultValues = {},
  route = '/about',
  onSnapshot = vi.fn(),
}: WrapperProps) {
  const { control, watch } = useForm<PageDetailFormData>({
    resolver: zodResolver(pageDetailSchema),
    defaultValues: {
      route: '/about',
      slug: 'about',
      page_type: 'Static',
      template: '',
      status: 'Draft',
      is_in_navigation: false,
      navigation_order: '',
      parent_page_id: '',
      publish_start: null,
      publish_end: null,
      meta_title: '',
      meta_description: '',
      excerpt: '',
      ...defaultValues,
    },
  });

  return (
    <PageSeoTab
      control={control}
      watch={watch}
      onSnapshot={onSnapshot}
      route={route}
    />
  );
}

describe('PageSeoTab', () => {
  it('renders all SEO fields', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByLabelText('Meta Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Meta Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Excerpt')).toBeInTheDocument();
  });

  it('renders SERP preview', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByText('Search Engine Preview')).toBeInTheDocument();
  });

  it('shows character counters for each field', () => {
    renderWithProviders(<SeoTabWrapper />);

    expect(screen.getByText('0/60')).toBeInTheDocument();
    expect(screen.getByText('0/160')).toBeInTheDocument();
    expect(screen.getByText('0/300')).toBeInTheDocument();
  });

  it('displays populated values', () => {
    renderWithProviders(
      <SeoTabWrapper
        defaultValues={{
          meta_title: 'My Page Title',
          meta_description: 'A description of my page',
          excerpt: 'Page excerpt here',
        }}
      />,
    );

    expect(screen.getByDisplayValue('My Page Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A description of my page')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Page excerpt here')).toBeInTheDocument();
  });

  it('updates character counter on input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SeoTabWrapper />);

    const metaTitleInput = screen.getByLabelText('Meta Title');
    await user.type(metaTitleInput, 'Hello');

    expect(screen.getByText('5/60')).toBeInTheDocument();
  });

  it('calls onSnapshot on field blur', async () => {
    const onSnapshot = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SeoTabWrapper onSnapshot={onSnapshot} />);

    const metaTitleInput = screen.getByLabelText('Meta Title');
    await user.click(metaTitleInput);
    await user.tab();

    expect(onSnapshot).toHaveBeenCalled();
  });

  it('shows page route in SERP preview URL', () => {
    renderWithProviders(<SeoTabWrapper route="/contact-us" />);

    expect(screen.getByText('example.com/contact-us')).toBeInTheDocument();
  });

  it('uses meta title in SERP preview when provided', () => {
    renderWithProviders(
      <SeoTabWrapper defaultValues={{ meta_title: 'Custom SEO Title' }} />,
    );

    expect(screen.getByText('Custom SEO Title')).toBeInTheDocument();
  });
});
