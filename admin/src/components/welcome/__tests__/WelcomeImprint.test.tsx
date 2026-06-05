import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getImprint } from '@/services/imprint';
import WelcomeImprint from '../WelcomeImprint';

vi.mock('@/services/imprint');

const mockedGetImprint = vi.mocked(getImprint);

describe('WelcomeImprint', () => {
  beforeEach(() => {
    mockedGetImprint.mockReset();
  });

  it('renders an h1 and the operator details when configured', async () => {
    mockedGetImprint.mockResolvedValue({
      configured: true,
      operator_name: 'Acme GmbH',
      address: 'Hauptstraße 1, 1010 Wien',
      email: 'legal@acme.example',
    });
    renderWithProviders(<WelcomeImprint />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /imprint/i }),
    ).toBeInTheDocument();
    // data-dependent: wait for the async query to resolve
    expect(await screen.findByText('Acme GmbH')).toBeInTheDocument();
    expect(screen.getByText('legal@acme.example')).toBeInTheDocument();
  });

  it('shows a load-error state when the endpoint fails', async () => {
    mockedGetImprint.mockRejectedValue(new Error('network'));
    renderWithProviders(<WelcomeImprint />);
    await waitFor(() =>
      expect(screen.getByTestId('imprint.error')).toBeInTheDocument(),
    );
  });

  it('renders operator-supplied markup as text, never as HTML', async () => {
    mockedGetImprint.mockResolvedValue({
      configured: true,
      operator_name: '<b>Acme</b>',
      address: 'Wien',
      email: 'a@b.c',
    });
    renderWithProviders(<WelcomeImprint />);
    // The literal string is shown; no <b> element is created from the value.
    const node = await screen.findByText('<b>Acme</b>');
    expect(node.querySelector('b')).toBeNull();
  });
});
