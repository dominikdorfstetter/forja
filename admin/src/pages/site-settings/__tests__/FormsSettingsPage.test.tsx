import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { deleteSiteBotProtection, getSiteBotProtection, upsertSiteBotProtection } from '@/services/botProtection';
import FormsSettingsPage from '../FormsSettingsPage';
import type { SiteBotProtectionResponse } from '@/types/api';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const remoteConfig: SiteBotProtectionResponse = {
  site_id: 'site-1',
  mode: 'remote',
  provider_label: 'Turnstile',
  verify_url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  altcha_max_number: null,
  altcha_expiry_seconds: null,
  configured: true,
  created_at: '2026-05-12T10:00:00Z',
  updated_at: '2026-05-12T10:00:00Z',
};

const altchaConfig: SiteBotProtectionResponse = {
  site_id: 'site-1',
  mode: 'altcha',
  provider_label: 'ALTCHA (self-hosted)',
  verify_url: null,
  altcha_max_number: 50000,
  altcha_expiry_seconds: 300,
  configured: true,
  created_at: '2026-05-12T10:00:00Z',
  updated_at: '2026-05-12T10:00:00Z',
};

/** Open the MUI mode Select and pick the option matching `name`. */
async function selectMode(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name }));
}

describe('FormsSettingsPage — bot protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults an unconfigured site to ALTCHA and hides vendor fields', async () => {
    vi.mocked(getSiteBotProtection).mockResolvedValue(null);

    renderWithProviders(<FormsSettingsPage />);

    // Mode selector + ALTCHA info present; vendor fields absent by default.
    expect(
      await screen.findByTestId('site-settings.forms.bot-protection.mode-select'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('site-settings.forms.bot-protection.altcha-info'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('site-settings.forms.bot-protection.url-input'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('site-settings.forms.bot-protection.status'),
    ).not.toBeInTheDocument();
  });

  it('saves ALTCHA mode with no extra fields (zero-config enable)', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockResolvedValue(null);
    vi.mocked(upsertSiteBotProtection).mockResolvedValue(altchaConfig);

    renderWithProviders(<FormsSettingsPage />);
    await screen.findByTestId('site-settings.forms.bot-protection.mode-select');

    const saveBtn = await screen.findByTestId('site-settings.forms.bot-protection.save');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(upsertSiteBotProtection).toHaveBeenCalledWith('site-1', { mode: 'altcha' });
    });
  });

  it('stays savable (and surfaces the error) when the config GET fails', async () => {
    // Regression: an errored GET leaves config undefined; the panel must still
    // let the admin enable ALTCHA rather than stranding them with no Save.
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockRejectedValue(new Error('boom'));
    vi.mocked(upsertSiteBotProtection).mockResolvedValue(altchaConfig);

    renderWithProviders(<FormsSettingsPage />);

    expect(
      await screen.findByTestId('site-settings.forms.bot-protection.load-error'),
    ).toBeInTheDocument();

    const saveBtn = await screen.findByTestId('site-settings.forms.bot-protection.save');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(upsertSiteBotProtection).toHaveBeenCalledWith('site-1', { mode: 'altcha' });
    });
  });

  it('reveals vendor fields and saves remote mode when switched', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockResolvedValue(null);
    vi.mocked(upsertSiteBotProtection).mockResolvedValue(remoteConfig);

    renderWithProviders(<FormsSettingsPage />);
    await screen.findByTestId('site-settings.forms.bot-protection.mode-select');

    await selectMode(user, /custom captcha vendor/i);

    const labelInput = await screen.findByTestId('site-settings.forms.bot-protection.label-input');
    const urlInput = screen.getByTestId('site-settings.forms.bot-protection.url-input');
    const secretInput = screen.getByTestId('site-settings.forms.bot-protection.secret-input');

    await user.type(labelInput, 'Turnstile');
    await user.type(urlInput, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    await user.type(secretInput, '0xSECRET_VALUE');

    const saveBtn = await screen.findByTestId('site-settings.forms.bot-protection.save');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(upsertSiteBotProtection).toHaveBeenCalledWith('site-1', {
        mode: 'remote',
        provider_label: 'Turnstile',
        verify_url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        secret: '0xSECRET_VALUE',
      });
    });
  });

  it('shows a remote read-only summary with the verify URL', async () => {
    vi.mocked(getSiteBotProtection).mockResolvedValue(remoteConfig);

    renderWithProviders(<FormsSettingsPage />);

    expect(
      await screen.findByTestId('site-settings.forms.bot-protection.status'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('site-settings.forms.bot-protection.verify-url'),
    ).toHaveTextContent(remoteConfig.verify_url!);
    expect(
      screen.queryByTestId('site-settings.forms.bot-protection.regenerate-key'),
    ).not.toBeInTheDocument();
  });

  it('shows an ALTCHA summary with a regenerate-key action and no verify URL', async () => {
    vi.mocked(getSiteBotProtection).mockResolvedValue(altchaConfig);

    renderWithProviders(<FormsSettingsPage />);

    expect(
      await screen.findByTestId('site-settings.forms.bot-protection.regenerate-key'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('site-settings.forms.bot-protection.verify-url'),
    ).not.toBeInTheDocument();
    // The admin is told which endpoint the ALTCHA widget must fetch from.
    expect(
      screen.getByTestId('site-settings.forms.bot-protection.challenge-url'),
    ).toHaveTextContent('/public/forms/<form-slug>/altcha-challenge');
  });

  it('regenerates the ALTCHA key after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockResolvedValue(altchaConfig);
    vi.mocked(upsertSiteBotProtection).mockResolvedValue(altchaConfig);

    renderWithProviders(<FormsSettingsPage />);

    const regenBtn = await screen.findByTestId('site-settings.forms.bot-protection.regenerate-key');
    await user.click(regenBtn);

    // ConfirmDialog confirm button carries the same label; the dialog copy is
    // the last "Regenerate key" occurrence.
    const buttons = await screen.findAllByRole('button', { name: /regenerate key/i });
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(upsertSiteBotProtection).toHaveBeenCalledWith('site-1', {
        mode: 'altcha',
        regenerate_key: true,
      });
    });
  });

  it('blocks save in remote mode when the verify URL is malformed', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockResolvedValue(null);

    renderWithProviders(<FormsSettingsPage />);
    await screen.findByTestId('site-settings.forms.bot-protection.mode-select');
    await selectMode(user, /custom captcha vendor/i);

    await user.type(await screen.findByTestId('site-settings.forms.bot-protection.label-input'), 'Turnstile');
    await user.type(screen.getByTestId('site-settings.forms.bot-protection.url-input'), 'not-a-url');
    await user.type(screen.getByTestId('site-settings.forms.bot-protection.secret-input'), 'secret');

    expect(
      await screen.findByTestId('site-settings.forms.bot-protection.validation-error'),
    ).toBeInTheDocument();
    expect(upsertSiteBotProtection).not.toHaveBeenCalled();
  });

  it('confirms before deleting and then calls the delete endpoint', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockResolvedValue(remoteConfig);
    vi.mocked(deleteSiteBotProtection).mockResolvedValue();

    renderWithProviders(<FormsSettingsPage />);

    const removeBtn = await screen.findByTestId('site-settings.forms.bot-protection.remove');
    await user.click(removeBtn);

    const allRemoveBtns = screen.getAllByRole('button', { name: /remove/i });
    await user.click(allRemoveBtns[allRemoveBtns.length - 1]);

    await waitFor(() => {
      expect(deleteSiteBotProtection).toHaveBeenCalledWith('site-1');
    });
  });

  it('reveals the secret when the visibility toggle is clicked (remote mode)', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteBotProtection).mockResolvedValue(null);

    renderWithProviders(<FormsSettingsPage />);
    await screen.findByTestId('site-settings.forms.bot-protection.mode-select');
    await selectMode(user, /custom captcha vendor/i);

    const secretInput = (await screen.findByTestId(
      'site-settings.forms.bot-protection.secret-input',
    )) as HTMLInputElement;
    expect(secretInput.type).toBe('password');

    await user.click(screen.getByTestId('site-settings.forms.bot-protection.toggle-secret'));
    expect(secretInput.type).toBe('text');
  });
});
