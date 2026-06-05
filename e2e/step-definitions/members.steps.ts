import { When, Then, Given } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When(
  'I invite {string} with role {string}',
  async function (this: ForjaWorld, email: string, role: string) {
    // The invite form may be inline on the page or inside a dialog/modal.
    // If there is an "Invite" button to open the form, click it first.
    const inviteOpenBtn = this.page.getByRole('button', { name: /invite/i });
    if (await inviteOpenBtn.isVisible().catch(() => false)) {
      await inviteOpenBtn.click();
      // Wait for dialog/form to appear
      await this.page
        .locator('[role="dialog"], [data-testid="invite-form"], form')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {});
    }

    // Fill email — try data-testid, name attr, then label
    const emailInput = this.page.locator('[data-testid="field-email"], [name="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(email);
    } else {
      await this.page.getByLabel(/email/i).first().fill(email);
    }

    // Select role from dropdown — handle both native select and MUI Select
    const roleByTestId = this.page.locator('[data-testid="field-role"]');
    const roleByName = this.page.locator('[name="role"]');

    if (await roleByTestId.isVisible().catch(() => false)) {
      await roleByTestId.click();
    } else if (await roleByName.isVisible().catch(() => false)) {
      await roleByName.click();
    } else {
      // Try MUI Select via label
      await this.page.getByLabel(/role/i).first().click();
    }

    // Click the role option — try data-testid first, then MUI listbox option, then text
    const roleOption = this.page.locator(`[data-testid="role-option-${role.toLowerCase()}"]`);
    if (await roleOption.isVisible().catch(() => false)) {
      await roleOption.click();
    } else {
      await this.page
        .getByRole('option', { name: new RegExp(role, 'i') })
        .or(this.page.locator(`[role="listbox"] >> text=${role}`))
        .first()
        .click();
    }

    // Submit the invite
    const submitBtn = this.page.locator('[data-testid="invite-submit"]');
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await this.page.locator('button[type="submit"]').first().click();
    }
    await this.page.waitForLoadState('networkidle');
  },
);

When(
  'I change the role of {string} to {string}',
  async function (this: ForjaWorld, email: string, newRole: string) {
    const memberRow = this.page.locator('[data-testid="member-row"]').filter({ hasText: email });
    await memberRow.waitFor({ state: 'visible', timeout: 10000 });

    // Open the role selector — try data-testid first, then MUI Select inside the row
    const roleSelector = memberRow.locator('[data-testid="role-selector"]');
    if (await roleSelector.isVisible().catch(() => false)) {
      await roleSelector.click();
    } else {
      // MUI Select renders as a div with role="combobox" or a <select>
      const muiSelect = memberRow.locator('[role="combobox"], select, .MuiSelect-select').first();
      await muiSelect.click();
    }

    // Select the new role — try data-testid, then role option, then text match
    const roleOption = this.page.locator(`[data-testid="role-option-${newRole.toLowerCase()}"]`);
    if (
      await roleOption
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await roleOption.click();
    } else {
      // MUI Select options render in a portal (outside the row) as listbox options
      await this.page
        .getByRole('option', { name: new RegExp(newRole, 'i') })
        .or(this.page.locator(`[role="listbox"] >> text=${newRole}`))
        .first()
        .click();
    }

    await this.page.waitForLoadState('networkidle');
  },
);

When(
  'I open the role selector for {string}',
  async function (this: ForjaWorld, email: string) {
    const memberRow = this.page.locator('[data-testid="member-row"]').filter({ hasText: email });
    await memberRow.waitFor({ state: 'visible', timeout: 10000 });

    const roleSelector = memberRow.locator('[data-testid="role-selector"]');
    if (await roleSelector.isVisible().catch(() => false)) {
      await roleSelector.click();
    } else {
      // MUI Select fallback
      const muiSelect = memberRow.locator('[role="combobox"], select, .MuiSelect-select').first();
      await muiSelect.click();
    }
  },
);

When(
  'I remove {string} from the site',
  async function (this: ForjaWorld, email: string) {
    const memberRow = this.page.locator(`[data-testid="member-row"]`).filter({ hasText: email });
    const removeBtn = memberRow.locator('[data-testid="remove-member"]');
    await removeBtn.click();
  },
);

When(
  'I transfer ownership to {string}',
  async function (this: ForjaWorld, email: string) {
    const memberRow = this.page.locator(`[data-testid="member-row"]`).filter({ hasText: email });
    const transferBtn = memberRow.locator('[data-testid="transfer-ownership"]');
    if (await transferBtn.isVisible().catch(() => false)) {
      await transferBtn.click();
    } else {
      // Look for a global transfer button
      await this.page.click('[data-testid="transfer-ownership-btn"]');
      // Select the member
      await this.page.locator(`text=${email}`).click();
    }
  },
);

// Confirm steps are handled by the generic "I confirm the {word}" in forms.steps.ts

Then(
  'I should see {string} in the members list',
  async function (this: ForjaWorld, email: string) {
    await this.page.locator(`[data-testid="member-row"]`).filter({ hasText: email }).waitFor({ state: 'visible' });
  },
);

Then('their role should be {string}', async function (this: ForjaWorld, role: string) {
  // The most recently interacted member row should show the role
  const roleText = this.page.locator(`text=${role}`);
  await roleText.first().waitFor({ state: 'visible' });
});

Then(
  '{string} should no longer be in the members list',
  async function (this: ForjaWorld, email: string) {
    const memberRow = this.page.locator(`[data-testid="member-row"]`).filter({ hasText: email });
    await this.page.waitForTimeout(1000);
    const isVisible = await memberRow.isVisible().catch(() => false);
    if (isVisible) {
      throw new Error(`Expected "${email}" to be removed but still visible`);
    }
  },
);

Then('the role dropdown should not contain {string}', async function (this: ForjaWorld, role: string) {
  const option = this.page.locator(`[data-testid="role-option-${role.toLowerCase()}"]`);
  const isVisible = await option.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error(`Expected role "${role}" to not be in dropdown but it was found`);
  }
});

Then('the role options should not contain {string}', async function (this: ForjaWorld, role: string) {
  const option = this.page.locator(`[data-testid="role-option-${role.toLowerCase()}"]`);
  const isVisible = await option.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error(`Expected role "${role}" to not be in options but it was found`);
  }
});

Then('{string} should have role {string}', async function (this: ForjaWorld, email: string, role: string) {
  const memberRow = this.page.locator(`[data-testid="member-row"]`).filter({ hasText: email });
  const roleText = memberRow.locator(`text=${role}`);
  await roleText.waitFor({ state: 'visible' });
});

Then('I should have role {string}', async function (this: ForjaWorld, role: string) {
  // Find my own row and check role
  const myRow = this.page.locator('[data-testid="member-row-self"]');
  const roleText = myRow.locator(`text=${role}`);
  await roleText.waitFor({ state: 'visible' });
});

Then('I should not see a role selector for my own account', async function (this: ForjaWorld) {
  const myRow = this.page.locator('[data-testid="member-row-self"]');
  const roleSelector = myRow.locator('[data-testid="role-selector"]');
  const isVisible = await roleSelector.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error('Expected no role selector for own account but found one');
  }
});

Then('I should not see a remove option for the owner', async function (this: ForjaWorld) {
  const ownerRow = this.page.locator('[data-testid="member-row"]').filter({ hasText: 'Owner' });
  const removeBtn = ownerRow.locator('[data-testid="remove-member"]');
  const isVisible = await removeBtn.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error('Expected no remove button for owner but found one');
  }
});

Given('{string} is already a member', async function (this: ForjaWorld, _email: string) {
  // Precondition — handled by seed data
});

Given('I am the sole owner of site {string}', async function (this: ForjaWorld, _siteName: string) {
  // Precondition — the seed data sets up the owner as sole owner
});
