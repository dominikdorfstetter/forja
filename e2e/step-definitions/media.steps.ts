import { When, Then } from '@cucumber/cucumber';
import * as path from 'path';
import { ForjaWorld } from '../support/world';

When('I upload file {string}', async function (this: ForjaWorld, filePath: string) {
  const absolutePath = path.resolve(__dirname, '..', filePath);

  // File inputs are usually hidden — setInputFiles works regardless of visibility.
  // Try data-testid first, then any file input on the page.
  const byTestId = this.page.locator('[data-testid="media-upload-input"]');
  const byType = this.page.locator('input[type="file"]');

  const fileInput = (await byTestId.count()) > 0 ? byTestId.first() : byType.first();

  // If there is an upload button that triggers the file dialog, we can skip clicking
  // it and set the input directly — setInputFiles works on hidden inputs.
  await fileInput.setInputFiles(absolutePath);
  await this.page.waitForLoadState('networkidle');
});

When('I create folder {string}', async function (this: ForjaWorld, folderName: string) {
  await this.page.click('[data-testid="create-folder"]');
  const nameInput = this.page.locator('[data-testid="field-folder-name"], [name="folder-name"]').first();
  await nameInput.fill(folderName);
  await this.page.click('[data-testid="folder-submit"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When(
  'I move {string} to folder {string}',
  async function (this: ForjaWorld, fileName: string, folderName: string) {
    const fileItem = this.page.locator('[data-testid="media-item"]').filter({ hasText: fileName });
    await fileItem.waitFor({ state: 'visible', timeout: 10000 });

    // Strategy 1: Look for a move button directly on the item
    const moveBtn = fileItem.locator('[data-testid="move-media"], [aria-label*="Move"]');
    if (await moveBtn.isVisible().catch(() => false)) {
      await moveBtn.click();
    } else {
      // Strategy 2: Select the item first, then look for toolbar move action
      await fileItem.click();
      const toolbarMove = this.page.locator(
        '[data-testid="move-selected"], [aria-label*="Move"], button:has-text("Move")',
      );
      if (
        await toolbarMove
          .first()
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await toolbarMove.first().click();
      } else {
        // Strategy 3: Right-click context menu
        await fileItem.click({ button: 'right' });
        await this.page.locator('text=Move to').click();
      }
    }

    // Select target folder
    await this.page.locator(`text=${folderName}`).click();
    await this.page.waitForLoadState('networkidle');
  },
);

When('I delete {string}', async function (this: ForjaWorld, fileName: string) {
  const fileItem = this.page.locator('[data-testid="media-item"]').filter({ hasText: fileName });
  await fileItem.waitFor({ state: 'visible', timeout: 10000 });

  // Strategy 1: Look for a delete button/icon directly on or near the item
  const deleteBtn = fileItem.locator(
    '[data-testid="delete-media"], [aria-label="Delete"], [aria-label="delete"]',
  );
  if (await deleteBtn.isVisible().catch(() => false)) {
    await deleteBtn.click();
    return;
  }

  // Strategy 2: Select/click the item first, then look for a toolbar delete action
  await fileItem.click();
  const toolbarDelete = this.page.locator(
    '[data-testid="delete-selected"], [aria-label="Delete"], button:has-text("Delete")',
  );
  if (
    await toolbarDelete
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
  ) {
    await toolbarDelete.first().click();
    return;
  }

  // Strategy 3: Right-click context menu as a last resort
  await fileItem.click({ button: 'right' });
  await this.page.locator('text=Delete').click();
});

// "I confirm the deletion" is handled by the generic "I confirm the {word}" in forms.steps.ts

Then(
  'I should see {string} in the media library',
  async function (this: ForjaWorld, fileName: string) {
    const mediaItem = this.page.locator('[data-testid="media-item"]').filter({ hasText: fileName });
    await mediaItem.waitFor({ state: 'visible' });
  },
);

Then(
  'I should see {string} in the folder list',
  async function (this: ForjaWorld, folderName: string) {
    const folder = this.page.locator('[data-testid="media-folder"]').filter({ hasText: folderName });
    await folder.waitFor({ state: 'visible' });
  },
);

Then(
  '{string} should be inside {string}',
  async function (this: ForjaWorld, fileName: string, folderName: string) {
    // Navigate to the folder
    const folder = this.page.locator('[data-testid="media-folder"]').filter({ hasText: folderName });
    await folder.click();
    await this.page.waitForLoadState('networkidle');
    // Verify file is there
    const fileItem = this.page.locator('[data-testid="media-item"]').filter({ hasText: fileName });
    await fileItem.waitFor({ state: 'visible' });
  },
);

Then('I should see the media library', async function (this: ForjaWorld) {
  await this.page.locator('[data-testid="media-library"]').waitFor({ state: 'visible' });
});

Then(
  '{string} should no longer be in the media library',
  async function (this: ForjaWorld, fileName: string) {
    const item = this.page.locator('[data-testid="media-item"]').filter({ hasText: fileName });
    await this.page.waitForTimeout(1000);
    const isVisible = await item.isVisible().catch(() => false);
    if (isVisible) {
      throw new Error(`Expected "${fileName}" to be deleted but still visible`);
    }
  },
);
