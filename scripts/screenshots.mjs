import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const req = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium, expect } = req('@playwright/test');
const { default: AxeBuilder } = req('@axe-core/playwright');
const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['microphone'],
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const out = path.resolve('docs/screenshots');
await mkdir(out, { recursive: true });
const report = [];
async function shot(name, fullPage = false) {
  await expect(page.locator('.loading-state')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage, animations: 'disabled' });
  console.log(name);
}
async function audit(name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  report.push({
    state: name,
    violations: r.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  });
}
await page.goto('http://127.0.0.1:3003/app');
await page.getByRole('heading', { name: 'Your board', exact: true }).waitFor();
await shot('board');
await shot('board-full', true);
for (const [width, height] of [
  [1512, 982],
  [1280, 800],
  [390, 844],
]) {
  await page.setViewportSize({ width, height });
  await shot(width === 390 ? 'mobile' : 'board-' + width);
  if (width === 390) await shot('mobile-full', true);
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByRole('button', { name: 'Show welcome guide' }).click();
await shot('onboarding');
await audit('onboarding');
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.getByRole('button', { name: 'Edit Email recruiter', exact: true }).click();
await shot('item-edit');
await audit('item editor');
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.getByRole('button', { name: 'Talk it out' }).click();
await shot('voice');
await page.getByRole('button', { name: 'Start recording' }).click();
await page.waitForTimeout(1100);
await shot('recording');
await audit('recording');
await page.getByRole('button', { name: 'Stop recording' }).click();
await page.getByRole('button', { name: 'Use sample transcript' }).click();
await expect(page.getByLabel('Voice transcript')).toHaveValue(/email Maya/);
await expect(page.getByRole('button', { name: 'Sort this' })).toBeEnabled();
await shot('capture');
await audit('voice transcript');
await page.getByRole('button', { name: 'Sort this' }).click();
await page.getByRole('dialog').waitFor();
await shot('voice-review');
await audit('voice review');
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
await page.getByRole('button', { name: 'Add 5 to calendar' }).waitFor();
await shot('review');
await audit('PDF review');
await page.getByRole('button', { name: 'Add 5 to calendar' }).click();
await shot('calendar-confirmation');
await page.getByRole('button', { name: 'Confirm add 5' }).click();
await page.getByRole('dialog').waitFor({ state: 'hidden' });
await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-event.png');
await page.getByRole('button', { name: 'Add 1 to calendar' }).waitFor();
await page.getByRole('button', { name: 'Add 1 to calendar' }).click();
await page.getByRole('button', { name: 'Confirm add 1' }).click();
await page.getByRole('dialog').waitFor({ state: 'hidden' });
await page.goto('http://127.0.0.1:3003/app/inbox');
await shot('inbox');
await audit('mixed-source inbox');
await page.getByRole('button', { name: /sample-event.png image/ }).click();
await shot('source-image');
await audit('source image');
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.getByRole('button', { name: /sample-syllabus.pdf pdf/ }).click();
await shot('source-pdf');
await audit('source PDF preview');
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.goto('http://127.0.0.1:3003/app/calendar');
await page.getByLabel('Jump to date').fill('2026-09-17');
await page.getByLabel('Jump to date').blur();
await shot('calendar');
await page.setViewportSize({ width: 390, height: 844 });
await shot('calendar-mobile');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://127.0.0.1:3003/app/search');
await page.getByLabel('Search your pile').fill('Maya');
await page.getByRole('heading', { name: /Email Maya/ }).waitFor();
await page.getByLabel('Search your pile').blur();
await shot('search');
await page.getByLabel('Search your pile').fill('zzmissingneedle');
await page.getByText('0 items · 0 sources', { exact: true }).waitFor();
await shot('empty');
await audit('empty search');
await page.goto('http://127.0.0.1:3003/app/projects');
await shot('projects');
await page.locator('.project-card').first().click();
await shot('project-detail');
await audit('project detail');
await page.goto('http://127.0.0.1:3003/app/settings');
await shot('settings');
await page.goto('http://127.0.0.1:3003/app');
await page
  .getByLabel('Upload file')
  .setInputFiles({ name: 'unsupported.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y') });
await page.locator('.error-banner[role=alert]').waitFor();
await shot('error');
await audit('file error');
await context.close();
const emptyContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
const emptyPage = await emptyContext.newPage();
await emptyPage.route('**/api/state', async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  await route.fulfill({
    response,
    json: { ...json, items: [], sources: [], projects: [], events: [] },
  });
});
await emptyPage.goto('http://127.0.0.1:3003/app');
await emptyPage.getByText('Nothing is yelling at you here.').first().waitFor();
await emptyPage.screenshot({ path: path.join(out, 'empty-board-mobile.png'), fullPage: true });
await emptyContext.close();
console.log(JSON.stringify(report));
await writeFile('docs/ACCESSIBILITY_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
await browser.close();
