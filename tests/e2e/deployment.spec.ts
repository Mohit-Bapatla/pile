import { test, expect } from '@playwright/test';
import { MAX_UPLOAD_MB } from '../../lib/upload-limits';

test('oversized uploads stop before the network and leave capture usable', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/capture', async (route) => {
    uploads++;
    await route.continue();
  });
  await page.goto('/app');
  await page.getByLabel('Upload file').setInputFiles({
    name: 'oversized.txt',
    mimeType: 'text/plain',
    buffer: Buffer.alloc((MAX_UPLOAD_MB + 1) * 1024 * 1024, 'a'),
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a file' })).toContainText(
    `smaller than ${MAX_UPLOAD_MB} MB`,
  );
  expect(uploads).toBe(0);
  await expect(page.getByPlaceholder('Dump anything here…')).toBeEnabled();
});
