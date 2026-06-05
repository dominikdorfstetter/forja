import { When, Then, Given } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When('I save as draft', async function (this: ForjaWorld) {
  // Try multiple selectors — the button may say "Save Draft", "Save", or use a test-id
  const saveDraftByTestId = this.page.locator('[data-testid="save-draft"]');
  if (await saveDraftByTestId.isVisible().catch(() => false)) {
    await saveDraftByTestId.click();
    await this.page.waitForLoadState('networkidle');
    return;
  }

  const saveDraftBtn = this.page.getByRole('button', { name: /save\s*draft/i });
  if (await saveDraftBtn.isVisible().catch(() => false)) {
    await saveDraftBtn.click();
    await this.page.waitForLoadState('networkidle');
    return;
  }

  const saveBtn = this.page.getByRole('button', { name: /^save$/i });
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await this.page.waitForLoadState('networkidle');
    return;
  }

  // Last resort: submit button
  await this.page.locator('button[type="submit"]').first().click();
  await this.page.waitForLoadState('networkidle');
});

When('I save the post', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="save-post"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I save the page', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="save-page"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I save the document', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="save-document"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I open post {string}', async function (this: ForjaWorld, title: string) {
  // Posts may render as table rows (data-testid="post-row") or as list items/links.
  // Try the table row pattern first, then fall back to a link with the title text.
  const postRow = this.page.locator('[data-testid="post-row"]').filter({ hasText: title });

  if (await postRow.first().isVisible().catch(() => false)) {
    await postRow.first().click();
  } else {
    // Fall back: look for any link or clickable element containing the title
    const postLink = this.page.getByRole('link', { name: title });
    if (await postLink.isVisible().catch(() => false)) {
      await postLink.click();
    } else {
      // Last resort: click any element with the title text
      await this.page.locator(`text=${title}`).first().click();
    }
  }

  await this.page.waitForLoadState('networkidle');
});

// "I confirm the publication" is handled by the generic "I confirm the {word}" in forms.steps.ts

When('I switch to locale {string}', async function (this: ForjaWorld, locale: string) {
  const localeSelector = this.page.locator('[data-testid="locale-selector"]');
  await localeSelector.click();
  await this.page.locator(`[data-testid="locale-option-${locale}"]`).click();
  await this.page.waitForLoadState('networkidle');
});

Then('the post status should be {string}', async function (this: ForjaWorld, status: string) {
  const statusBadge = this.page.locator(`[data-testid="post-status"]`);
  const text = await statusBadge.textContent();
  if (!text?.toLowerCase().includes(status.toLowerCase())) {
    throw new Error(`Expected post status "${status}" but got "${text}"`);
  }
});

Then(
  'I should see {string} with status {string}',
  async function (this: ForjaWorld, title: string, status: string) {
    const row = this.page.locator(`[data-testid="post-row"]`).filter({ hasText: title });
    await row.waitFor({ state: 'visible' });
    const statusText = await row.locator(`[data-testid="post-status"]`).textContent();
    if (!statusText?.toLowerCase().includes(status.toLowerCase())) {
      throw new Error(`Expected status "${status}" for "${title}" but got "${statusText}"`);
    }
  },
);

Given('the site supports locales {string}', async function (this: ForjaWorld, _locales: string) {
  // Precondition — site should be configured with these locales
});

Given('a page with slug {string} already exists', async function (this: ForjaWorld, _slug: string) {
  // Precondition — handled by seed data or previous test
});
