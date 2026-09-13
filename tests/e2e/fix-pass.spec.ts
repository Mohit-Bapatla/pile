import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your board', exact: true })).toBeVisible();
});
test('search filters shared captures, chemistry deadlines, and nonsense', async ({ page }) => {
  const source = await (
    await page.request.post('/api/capture', {
      data: {
        text: 'Email Maya about internships; Chemistry homework due September 20, 2026; Finish HackRice slides',
      },
    })
  ).json();
  await page.request.post('/api/process/' + source.id);
  await page.goto('/app/search');
  const input = page.getByLabel('Search your pile');
  await input.fill('Maya');
  await expect(page.getByTestId('item-card')).toHaveCount(1);
  await expect(page.getByTestId('item-card')).toContainText('Maya');
  await input.fill('chemistry deadlines');
  await expect(page.getByTestId('item-card')).toHaveCount(1);
  await expect(page.getByTestId('item-card')).toContainText('Chemistry homework');
  await input.fill('zzqxv impossible');
  await expect(page.getByTestId('item-card')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Nothing in your pile matches that yet.' }),
  ).toBeVisible();
});
test('selective syllabus review edits in place, exports valid ICS, and rejects duplicates', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Syllabus ready' })).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(7);
  await expect(dialog.getByLabel('Select UGS 303 Office hours', { exact: true })).not.toBeChecked();
  await expect(dialog.getByLabel('Select UGS 303 Lecture', { exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Add 0 to calendar' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Select all important' }).click();
  await dialog.getByRole('button', { name: 'Edit candidate UGS 303 Office hours' }).click();
  await dialog.getByLabel('Keep under').selectOption('important');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await dialog.getByRole('button', { name: 'Select all important' }).click();
  await expect(dialog.getByRole('button', { name: 'Add 6 to calendar' })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download calendar file (.ics)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Pile-UGS303.ics');
  const ics = await readFile((await download.path())!, 'utf8');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(6);
  expect(ics).toContain('RRULE:FREQ=WEEKLY');
  await expect(dialog.getByRole('status')).toContainText('Exported');
  await dialog.getByRole('button', { name: 'Add 6 to calendar' }).click();
  await expect(dialog.getByText('Calendar:', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm add 6' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
  await expect(dialog.getByRole('heading', { name: 'Syllabus ready' })).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  expect(
    state.sources.filter((s: { fileName: string }) => s.fileName === 'sample-syllabus.pdf'),
  ).toHaveLength(1);
  expect(state.events.filter((e: { itemId?: string }) => e.itemId)).toHaveLength(6);
});
test('recorded blob transcribes through server contract then editable transcript sorts', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/state', async (route) => {
    const r = await route.fetch();
    const data = await r.json();
    data.config.voice = true;
    await route.fulfill({ json: data });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => [{ stop() {} }] }),
    });
    class Recorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      onstop?: () => void;
      ondataavailable?: (e: { data: Blob }) => void;
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['prerecorded-audio'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: Recorder });
  });
  let recorded = false;
  let releaseTranscript!: () => void;
  const transcriptGate = new Promise<void>((resolve) => {
    releaseTranscript = resolve;
  });
  await page.route('**/api/transcribe', async (route) => {
    recorded = true;
    expect(route.request().postDataBuffer()?.toString()).toContain('prerecorded-audio');
    await transcriptGate;
    await route.fulfill({
      json: {
        text: 'I need to email Maya tomorrow and dentist Tuesday at three.',
        demo: false,
        provider: 'ElevenLabs',
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Talk it out' }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByText('Transcribing your recording…', { exact: true })).toBeVisible();
  releaseTranscript();
  const transcript = page.getByLabel('Voice transcript');
  await expect(transcript).toHaveValue(/email Maya/);
  await transcript.fill('I need to email Maya tomorrow and dentist Tuesday at 3 PM.');
  await page.getByRole('button', { name: 'Sort this' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Edit candidate Email Maya' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Email Maya', exact: true })).toBeVisible();
  expect(recorded).toBe(true);
  const state = await (await page.request.get('/api/state')).json();
  const voice = state.sources.find((s: { type: string }) => s.type === 'voice');
  expect(voice.durationSeconds).toBeGreaterThan(0);
  expect(voice.transcription).toContain('3 PM');
  expect(state.items.filter((i: { sourceId: string }) => i.sourceId === voice.id)).toHaveLength(2);
});
test('timezone selection survives reload, updates timed cards, and preserves date-only deadlines', async ({
  page,
}) => {
  await page.request.patch('/api/preferences', { data: { timezone: 'America/Chicago' } });
  const source = await (
    await page.request.post('/api/capture', {
      data: {
        text: 'Dentist September 15, 2026 at 3 PM; Chemistry homework due September 20, 2026',
        timezone: 'America/Chicago',
      },
    })
  ).json();
  await page.request.post('/api/process/' + source.id);
  await page.reload();
  const card = page.getByTestId('item-card').filter({ hasText: 'Dentist' });
  await expect(card.locator('.card-meta')).toContainText('3:00 PM');
  await page.goto('/app/settings');
  await page.getByLabel('Timezone', { exact: true }).fill('America/New_York');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await page.reload();
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue('America/New_York');
  await page.goto('/app');
  await expect(card.locator('.card-meta')).toContainText('4:00 PM');
  await expect(
    page.getByTestId('item-card').filter({ hasText: 'Chemistry homework' }).locator('.card-meta'),
  ).toContainText('Sep 20');
});
test('review and PDF preview remain usable at three target sizes', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
  await expect(page.getByRole('heading', { name: 'Syllabus ready' })).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const button = await page.getByRole('button', { name: 'Add 5 to calendar' }).boundingBox();
    expect(button!.y + button!.height).toBeLessThan(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: `test-results/fix-review-${width}.png`, animations: 'disabled' });
  }
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: /sample-syllabus.pdf pdf/ }).click();
  const image = page.getByRole('img', { name: /PDF page 1/ });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((n) => (n as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('img', { name: /PDF page 2/ })).toBeVisible();
});
test('synced demo event can be edited without creating another event', async ({ page }) => {
  const source = await (
    await page.request.post('/api/capture', {
      data: { text: 'Dentist September 15, 2026 at 3 PM' },
    })
  ).json();
  const result = await (await page.request.post('/api/process/' + source.id)).json();
  const item = result.items[0];
  await page.request.post('/api/calendar/' + item.id);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Dentist appointment', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Dentist follow-up');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  expect(state.events.filter((e: { itemId?: string }) => e.itemId === item.id)).toHaveLength(1);
  expect(state.events.find((e: { itemId?: string }) => e.itemId === item.id).title).toBe(
    'Dentist follow-up',
  );
});
