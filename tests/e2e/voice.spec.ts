import { test, expect } from '@playwright/test';

test('recorded audio uploads despite stale config, remains playable after failure, and retries', async ({
  page,
}) => {
  // Keep config false to reproduce a tab left open before the key was configured.
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.config.voice = false;
    await route.fulfill({ json: state });
  });
  const uploads: Buffer[] = [];
  await page.route('**/api/transcribe', async (route) => {
    uploads.push(route.request().postDataBuffer()!);
    await route.fulfill(
      uploads.length === 1
        ? { status: 502, json: { error: 'Temporary transcription failure' } }
        : { json: { text: 'Review my project tomorrow', provider: 'ElevenLabs', demo: false } },
    );
  });
  await page.goto('/app');
  await page.getByRole('button', { name: 'Talk it out' }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('meter')).toBeVisible();
  await expect(page.locator('.recording-time')).toHaveText('00:02');
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary transcription failure');
  expect(uploads).toHaveLength(1);
  expect(uploads[0].length).toBeGreaterThan(1000);
  expect(uploads[0].toString()).toContain('name="audio"');
  const player = page.getByLabel('Your recorded audio');
  await expect(player).toBeVisible();
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.readyState))
    .toBeGreaterThanOrEqual(2);
  await player.evaluate((audio: HTMLAudioElement) => audio.play());
  await expect
    .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Retry transcription' }).click();
  await expect(page.getByLabel('Voice transcript')).toHaveValue('Review my project tomorrow');
  await expect(page.getByRole('button', { name: 'Sort this' })).toBeEnabled();
  expect(uploads).toHaveLength(2);
  await page.getByRole('button', { name: 'Close dialog' }).click();
});

test('voice dialog refreshes provider configuration when opened', async ({ page }) => {
  let configured = false;
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.config.voice = configured;
    await route.fulfill({ json: state });
  });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your board', exact: true })).toBeVisible();
  configured = true;
  await page.getByRole('button', { name: 'Talk it out' }).click();
  await expect(page.getByText('ElevenLabs · speech-to-text configured')).toBeVisible();
});
