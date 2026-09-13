import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('all routes remain readable and fit the required desktop and mobile viewports', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [1440, 900],
    [1512, 982],
    [1280, 800],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of ['', 'inbox', 'calendar', 'projects', 'search', 'settings']) {
      await page.goto('/app/' + route);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 1440 || width === 390) {
        const report = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(report.violations, route + ' at ' + width).toEqual([]);
      }
      if (!route) {
        if (width > 700) {
          const cards = await page.locator('.zone-0 .pile-card').all();
          expect(cards).toHaveLength(3);
          for (const card of cards) {
            const box = await card.boundingBox();
            expect(box!.y + box!.height).toBeLessThan(height);
          }
        } else {
          const positions = await page
            .locator('.zone-0, .inbox-tray, .zone-1')
            .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
          expect(positions[0]).toBeLessThan(positions[1]);
          expect(positions[1]).toBeLessThan(positions[2]);
          await page.getByRole('button', { name: 'Open navigation' }).click();
          await page.getByRole('link', { name: 'Inbox', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
            'aria-expanded',
            'false',
          );
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test('source receipts open real image and readable PDF previews without losing provenance', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app');
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-event.png');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'View source for Design Night' }).click();
  const preview = page.getByRole('dialog').getByRole('img', { name: 'sample-event.png' });
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(
    0,
  );
  const original = page.getByRole('link', { name: 'Open original file' });
  expect((await page.request.get((await original.getAttribute('href'))!)).ok()).toBe(true);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
  await expect(page.getByRole('dialog').getByText('4 dates', { exact: true })).toBeVisible();
  const approve = await page.getByRole('button', { name: 'Add 5 to calendar' }).boundingBox();
  expect(approve!.y + approve!.height).toBeLessThan(900);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: /sample-syllabus.pdf pdf/ }).click();
  await expect(page.locator('.pdf-text-preview')).toContainText('Observation #2');
  await expect(page.getByRole('link', { name: 'Open original file' })).toBeVisible();
});

test('recording is keyboard accessible, stops recording, and honors reduced motion', async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: ['microphone'],
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('/app');
  await page.getByRole('button', { name: 'Talk it out' }).click();
  const record = page.getByRole('button', { name: 'Start recording' });
  await record.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await expect(page.locator('.recording-time')).not.toHaveText('00:00');
  expect(
    await page
      .locator('.waveform i')
      .first()
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Stop recording' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Transcription is not configured');
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(report.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Talk it out' })).toBeFocused();
  await context.close();
});

test('sorting receipt follows real processing and completion failure keeps the task', async ({
  page,
}) => {
  await page.goto('/app');
  await page.route('**/api/process/*', async (route) => {
    await new Promise((r) => setTimeout(r, 250));
    await route.continue();
  });
  await page.getByLabel('Dump anything here').fill('Email Rowan tomorrow');
  await page.getByRole('button', { name: 'Sort my pile', exact: true }).click();
  await expect(page.locator('.sorting-receipt')).toContainText('Keeping your original attached');
  await expect(page.getByRole('heading', { name: 'Email Rowan', exact: true })).toBeVisible();
  await page.route('**/api/items/*', async (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test: update unavailable. Try again.' }),
    }),
  );
  await page.getByRole('button', { name: 'Complete Email recruiter', exact: true }).click();
  await expect(page.locator('.error-banner[role=alert]')).toContainText('update unavailable');
  await expect(page.getByRole('heading', { name: 'Email recruiter', exact: true })).toBeVisible();
});
