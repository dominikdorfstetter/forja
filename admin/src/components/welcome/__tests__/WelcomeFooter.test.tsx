import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getImprint } from '@/services/imprint';
import WelcomeFooter from '../WelcomeFooter';

vi.mock('@/services/imprint');
const mockedGetImprint = vi.mocked(getImprint);

describe('WelcomeFooter', () => {
  beforeEach(() => mockedGetImprint.mockReset());

  it('shows the Imprint link only when the operator configured it', async () => {
    mockedGetImprint.mockResolvedValue({ configured: true });
    renderWithProviders(<WelcomeFooter mounted />);
    const link = await screen.findByTestId('welcome.footer.imprint-link');
    expect(link).toHaveAttribute('href', expect.stringContaining('imprint'));
  });

  it('hides the Imprint link when unconfigured', async () => {
    mockedGetImprint.mockResolvedValue({ configured: false });
    renderWithProviders(<WelcomeFooter mounted />);
    // give the query a tick to resolve, then assert absence
    await waitFor(() => expect(mockedGetImprint).toHaveBeenCalled());
    expect(screen.queryByTestId('welcome.footer.imprint-link')).toBeNull();
  });
});
