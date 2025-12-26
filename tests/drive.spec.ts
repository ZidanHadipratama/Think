import { test, expect } from '@playwright/test';

test.describe('Think App Drive E2E', () => {
  const TEST_FOLDER_NAME = `test-folder-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    // Navigate to Drive (home)
    await page.goto('/drive');
  });

  test('should create and verify a new folder', async ({ page }) => {
    // 1. Open "New" menu
    await page.getByTestId('nav-new-button').click();

    // 2. Select "New Folder"
    await page.getByTestId('nav-new-folder').click();

    // 3. Expect Redirect / Dialog to appear
    // The "New Folder" action redirects to /drive?action=new_folder which opens the dialog.
    // Wait for input to be visible
    await expect(page.getByTestId('new-folder-input')).toBeVisible();

    // 4. Fill folder name
    await page.getByTestId('new-folder-input').fill(TEST_FOLDER_NAME);

    // 5. Create
    await page.getByTestId('create-folder-confirm').click();

    // 6. Verify folder exists in list
    // Use proper text locator for the item name
    await expect(page.locator(`[data-testid="drive-item"]`).filter({ hasText: TEST_FOLDER_NAME })).toBeVisible();

    // Cleanup logic (Optional but good)
    // We can right-click to delete, but context menu testing can be flaky without specific IDs.
    // For now, let's just verify creation.
  });
});
