import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import en from '@/i18n/locales/en.json';
import { renderWithProviders } from '@/test/test-utils';
import { SettingsSidebar, type SettingsNavGroup } from '../SettingsSidebar';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
}

function wrap(ui: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

const groups: SettingsNavGroup[] = [
  {
    label: 'Configuration',
    items: [
      { path: '', label: 'Overview', icon: 'tune' },
      { path: '/modules', label: 'Modules', icon: 'widgets' },
    ],
  },
  {
    label: 'Discovery',
    items: [{ path: '/seo', label: 'SEO', icon: 'travel_explore' }],
  },
];

describe('SettingsSidebar', () => {
  it('renders every group label and item', () => {
    renderWithProviders(
      wrap(<SettingsSidebar groups={groups} currentPath="" onNavigate={() => {}} />),
    );
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SEO/ })).toBeInTheDocument();
  });

  it('marks the active item with aria-current=page and squircle radius', () => {
    renderWithProviders(
      wrap(<SettingsSidebar groups={groups} currentPath="/seo" onNavigate={() => {}} />),
    );
    const active = screen.getByTestId('site-settings.nav.seo');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect((active as HTMLElement).style.borderRadius).toBe('12px');

    const inactive = screen.getByTestId('site-settings.nav.overview');
    expect(inactive).not.toHaveAttribute('aria-current');
    expect((inactive as HTMLElement).style.borderRadius).toBe('999px');
  });

  it('filters groups and items by the menu input', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      wrap(<SettingsSidebar groups={groups} currentPath="" onNavigate={() => {}} />),
    );
    await user.type(screen.getByTestId('site-settings.sidebar.filter'), 'seo');
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches the filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      wrap(<SettingsSidebar groups={groups} currentPath="" onNavigate={() => {}} />),
    );
    await user.type(screen.getByTestId('site-settings.sidebar.filter'), 'zzz');
    expect(screen.getByText(/No sections match/)).toBeInTheDocument();
  });

  it('invokes onNavigate with the item path when clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderWithProviders(
      wrap(<SettingsSidebar groups={groups} currentPath="" onNavigate={onNavigate} />),
    );
    await user.click(screen.getByRole('button', { name: /Modules/ }));
    expect(onNavigate).toHaveBeenCalledWith('/modules');
  });
});
