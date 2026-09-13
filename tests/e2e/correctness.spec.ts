import { test, expect } from '@playwright/test';

test('atomic academic capture has independent dates, edits, source traceability and deletion', async ({
  page,
  baseURL,
}) => {
  expect(new URL(baseURL!).port).toBe('3002');
  await page.goto('/app');
  await page
    .getByLabel('Dump anything here')
    .fill('I have a linear algebra midterm Wednesday and calc homework due Friday.');
  await page.getByRole('button', { name: 'Sort my pile' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);
  await expect(
    dialog.getByRole('button', { name: 'Edit candidate Linear algebra midterm' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Edit candidate Calculus homework' }),
  ).toBeVisible();
  let state = await (await page.request.get('/api/state')).json();
  const source = state.sources.find((s: { rawText: string }) =>
    s.rawText.startsWith('I have a linear algebra'),
  );
  const siblings = state.items.filter((i: { sourceId: string }) => i.sourceId === source.id);
  expect(siblings).toHaveLength(2);
  const midterm = siblings.find((i: { title: string }) => i.title === 'Linear algebra midterm');
  const homework = siblings.find((i: { title: string }) => i.title === 'Calculus homework');
  expect(new Date(midterm.startDateTime).getUTCDay()).toBe(3);
  expect(new Date(homework.dueDate).getUTCDay()).toBe(5);
  await dialog.getByRole('button', { name: 'Edit candidate Linear algebra midterm' }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('Linear algebra midterm revised');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(
    page.getByRole('heading', { name: 'Linear algebra midterm revised', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Calculus homework', exact: true })).toBeVisible();
  await page.request.delete('/api/items/' + midterm.id);
  state = await (await page.request.get('/api/state')).json();
  expect(state.sources.some((s: { id: string }) => s.id === source.id)).toBe(true);
  expect(state.items.find((i: { id: string }) => i.id === homework.id).dueDate).toBe(
    homework.dueDate,
  );
});

test('calendar completion and reopening persist on Board; external events have no completion', async ({
  page,
}) => {
  await page.goto('/app');
  const initial = await (await page.request.get('/api/state')).json();
  const deadline = initial.items.find((i: { title: string }) => i.title === 'Probability homework');
  await page.request.post('/api/calendar/' + deadline.id);
  await page.goto('/app/calendar');
  await expect(
    page.getByRole('button', { name: 'Complete Coffee with Maya', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Complete Probability homework', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reopen Probability homework', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Reopen Probability homework', exact: true }),
  ).toBeVisible();
  await page.goto('/app');
  await expect(
    page.getByRole('heading', { name: 'Probability homework', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Probability homework', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reopen Probability homework', exact: true }).click();
  await page.goto('/app/calendar');
  await expect(
    page.getByRole('button', { name: 'Complete Probability homework', exact: true }),
  ).toBeVisible();
});

test('100 independent actions have a scrollable review and preserve clean titles', async ({
  page,
}) => {
  await page.goto('/app');
  await page
    .getByLabel('Dump anything here')
    .fill(Array.from({ length: 100 }, (_, n) => `Email contact ${n + 1} tomorrow`).join('\n'));
  await page.getByRole('button', { name: 'Sort my pile' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox')).toHaveCount(100);
  await dialog
    .getByRole('button', { name: 'Edit candidate Email contact 100', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole('button', { name: 'Edit candidate Email contact 100', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Save to Pile (0)', exact: true }),
  ).toBeDisabled();
});

test('ordinary external calendar event opens details without a completion control', async ({
  page,
}) => {
  await page.goto('/app/calendar');
  await page.getByRole('button', { name: 'Open Coffee with Maya', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Coffee with Maya' }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /Complete|Reopen/ }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('navigation and welcome tour respond to clicks and keyboard', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Show welcome guide' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Pile' }).click();
  for (const label of ['Inbox', 'Projects', 'Search', 'Settings', 'Calendar', 'Board']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('h1')).toBeVisible();
  }
  await page.goto('/app/projects');
  await page.locator('.project-card').first().click();
  await expect(page.locator('h1')).toBeVisible();
});

test('calendar navigation, search clearing and demo downloads respond to controls', async ({
  page,
}) => {
  await page.goto('/app/calendar');
  await page.getByRole('button', { name: 'Next week' }).dblclick();
  await page.getByRole('button', { name: 'Previous week' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByLabel('Jump to date').fill('2026-10-15');
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await page.goto('/app/search');
  await page.getByRole('button', { name: 'HackRice', exact: true }).click();
  await expect(page.getByTestId('item-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).first().click();
  await expect(page.getByLabel('Search your pile')).toHaveValue('');
  await page.getByLabel('Search your pile').fill('zzzznotreal');
  await expect(
    page.getByRole('heading', { name: 'Nothing in your pile matches that yet.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).last().click();
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Take the 10-second tour' }).click();
  await page.keyboard.press('Escape');
  for (const name of [
    'Download sample syllabus',
    'Download sample event flyer',
    'Download meeting notes',
  ]) {
    const href = await page.getByRole('link', { name, exact: false }).getAttribute('href');
    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
});

test('unsynced Calendar task completion suppresses repeated writes and preserves source when archived', async ({
  page,
}) => {
  await page.goto('/app/calendar');
  let writes = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/items/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      writes++;
      await gate;
    }
    await route.continue();
  });
  const button = page.getByRole('button', { name: 'Complete Finish HackRice demo', exact: true });
  await button.click();
  await expect(button).toBeDisabled();
  await button.dispatchEvent('click');
  expect(writes).toBe(1);
  release();
  await expect(
    page.getByRole('button', { name: 'Reopen Finish HackRice demo', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reopen Finish HackRice demo', exact: true }).click();
  await page.goto('/app');
  await page.getByRole('button', { name: 'Edit Finish HackRice demo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  const archived = state.items.find((i: { title: string }) => i.title === 'Finish HackRice demo');
  expect(archived.status).toBe('archived');
  expect(state.sources.some((s: { id: string }) => s.id === archived.sourceId)).toBe(true);
});

test('recurring schedule fields persist and calendar remove/add controls stay consistent', async ({
  page,
}) => {
  await page.goto('/app');
  await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Edit candidate UGS 303 Lecture', exact: true }).click();
  if (!(await dialog.getByLabel('Term end', { exact: true }).isVisible()))
    await dialog.locator('summary').filter({ hasText: 'Recurring schedule' }).click();
  await dialog.getByLabel('Location', { exact: true }).fill('CAL 200');
  await dialog.getByLabel('Term end', { exact: true }).fill('2026-12-09');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const state = await (await page.request.get('/api/state')).json();
  const lecture = state.items.find((i: { title: string }) => i.title === 'UGS 303 Lecture');
  expect(lecture.recurrence.until).toBe('2026-12-09');
  expect(lecture.location).toBe('CAL 200');
  await page.goto('/app/calendar');
  await page.getByLabel('Jump to date').fill(lecture.startDateTime.slice(0, 10));
  await page.getByRole('button', { name: 'Open UGS 303 Lecture', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add to calendar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove from calendar', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove from calendar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add to calendar', exact: true })).toBeVisible();
});
