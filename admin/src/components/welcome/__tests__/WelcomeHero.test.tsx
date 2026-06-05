import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { appConfig } from '@/appConfig';
import WelcomeHero from '../WelcomeHero';

afterEach(() => {
  appConfig.demoMode = false;
});

/**
 * Tracer (#809): the hero presents one gradient h1 and the CTA hierarchy
 * (sign-up, self-host, and demo only in demo mode), each addressable by testid
 * for the e2e canary.
 */
describe('WelcomeHero', () => {
  const render = () =>
    renderWithProviders(<WelcomeHero onTryDemo={vi.fn()} demoLoading={false} />);

  it('renders exactly one h1', () => {
    render();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the sign-up and self-host CTAs', () => {
    render();
    expect(screen.getByTestId('welcome.hero.cta.signup')).toBeInTheDocument();
    expect(screen.getByTestId('welcome.hero.cta.selfhost')).toBeInTheDocument();
  });

  it('hides the demo CTA unless demo mode is enabled', () => {
    render();
    expect(screen.queryByTestId('welcome.hero.cta.demo')).toBeNull();
  });

  it('shows and fires the demo CTA when demo mode is enabled', async () => {
    appConfig.demoMode = true;
    const onTryDemo = vi.fn();
    renderWithProviders(<WelcomeHero onTryDemo={onTryDemo} demoLoading={false} />);
    const demo = screen.getByTestId('welcome.hero.cta.demo');
    await userEvent.click(demo);
    expect(onTryDemo).toHaveBeenCalledTimes(1);
  });

  it('exposes the self-host CTA as a GitHub link', () => {
    render();
    const selfHost = screen.getByTestId('welcome.hero.cta.selfhost');
    expect(selfHost).toHaveAttribute('href', expect.stringContaining('github.com'));
  });
});
