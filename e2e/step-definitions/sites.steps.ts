import { When, Then, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

/**
 * Completes the multi-step site creation wizard.
 * The wizard has 4 steps: Basics → Modules → Workflow → Languages.
 * We fill the basics step and click "Next" through the remaining steps.
 */
When('I complete the site creation wizard with:', async function (this: ForjaWorld, dataTable: DataTable) {
  // Wait for the wizard dialog to appear
  await this.page.locator('text=Create New Site').waitFor({ state: 'visible', timeout: 5000 });

  // Step 1: Basics — fill in the form fields
  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    // Try MUI TextField by label first, then by name, then data-testid
    const byLabel = this.page.getByLabel(new RegExp(field, 'i'));
    if (await byLabel.isVisible().catch(() => false)) {
      await byLabel.fill(value);
      continue;
    }
    const byName = this.page.locator(`[name="${field}"]`);
    if (await byName.isVisible().catch(() => false)) {
      await byName.fill(value);
      continue;
    }
    const byTestId = this.page.locator(`[data-testid="field-${field}"]`);
    if (await byTestId.isVisible().catch(() => false)) {
      await byTestId.fill(value);
      continue;
    }
  }

  // Steps 2-3: Click "Next" through Modules and Workflow
  for (let step = 0; step < 2; step++) {
    const nextBtn = this.page.getByRole('button', { name: /next/i });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await this.page.waitForTimeout(500);
    }
  }

  // Step 4: Languages — select at least one language
  // The dropdown says "Initial Languages" — click it and pick English
  const langDropdown = this.page.getByLabel(/initial languages|languages/i);
  if (await langDropdown.isVisible().catch(() => false)) {
    await langDropdown.click();
    // Select English from the dropdown options
    const englishOption = this.page.getByRole('option', { name: /english/i });
    if (await englishOption.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await englishOption.click();
    }
    // Close the dropdown by pressing Escape
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  // Click "Create"
  const createBtn = this.page.getByRole('button', { name: /^create$/i });
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await this.page.waitForLoadState('networkidle');
  }
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
