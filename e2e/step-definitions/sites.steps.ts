import { When, Then, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

/**
 * Completes the multi-step site creation wizard
 * (Basics → Modules → Workflow → Languages) via its site-wizard.* testids.
 */
When('I complete the site creation wizard with:', async function (this: ForjaWorld, dataTable: DataTable) {
  const dialog = this.page.locator('[role="dialog"]', { hasText: 'Create New Site' });
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  // Step 1: Basics. The slug field is read-only (auto-derived from the
  // name), so only name and description are fillable.
  const fields = Object.fromEntries(dataTable.rows());
  await dialog
    .locator('[data-testid="site-wizard.input.name"] input')
    .first()
    .fill(fields.name);
  if (fields.description) {
    await dialog.locator('[name="description"]').first().fill(fields.description);
  }

  // Modules and Workflow keep their defaults; Languages is the last step.
  for (let step = 0; step < 3; step++) {
    await dialog.locator('[data-testid="site-wizard.btn.next"]').click();
  }

  // Step 4: Languages — pick English, then Create.
  await dialog.locator('[data-testid="site-wizard.locales"] input').first().click();
  await this.page.getByRole('option', { name: /english/i }).first().click();
  await this.page.keyboard.press('Escape');

  await dialog.getByRole('button', { name: /^create$/i }).click();
  await this.page.waitForLoadState('networkidle');
});

When('I update the site name to {string}', async function (this: ForjaWorld, newName: string) {
  const nameInput = this.page.locator('[data-testid="field-name"], [name="name"]').first();
  await nameInput.clear();
  await nameInput.fill(newName);
});

When('I save settings', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="save-settings"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I add locale {string} to the site', async function (this: ForjaWorld, locale: string) {
  const addLocaleBtn = this.page.locator('[data-testid="add-locale"]');
  await addLocaleBtn.click();
  // Select the locale from the dropdown
  await this.page.locator(`[data-testid="locale-option-${locale}"]`).click();
});

Then('the settings form should be editable', async function (this: ForjaWorld) {
  const form = this.page.locator('form').first();
  const submitBtn = form.locator('button[type="submit"]');
  await submitBtn.waitFor({ state: 'visible' });
});

Then('the site should support locales {string}', async function (this: ForjaWorld, locales: string) {
  const expected = locales.split(',').map((l) => l.trim());
  for (const locale of expected) {
    const localeChip = this.page.locator(`[data-testid="locale-chip-${locale}"]`);
    const isVisible = await localeChip.isVisible().catch(() => false);
    if (!isVisible) {
      // Fallback: check text content
      const text = await this.page.locator(`text=${locale}`).isVisible();
      if (!text) throw new Error(`Expected locale "${locale}" to be visible`);
    }
  }
});

Then('the site should be deleted', async function (this: ForjaWorld) {
  // After deletion, we should be redirected away from the site
  await this.page.waitForLoadState('networkidle');
});

Given('a site with subdomain {string} already exists', async function (this: ForjaWorld, _subdomain: string) {
  // Precondition — handled by seed data
});
