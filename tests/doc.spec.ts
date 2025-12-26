import { test, expect } from '@playwright/test';

test.describe('Think App Doc E2E', () => {
  const DOC_NAME = `test-doc-${Date.now()}`;
  const DOC_FILENAME = `${DOC_NAME}.md`;

  test.beforeEach(async ({ page }) => {
    // Navigate to a new doc directly (or via New? New is easier to mock via URL)
    await page.goto(`/doc/${DOC_FILENAME}`);
  });

  test('should load editor, rename title, and save content', async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));

    // 1. Verify Editor loads (increase timeout for dynamic import)
    await expect(page.getByTestId('doc-editor')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('doc-title-input')).toHaveValue(DOC_NAME);

    // 2. Edit Content (ensures file is created on disk)
    // BlockNote editor is complex, usually contenteditable logic.
    // Click the specific editor class to ensure focus
    await page.locator('.bn-editor').click();
    await page.keyboard.type("Hello World from Playwright");

    // 3. Verify "Saving..." or similar state? 
    // The UI shows "Saving..." if saving is true.
    // Wait a bit for debounce (1s) and save fetch.
    await page.waitForTimeout(5000);

    // Check if content matches (local verification)
    await expect(page.getByTestId('doc-editor')).toContainText("Hello World from Playwright", { timeout: 15000 });

    // 4. Rename (Requires file to exist)
    const NEW_TITLE = `${DOC_NAME}-renamed`;
    await page.getByTestId('doc-title-input').fill(NEW_TITLE);
    await page.getByTestId('doc-title-input').blur(); // Trigger save/rename

    // 5. Verify URL change (rename redirects)
    await expect(page).toHaveURL(new RegExp(`${NEW_TITLE}.md`));
  });

  test('should navigate back to drive', async ({ page }) => {
    await page.getByTestId('doc-back-button').click();
    await expect(page).toHaveURL(/\/drive/);
  });
});
