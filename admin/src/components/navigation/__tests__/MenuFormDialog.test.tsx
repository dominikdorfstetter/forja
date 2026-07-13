import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import type { NavigationMenu, Locale } from '@/types/api';
import MenuFormDialog from '../MenuFormDialog';

const mockLocales: Locale[] = [
  { id: 'loc-en', code: 'en', name: 'English', native_name: 'English', direction: 'Ltr', is_active: true, created_at: '2025-01-01T00:00:00Z', site_count: 1 },
  { id: 'loc-de', code: 'de', name: 'German', native_name: 'Deutsch', direction: 'Ltr', is_active: true, created_at: '2025-01-01T00:00:00Z', site_count: 1 },
];

const existingMenu: NavigationMenu = {
  id: 'menu-1',
  site_id: 'site-1',
  slug: 'footer',
  description: 'Footer menu',
  max_depth: 3,
  is_active: true,
  item_count: 2,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  localizations: [
    { id: 'ml-1', locale_id: 'loc-en', name: 'Footer links' },
    { id: 'ml-2', locale_id: 'loc-de', name: 'Fußzeile' },
  ],
};

const defaultProps = {
  open: true,
  locales: mockLocales,
  onSubmitCreate: vi.fn(),
  onSubmitUpdate: vi.fn(),
  onClose: vi.fn(),
  loading: false,
};

describe('MenuFormDialog', () => {
  it('shows a display-name field with one tab per locale', () => {
    renderWithProviders(<MenuFormDialog {...defaultProps} />);

    expect(screen.getByText(/display names/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /en/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /de/i })).toBeInTheDocument();
    expect(screen.getByTestId('menu-form.input.display-name')).toBeInTheDocument();
  });

  it('hides the tab bar when only one locale exists', () => {
    renderWithProviders(
      <MenuFormDialog {...defaultProps} locales={[mockLocales[0]]} />,
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('menu-form.input.display-name')).toBeInTheDocument();
  });

  it('hides the display-names section when no locales are configured', () => {
    renderWithProviders(<MenuFormDialog {...defaultProps} locales={[]} />);

    expect(screen.queryByText(/display names/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-form.input.display-name')).not.toBeInTheDocument();
  });

  it('sends per-locale display names as localizations on create', async () => {
    const onSubmitCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuFormDialog {...defaultProps} onSubmitCreate={onSubmitCreate} />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'footer');
    await user.type(screen.getByTestId('menu-form.input.display-name'), 'Footer links');
    await user.click(screen.getByRole('tab', { name: /de/i }));
    await user.type(screen.getByTestId('menu-form.input.display-name'), 'Fußzeile');

    await waitFor(() => expect(screen.getByTestId('menu-form.btn.submit')).not.toBeDisabled());
    await user.click(screen.getByTestId('menu-form.btn.submit'));

    await waitFor(() => expect(onSubmitCreate).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'footer',
      localizations: [
        { locale_id: 'loc-en', name: 'Footer links' },
        { locale_id: 'loc-de', name: 'Fußzeile' },
      ],
    })));
  });

  it('omits localizations on create when no display name is entered', async () => {
    const onSubmitCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuFormDialog {...defaultProps} onSubmitCreate={onSubmitCreate} />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'footer');
    await waitFor(() => expect(screen.getByTestId('menu-form.btn.submit')).not.toBeDisabled());
    await user.click(screen.getByTestId('menu-form.btn.submit'));

    await waitFor(() => expect(onSubmitCreate).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'footer',
      localizations: undefined,
    })));
  });

  it('prefills display names from the menu localizations when editing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuFormDialog {...defaultProps} menu={existingMenu} />);

    expect(screen.getByTestId('menu-form.input.display-name')).toHaveValue('Footer links');

    await user.click(screen.getByRole('tab', { name: /de/i }));
    expect(screen.getByTestId('menu-form.input.display-name')).toHaveValue('Fußzeile');
  });

  it('sends edited display names as localizations on update', async () => {
    const onSubmitUpdate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuFormDialog {...defaultProps} menu={existingMenu} onSubmitUpdate={onSubmitUpdate} />,
    );

    await user.click(screen.getByRole('tab', { name: /de/i }));
    const input = screen.getByTestId('menu-form.input.display-name');
    await user.clear(input);
    await user.type(input, 'Fußbereich');

    await waitFor(() => expect(screen.getByTestId('menu-form.btn.submit')).not.toBeDisabled());
    await user.click(screen.getByTestId('menu-form.btn.submit'));

    await waitFor(() => expect(onSubmitUpdate).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'footer',
      localizations: [
        { locale_id: 'loc-en', name: 'Footer links' },
        { locale_id: 'loc-de', name: 'Fußbereich' },
      ],
    })));
  });

  it('drops locales whose display name was cleared from the payload', async () => {
    const onSubmitUpdate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuFormDialog {...defaultProps} menu={existingMenu} onSubmitUpdate={onSubmitUpdate} />,
    );

    await user.clear(screen.getByTestId('menu-form.input.display-name'));

    await waitFor(() => expect(screen.getByTestId('menu-form.btn.submit')).not.toBeDisabled());
    await user.click(screen.getByTestId('menu-form.btn.submit'));

    await waitFor(() => expect(onSubmitUpdate).toHaveBeenCalledWith(expect.objectContaining({
      localizations: [{ locale_id: 'loc-de', name: 'Fußzeile' }],
    })));
  });
});
