import { test, expect } from '@playwright/test';

test.describe('Nested CRUD & File Content E2E', () => {
  const NESTED_DIR = `nested-test-${Date.now()}/level1/level2`;
  const FILE_NAME = 'deep-note.md';
  const FILE_CONTENT = 'This is deep text content that should persist.';
  const FILE_PATH = `${NESTED_DIR}/${FILE_NAME}`; // Implicit relative path logic in tool handles this? 
  // Tool takes "filename" which is path.

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    // Ensure input is ready
    await expect(page.getByTestId('chat-input')).toBeEnabled({ timeout: 15000 });
    // Switch to Write Mode
    await page.getByTestId('mode-write').click({ force: true });
  });

  async function sendMessage(page: any, message: string) {
    await expect(page.getByTestId('chat-input')).toBeEnabled({ timeout: 30000 });
    await page.getByTestId('chat-input').fill(message);
    await page.getByTestId('chat-input').press('Enter');
  }

  test('should create nested folder, write non-empty file, and perform CRUD', async ({ page }) => {
    // 1. Create Nested File (Should auto-create directories)
    await sendMessage(page, `Create a file at "${FILE_PATH}" with content: "${FILE_CONTENT}"`);

    // Wait for response indicating success
    // Using relaxed assertion
    const responseMsg = page.locator('[data-testid="chat-message"]').last();
    // Wait for streaming to start/text to appear
    await expect(responseMsg).not.toHaveText('', { timeout: 60000 });

    const text = await responseMsg.textContent();
    console.log("Creation Response:", text);

    // Check for "Error"
    if (text?.includes("Error")) console.log("AI reported error:", text);

    await expect(responseMsg).toContainText('Successfully wrote', { timeout: 30000 });

    // 2. Verify Content (Crucial check for "empty document" issue)
    await sendMessage(page, `Read the content of "${FILE_PATH}"`);
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText(FILE_CONTENT, { timeout: 30000 });

    // 3. Verify List Files (Tree format verification)
    await sendMessage(page, `List files in "nested-test-${Date.now().toString().substring(0, 8)}"`); // Heuristic matching or root list?
    // Let's list root to see the top folder
    await sendMessage(page, 'List files in current directory');
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText('nested-test', { timeout: 30000 });
    // Check for [DIR] tag from new tree format
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText('[DIR]');

    // 4. Update File
    const NEW_CONTENT = "Updated content.";
    await sendMessage(page, `Overwrite "${FILE_PATH}" with: "${NEW_CONTENT}"`);
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText('Successfully wrote', { timeout: 30000 });

    // 5. Read again to verify update
    await sendMessage(page, `Read "${FILE_PATH}"`);
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText(NEW_CONTENT, { timeout: 30000 });

    // 6. Delete File
    await sendMessage(page, `Delete "${FILE_PATH}"`);
    // Delete tool isn't implicitly bound in chat usually?
    // Wait, create/read/list are bound. Is delete bound?
    // I need to check api/chat/route.ts. Only list/read/write were bound in Mode 'write'.
    // If not bound, this step will fail or AI will say "I cannot delete".
    // I'll check route.ts first. If missing, I add it.
  });
});
