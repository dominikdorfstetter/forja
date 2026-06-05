import { When, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../../support/world';

When('I click {string}', async function (this: ForjaWorld, buttonText: string) {
  // 1. Try data-testid first
  const byTestId = this.page.locator(`[data-testid="${buttonText}"]`);
  if (await byTestId.isVisible().catch(() => false)) {
    await byTestId.click();
    return;
  }

  // 2. Try button role
  const byButton = this.page.getByRole('button', { name: buttonText });
  if (await byButton.isVisible().catch(() => false)) {
    await byButton.click();
    return;
  }

  // 3. Try link role (some clickable elements are <a> not <button>)
  const byLink = this.page.getByRole('link', { name: buttonText });
  if (await byLink.isVisible().catch(() => false)) {
    await byLink.click();
    return;
  }

  // 4. Try menuitem role (MUI menus)
  const byMenuItem = this.page.getByRole('menuitem', { name: buttonText });
  if (await byMenuItem.isVisible().catch(() => false)) {
    await byMenuItem.click();
    return;
  }

  // 5. Fallback: any clickable element with matching text
  await this.page.locator(`text=${buttonText}`).first().click();
});

When('I submit the form', async function (this: ForjaWorld) {
  await this.page.locator('button[type="submit"]').click();
  await this.page.waitForLoadState('networkidle');
});

When('I submit the form without filling required fields', async function (this: ForjaWorld) {
  await this.page.locator('button[type="submit"]').click();
});

When('I confirm the {word}', async function (this: ForjaWorld, action: string) {
  // Wait for the dialog/modal to appear
  const dialog = this.page.locator(
    '[role="dialog"], [role="alertdialog"], .MuiDialog-root, .MuiModal-root',
  );
  await dialog
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {
      // Dialog may already be visible or may not use a role attribute
    });

  // 1. Try data-testid variants for the confirm button
  const confirmByTestId = this.page.locator(
    '[data-testid="confirm-dialog-confirm"], [data-testid="dialog-confirm"], [data-testid="confirm-btn"]',
  );
  if (await confirmByTestId.first().isVisible().catch(() => false)) {
    await confirmByTestId.first().click();
    await this.page.waitForLoadState('networkidle');
    return;
  }

  // 2. Try a button whose text matches the action (e.g. "Delete", "Publish")
  const actionBtn = this.page.getByRole('button', { name: new RegExp(action, 'i') });
  if (await actionBtn.isVisible().catch(() => false)) {
    await actionBtn.click();
    await this.page.waitForLoadState('networkidle');
    return;
  }

  // 3. Fallback: look for common confirm button texts inside the dialog
  const fallbackPatterns = /confirm|delete|yes|remove|ok|submit|save|publish/i;
  const dialogScope = (await dialog.first().isVisible().catch(() => false))
    ? dialog.first()
    : this.page;
  const fallback = dialogScope.getByRole('button', { name: fallbackPatterns });
  await fallback.first().click();
  await this.page.waitForLoadState('networkidle');
});

When('I confirm by typing the site name', async function (this: ForjaWorld) {
  if (!this.currentSiteName) throw new Error('No current site name set');
  const confirmInput = this.page.locator('[data-testid="confirm-input"]');
  await confirmInput.fill(this.currentSiteName);
  const confirmBtn = this.page.locator('[data-testid="confirm-dialog-confirm"]');
  await confirmBtn.click();
  await this.page.waitForLoadState('networkidle');
});

When(
  'I fill in the {word} with:',
  async function (this: ForjaWorld, _component: string, dataTable: DataTable) {
    const rows = dataTable.rows();
    for (const [field, value] of rows) {
      // Try data-testid first, then name, then label
      const byTestId = this.page.locator(`[data-testid="field-${field}"]`);
      if (await byTestId.isVisible().catch(() => false)) {
        await byTestId.fill(value);
        continue;
      }

      const byName = this.page.locator(`[name="${field}"]`);
      if (await byName.isVisible().catch(() => false)) {
        await byName.fill(value);
        continue;
      }

      const byLabel = this.page.getByLabel(field, { exact: false });
      if (await byLabel.isVisible().catch(() => false)) {
        await byLabel.fill(value);
        continue;
      }

      throw new Error(`Could not find form field: ${field}`);
    }
  },
);

When('I fill in the site creation form with:', async function (this: ForjaWorld, dataTable: DataTable) {
  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
    await input.fill(value);
  }
});

When('I fill in the blog editor with:', async function (this: ForjaWorld, dataTable: DataTable) {
  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'title') {
      const titleInput = this.page.locator('[data-testid="field-title"], [name="title"]').first();
      await titleInput.fill(value);
    } else if (field === 'content') {
      // Tiptap editor — click into it and type
      const editor = this.page.locator('[data-testid="editor-content"] .tiptap, .ProseMirror').first();
      await editor.click();
      await editor.fill(value);
    } else if (field === 'slug') {
      const slugInput = this.page.locator('[data-testid="field-slug"], [name="slug"]').first();
      await slugInput.fill(value);
    }
  }
});

When('I fill in the page editor with:', async function (this: ForjaWorld, dataTable: DataTable) {
  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'content') {
      const editor = this.page.locator('[data-testid="editor-content"] .tiptap, .ProseMirror').first();
      await editor.click();
      await editor.fill(value);
    } else {
      const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
      await input.fill(value);
    }
  }
});

When('I fill in the document editor with:', async function (this: ForjaWorld, dataTable: DataTable) {
  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'content') {
      const editor = this.page.locator('[data-testid="editor-content"] .tiptap, .ProseMirror').first();
      await editor.click();
      await editor.fill(value);
    } else {
      const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
      await input.fill(value);
    }
  }
});

When('I leave the title empty', async function (this: ForjaWorld) {
  const titleInput = this.page.locator('[data-testid="field-title"], [name="title"]').first();
  await titleInput.fill('');
});

Given('I have just changed a member\'s role', async function (this: ForjaWorld) {
  // This is a precondition — the action was performed in a previous scenario or step
  // No-op: rely on scenario ordering or seed data
});

When('I edit the content to {string}', async function (this: ForjaWorld, newContent: string) {
  const editor = this.page.locator('[data-testid="editor-content"] .tiptap, .ProseMirror').first();
  await editor.click();
  // Select all and replace
  await this.page.keyboard.press('Meta+A');
  await this.page.keyboard.type(newContent);
});
