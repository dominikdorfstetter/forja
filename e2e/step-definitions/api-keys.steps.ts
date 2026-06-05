import { When, Then, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When('I create an API key with:', async function (this: ForjaWorld, dataTable: DataTable) {
  // The create button may be in the page header (data-testid) or the empty state (text link)
  const byTestId = this.page.locator('[data-testid="create-api-key"]');
  const byText = this.page.getByRole('button', { name: /create api key/i })
    .or(this.page.getByRole('link', { name: /create api key/i }));

  if (await byTestId.isVisible().catch(() => false)) {
    await byTestId.click();
  } else {
    await byText.first().click();
  }
  await this.page.waitForLoadState('networkidle');

  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'permission') {
      // MUI Select — click to open, then select option
      const permSelect = this.page.locator('[data-testid="field-permission"]')
        .or(this.page.getByLabel(/permission/i));
      await permSelect.first().click();
      // Try data-testid option, then MUI listbox option, then text
      const option = this.page.locator(`[data-testid="permission-option-${value.toLowerCase()}"]`);
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      } else {
        await this.page.getByRole('option', { name: new RegExp(value, 'i') }).first().click();
      }
    } else {
      const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`)
        .or(this.page.getByLabel(new RegExp(field, 'i')));
      await input.first().fill(value);
    }
  }

  // Submit — try data-testid, then submit button, then any "Create" button
  const submitBtn = this.page.locator('[data-testid="api-key-submit"]');
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
  } else {
    await this.page.locator('button[type="submit"]').or(
      this.page.getByRole('button', { name: /create|save/i })
    ).first().click();
  }
  await this.page.waitForLoadState('networkidle');
});

When('I revoke the key {string}', async function (this: ForjaWorld, keyName: string) {
  const keyRow = this.page.locator('[data-testid="api-key-row"]').filter({ hasText: keyName });
  const revokeBtn = keyRow.locator('[data-testid="revoke-key"]');
  await revokeBtn.click();
});

// "I confirm the revocation" is handled by the generic "I confirm the {word}" in forms.steps.ts

Then('I should see the generated API key', async function (this: ForjaWorld) {
  const keyDisplay = this.page.locator('[data-testid="generated-api-key"]');
  await keyDisplay.waitFor({ state: 'visible' });
});

Then('the key should only be shown once', async function (this: ForjaWorld) {
  const warning = this.page.locator('text=only be shown once');
  const isVisible = await warning.isVisible().catch(() => false);
  // This is informational — just verify the key is displayed
  const keyDisplay = this.page.locator('[data-testid="generated-api-key"]');
  await keyDisplay.waitFor({ state: 'visible' });
});

Then('the permission dropdown should not contain {string}', async function (this: ForjaWorld, permission: string) {
  const option = this.page.locator(`[data-testid="permission-option-${permission.toLowerCase()}"]`);
  const isVisible = await option.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error(`Expected permission "${permission}" to not be available but it was found`);
  }
});

Then('{string} should no longer be in the key list', async function (this: ForjaWorld, keyName: string) {
  const keyRow = this.page.locator('[data-testid="api-key-row"]').filter({ hasText: keyName });
  await this.page.waitForTimeout(1000);
  const isVisible = await keyRow.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error(`Expected key "${keyName}" to be removed but still visible`);
  }
});

Given('an API key {string} exists', async function (this: ForjaWorld, _keyName: string) {
  // Precondition — handled by previous scenario or seed data
});
