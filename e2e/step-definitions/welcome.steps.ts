import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { ForjaWorld } from '../support/world';
import { config } from '../support/config';

/**
 * Welcome-surface steps (#814). The signed-out Welcome page is the
 * `<SignedOut>` fallback at `/dashboard`; the Imprint is a public route at
 * `/dashboard/imprint`. Selectors use the data-testids the components expose.
 * Assertions follow the suite's style: Playwright `waitFor` for visibility,
 * `node:assert` for value checks (no expect library is wired up here).
 */

Given('I am a signed-out visitor on the Welcome page', async function (this: ForjaWorld) {
  await this.context.clearCookies();
  await this.page.goto(`${config.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await this.page.locator('.welcome-surface').first().waitFor({ state: 'visible' });
});

When('I reload the Welcome page', async function (this: ForjaWorld) {
  await this.page.goto(`${config.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await this.page.locator('.welcome-surface').first().waitFor({ state: 'visible' });
});

Then('the {string} explainer is the first content section', async function (
  this: ForjaWorld,
  _label: string,
) {
  // The hero is a <header>; the first <section> must be the explainer.
  const firstSection = this.page.locator('.welcome-surface section').first();
  await firstSection.waitFor({ state: 'visible' });
  const testId = await firstSection.getAttribute('data-testid');
  assert.equal(testId, 'welcome.section.whatis', `first section was ${testId}`);
});

Then('I see the sign-up and self-host hero calls to action', async function (this: ForjaWorld) {
  await this.page.getByTestId('welcome.hero.cta.signup').waitFor({ state: 'visible' });
  await this.page.getByTestId('welcome.hero.cta.selfhost').waitFor({ state: 'visible' });
});

/** Reads the public imprint endpoint to gate the scenario on backend config. */
async function imprintConfigured(): Promise<boolean> {
  const res = await fetch(`${config.apiUrl}/api/v1/imprint`);
  const body = (await res.json()) as { configured?: boolean };
  return Boolean(body.configured);
}

Given('the operator has configured imprint details', async function () {
  assert.equal(
    await imprintConfigured(),
    true,
    'This scenario requires IMPRINT_OPERATOR_NAME, IMPRINT_ADDRESS and IMPRINT_EMAIL set on the backend',
  );
});

Given('the operator has not configured imprint details', async function () {
  assert.equal(
    await imprintConfigured(),
    false,
    'This scenario requires the IMPRINT_* env vars to be unset on the backend',
  );
});

When('I open the Imprint from the footer', async function (this: ForjaWorld) {
  const link = this.page.getByTestId('welcome.footer.imprint-link');
  await link.scrollIntoViewIfNeeded();
  await link.click();
});

Then('I see the operator imprint details', async function (this: ForjaWorld) {
  await this.page
    .getByRole('heading', { level: 1, name: /imprint/i })
    .waitFor({ state: 'visible' });
  await this.page.getByTestId('imprint.details').waitFor({ state: 'visible' });
});

Then('the footer shows no Imprint link', async function (this: ForjaWorld) {
  const count = await this.page.getByTestId('welcome.footer.imprint-link').count();
  assert.equal(count, 0, 'expected no Imprint link in the footer');
});

Given('the visitor\'s system prefers the {string} colour scheme', async function (
  this: ForjaWorld,
  scheme: string,
) {
  await this.page.emulateMedia({ colorScheme: scheme as 'dark' | 'light' });
});

Then('the Welcome surface uses the {string} palette', async function (
  this: ForjaWorld,
  scheme: string,
) {
  const bg = await this.page
    .locator('.welcome-surface')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  // The browser resolves the oklch tokens to rgb(); check luminance — the dark
  // surface is near-black, the light surface near-white.
  const [r, g, b] = (bg.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).map(Number);
  const luminance = (r + g + b) / 3;
  if (scheme === 'dark') {
    assert.ok(luminance < 96, `expected a dark surface, got ${bg}`);
  } else {
    assert.ok(luminance > 160, `expected a light surface, got ${bg}`);
  }
});
