import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your board', exact: true })).toBeVisible();
});
test('source-only capture stays searchable and conflicting dates cannot be approved', async ({
  page,
}) => {
  await page.getByLabel('Dump anything here').fill('random thought: plants are cool');
  await page.getByRole('button', { name: 'Sort my pile' }).click();
  await expect(page.getByText('Original saved. No new actions to manage.')).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  const source = state.sources.find(
    (s: { rawText: string }) => s.rawText === 'random thought: plants are cool',
  );
  expect(state.items.filter((i: { sourceId: string }) => i.sourceId === source.id)).toHaveLength(0);
  const search = await (await page.request.get('/api/search?q=plants')).json();
  expect(search.sources.some((s: { id: string }) => s.id === source.id)).toBe(true);
  await page.getByLabel('Dump anything here').fill('Submit essay due September 18 or September 20');
  await page.getByRole('button', { name: 'Sort my pile' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add 0 to calendar' })).toBeDisabled();
});
test('microphone denial preserves an editable transcript fallback', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      },
    });
  });
  await page.getByRole('button', { name: 'Talk it out' }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access is unavailable');
  await page.getByLabel('Voice transcript').fill('Email Maya tomorrow');
  await page.getByRole('button', { name: 'Sort this' }).click();
  await expect(page.getByRole('heading', { name: 'Email Maya', exact: true })).toBeVisible();
});
test('settings network failure is recoverable without an unhandled error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/settings');
  await page.getByLabel('Timezone', { exact: true }).fill('Asia/Tokyo');
  await page.route('**/api/preferences', (r) =>
    r.request().method() === 'PATCH' ? r.abort() : r.continue(),
  );
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.locator('.error-banner[role=alert]')).toContainText(
    'Could not save your settings',
  );
  expect(errors).toEqual([]);
});
test('header hydrates without clock mismatch and follows the active timezone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2040-01-02T01:00:00Z') });
  for (const [timezone, day] of [
    ['America/Los_Angeles', 'January 1'],
    ['Asia/Tokyo', 'January 2'],
  ]) {
    const response = await page.request.patch('/api/preferences', { data: { timezone } });
    expect(response.ok()).toBe(true);
    await page.goto('/app');
    await expect(page.locator('.header-date strong')).toHaveText(day);
  }
  expect(errors).toEqual([]);
});
test('image-only PDF preserves original with an honest error and retry', async ({ page }) => {
  await page.getByLabel('Upload file').setInputFiles('tests/fixtures/image-only.pdf');
  await expect(page.locator('.error-banner').first()).toContainText('no readable text');
  await page.goto('/app/inbox');
  await expect(page.getByRole('button', { name: /image-only.pdf/ }).first()).toBeVisible();
});
test('requested search corpus stays filtered and exact item title ranks first', async ({
  page,
}) => {
  await page
    .getByLabel('Dump anything here')
    .fill(
      'Email Maya tomorrow; chemistry homework due Sunday; dentist Tuesday 3pm at West Campus Dental; email internship recruiter Friday',
    );
  await page.getByRole('button', { name: 'Sort my pile' }).click();
  await expect(page.getByRole('heading', { name: 'Email Maya', exact: true })).toBeVisible();
  for (const query of [
    'Maya',
    'chemistry deadlines',
    'HackRice',
    'dentist',
    'probability',
    'internship',
    'Tuesday',
  ]) {
    const r = await (await page.request.get('/api/search?q=' + encodeURIComponent(query))).json();
    expect(r.items.length + r.sources.length).toBeGreaterThan(0);
    expect(r.items.length).toBeLessThan(9);
  }
  const none = await (await page.request.get('/api/search?q=zzzzqwertyxyz123')).json();
  expect(none.items).toEqual([]);
  expect(none.sources).toEqual([]);
  const exact = await (await page.request.get('/api/search?q=Email%20Maya')).json();
  expect(exact.items[0].title).toBe('Email Maya');
});
test('all five requested timezone preferences survive refresh and new captures use them', async ({
  page,
}) => {
  for (const timezone of [
    'America/Chicago',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Asia/Tokyo',
  ]) {
    await page.goto('/app/settings');
    await page.getByLabel('Timezone', { exact: true }).fill(timezone);
    await page.getByRole('button', { name: 'Save timezone' }).click();
    await expect
      .poll(async () => (await (await page.request.get('/api/state')).json()).preferences.timezone)
      .toBe(timezone);
    await page.reload();
    await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue(timezone);
    await page.goto('/app');
    await page.getByLabel('Dump anything here').fill('Email timezone QA tomorrow ' + timezone);
    await page.getByRole('button', { name: 'Sort my pile' }).click();
    await expect(page.getByRole('button', { name: 'Sort my pile', exact: true })).toBeDisabled();
    await expect
      .poll(async () => {
        const s = await (await page.request.get('/api/state')).json();
        return s.sources.find(
          (x: { rawText: string }) => x.rawText === 'Email timezone QA tomorrow ' + timezone,
        )?.timezone;
      })
      .toBe(timezone);
  }
});
test('review shows real evidence and search distinguishes items from original sources', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Try a syllabus' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('3-page source', { exact: false })).toBeVisible();
  await dialog.getByText('Why this item?', { exact: true }).first().click();
  await expect(dialog.locator('blockquote').first()).toContainText('Meetings:');
  await expect(dialog.getByRole('button', { name: 'Download calendar file (.ics)' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const source = await (
    await page.request.post('/api/capture', {
      data: { text: 'Email Maya tomorrow', type: 'voice', timezone: 'America/Chicago' },
    })
  ).json();
  await page.request.post('/api/process/' + source.id);
  await page.goto('/app/search');
  await expect(
    page.getByRole('heading', { name: 'Start with something you remember' }),
  ).toBeVisible();
  await page.getByLabel('Search your pile').fill('Maya');
  await expect(page.getByRole('heading', { name: '1 item · 1 source', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources · the original context' })).toBeVisible();
  await expect(page.locator('.search-mode')).toHaveText('Local search');
});
test('pending microphone permission times out and a late stream is released', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    const w = window as unknown as { grantQA?: () => void; qaStopped?: boolean };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () =>
        new Promise((resolve) => {
          w.grantQA = () =>
            resolve({
              getTracks: () => [
                {
                  stop() {
                    w.qaStopped = true;
                  },
                },
              ],
            });
        }),
    });
  });
  await page.getByRole('button', { name: 'Talk it out' }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Waiting for microphone access…')).toBeVisible();
  await page.clock.fastForward(16000);
  await expect(page.locator('.error-banner')).toContainText(
    'Microphone permission is still pending',
  );
  await expect(page.getByRole('button', { name: 'Use sample transcript' })).toBeEnabled();
  await page.evaluate(() => (window as unknown as { grantQA: () => void }).grantQA());
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { qaStopped?: boolean }).qaStopped))
    .toBe(true);
});
