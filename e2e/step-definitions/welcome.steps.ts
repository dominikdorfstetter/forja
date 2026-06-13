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
  // Trailing slash matters: Vite serves base `/dashboard/` and 404s the bare path.
  await this.page.goto(`${config.baseUrl}/dashboard/`, { waitUntil: 'domcontentloaded' });
  await this.page.locator('.welcome-surface').first().waitFor({ state: 'visible' });
});

When('I reload the Welcome page', async function (this: ForjaWorld) {
  await this.page.goto(`${config.baseUrl}/dashboard/`, { waitUntil: 'domcontentloaded' });
  await this.page.locator('.welcome-surface').first().waitFor({ state: 'visible' });
});

Then('the product preview leads and the {string} explainer follows', async function (
  this: ForjaWorld,
  _label: string,
) {
  // The hero is a <header>; the page leads with the product showcase and the
  // explainer is the next section (current Welcome design, epic #806).
  const sections = this.page.locator('.welcome-surface section');
  await sections.first().waitFor({ state: 'visible' });
  const testIds = await sections.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid')),
  );
  assert.equal(testIds[0], 'welcome.section.showcase', `first section was ${testIds[0]}`);
  assert.ok(
    testIds.includes('welcome.section.whatis'),
    `explainer section missing — sections were ${testIds.join(', ')}`,
  );
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

// The two imprint scenarios are mutually exclusive against a single backend
// (IMPRINT_* either set or not) — whichever doesn't match skips, not fails.
Given('the operator has configured imprint details', async function () {
  if (!(await imprintConfigured())) {
    return 'skipped';
  }
});

Given('the operator has not configured imprint details', async function () {
  if (await imprintConfigured()) {
    return 'skipped';
  }
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
  // Chromium may report the token either resolved (`rgb(…)`, 0–255) or raw
  // (`oklch(L C H)`, L in 0–1). Normalise both to a 0–1 lightness.
  const nums = (bg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const lightness = bg.startsWith('oklch')
    ? nums[0]
    : (nums[0] + nums[1] + nums[2]) / (3 * 255);
  if (scheme === 'dark') {
    assert.ok(lightness < 0.4, `expected a dark surface, got ${bg}`);
  } else {
    assert.ok(lightness > 0.6, `expected a light surface, got ${bg}`);
  }
});
