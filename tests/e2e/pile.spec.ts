import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your board', exact: true })).toBeVisible();
});
test('brain dump becomes an event and reminder with dates, then persists', async ({ page }) => {
  await page
    .getByLabel('Dump anything here')
    .fill('Physics exam Tuesday at 2 PM and remind me to email Alex tomorrow.');
  await page.getByRole('button', { name: 'Sort my pile', exact: true }).click();
  await expect(page.getByTestId('item-card').filter({ hasText: 'Physics exam' })).toBeVisible();
  await expect(page.getByTestId('item-card').filter({ hasText: 'Email Alex' })).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  const exam = state.items.find((i: { title: string }) => i.title === 'Physics exam');
  expect(exam.type).toBe('event');
  expect(exam.startDateTime).toContain('T');
  await page.reload();
  await expect(page.getByTestId('item-card').filter({ hasText: 'Physics exam' })).toBeVisible();
});
test('uploaded syllabus shows review with multiple dates and selective approval', async ({
  page,
}) => {
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('6 dates', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Assignment 1 due', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /Add 6 to calendar/ }).click();
  await expect(dialog).not.toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  expect(state.events.filter((e: { itemId?: string }) => e.itemId)).toHaveLength(6);
});
test('event flyer approval creates one demo event and sync state', async ({ page }) => {
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-event.png');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('HackRice Closing Ceremony', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/RMC Grand Hall/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Add 1 to calendar' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  const item = state.items.find((i: { title: string }) => i.title === 'HackRice Closing Ceremony');
  expect(item.calendarStatus).toBe('synced');
  const res = await page.request.post('/api/calendar/' + item.id);
  expect(res.ok()).toBe(true);
  const next = await (await page.request.get('/api/state')).json();
  expect(next.events.filter((e: { itemId: string }) => e.itemId === item.id)).toHaveLength(1);
  await page.getByLabel('Jump to date').fill('2026-09-20');
  await expect(page.getByText('HackRice Closing Ceremony', { exact: true })).toBeVisible();
});
test('sample voice uses transcription endpoint and the normal pipeline', async ({ page }) => {
  await page.getByRole('button', { name: 'Talk it out' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Use sample transcript' }).click();
  await expect(dialog.getByLabel('Voice transcript')).toHaveValue(/email Maya/);
  await dialog.getByRole('button', { name: 'Sort my words' }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'A few things found their place.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: 'Search', exact: false }).first().click();
  await page.getByLabel('Search your pile').fill('What did I say about Maya?');
  await expect(page.getByTestId('item-card').filter({ hasText: 'Email Maya' })).toBeVisible();
});
test('global search finds a seeded item', async ({ page }) => {
  await page.goto('/app/search');
  await page.getByLabel('Search your pile').fill('recruiter');
  await expect(page.getByRole('heading', { name: 'Email recruiter', exact: true })).toBeVisible();
});
test('editing, completing and reopening an item persists', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Email recruiter', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('Email recruiter about portfolio');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('button', {
      name: 'Complete Email recruiter about portfolio',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Email recruiter about portfolio',
      exact: true,
    }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Email recruiter about portfolio',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Reopen Email recruiter about portfolio',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Show active', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Email recruiter about portfolio',
      exact: true,
    }),
  ).toBeVisible();
});
test('source preview retains original capture, deletion removes its items', async ({ page }) => {
  await page.getByLabel('Dump anything here').fill('Email Juniper about the demo');
  await page.getByRole('button', { name: 'Sort my pile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Email Juniper about the demo' })).toBeVisible();
  await page.goto('/app/inbox');
  await page.getByRole('button', { name: /Email Juniper about the demo text/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Email Juniper about the demo', { exact: true })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Delete source & items' }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto('/app');
  await expect(
    page.getByRole('heading', { name: 'Email Juniper about the demo' }),
  ).not.toBeVisible();
});
test('rejects cross-origin writes and protects session-owned records', async ({
  page,
  browser,
}) => {
  const data = await (await page.request.get('/api/state')).json();
  const other = await browser.newContext();
  await other.request.get('http://127.0.0.1:3001/api/state');
  const r = await other.request.patch('http://127.0.0.1:3001/api/items/' + data.items[0].id, {
    data: { title: 'Changed' },
  });
  expect(r.ok()).toBe(false);
  const csrf = await page.request.post('/api/capture', {
    headers: { origin: 'https://untrusted.example' },
    data: { text: 'Not authorized' },
  });
  expect(csrf.status()).toBe(403);
  await other.close();
});
test('desktop and mobile routes render without runtime errors or overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.screenshot({
    path: 'docs/screenshots/board.png',
    fullPage: true,
    animations: 'disabled',
  });
  for (const route of [
    '/app/inbox',
    '/app/calendar',
    '/app/projects',
    '/app/search',
    '/app/settings',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your board', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'docs/screenshots/mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Talk it out' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.width).toBeLessThan(391);
  expect(errors).toEqual([]);
});

test('manual entry supports type, date removal, and deletion', async ({ page }) => {
  await page.getByRole('button', { name: 'New item', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('What’s on your mind?').fill('Check the art supply store');
  await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('reminder');
  await dialog.getByLabel('Date', { exact: true }).fill('2026-09-14');
  await dialog.getByRole('button', { name: 'Add to Pile' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Edit Check the art supply store' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Date', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  let snapshot = await (await page.request.get('/api/state')).json();
  let item = snapshot.items.find(
    (i: { title: string }) => i.title === 'Check the art supply store',
  );
  expect(item.type).toBe('reminder');
  expect(item.dueDate).toBeUndefined();
  await page.getByRole('button', { name: 'Edit Check the art supply store' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  snapshot = await (await page.request.get('/api/state')).json();
  item = snapshot.items.find((i: { title: string }) => i.title === 'Check the art supply store');
  expect(item).toBeUndefined();
});

test('calendar remove and re-add uses a fresh stable event ID', async ({ page }) => {
  const source = await (
    await page.request.post('/api/capture', {
      data: { text: 'Dentist next Tuesday at 3 PM', timezone: 'America/Chicago' },
    })
  ).json();
  const result = await (await page.request.post('/api/process/' + source.id)).json();
  const id = result.items[0].id;
  const first = await (await page.request.post('/api/calendar/' + id)).json();
  expect(first.calendarStatus).toBe('synced');
  expect((await page.request.delete('/api/calendar/' + id)).ok()).toBe(true);
  const second = await (await page.request.post('/api/calendar/' + id)).json();
  expect(second.calendarStatus).toBe('synced');
  expect(second.externalCalendarEventId).not.toBe(first.externalCalendarEventId);
  const snapshot = await (await page.request.get('/api/state')).json();
  expect(snapshot.events.filter((e: { itemId: string }) => e.itemId === id)).toHaveLength(1);
});
