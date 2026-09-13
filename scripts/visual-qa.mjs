import { chromium, webkit, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const base = 'http://127.0.0.1:3003';
const out = 'docs/screenshots/qa';
await mkdir(out, { recursive: true });
const rows = [];
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [width, height] of [
      [1512, 982],
      [1440, 900],
      [1280, 800],
      [390, 844],
    ]) {
      const images = [];
      await page.setViewportSize({ width, height });
      for (const route of ['', 'inbox', 'calendar', 'projects', 'search', 'settings']) {
        await page.goto(base + '/app/' + route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('.loading-state')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        const buttons = await page.getByRole('button').allTextContents();
        const file = `${out}/${name}-${width}-${route || 'board'}.png`;
        await page.screenshot({ path: file });
        images.push(file);
        rows.push({
          browser: name,
          width,
          height,
          route: route || 'board',
          overflow,
          buttons,
          errors: [...errors],
        });
        if (overflow || errors.length)
          throw new Error(`Visual failure ${name} ${width} ${route}: ${errors}`);
      }
      const thumbWidth = width === 390 ? 260 : 500,
        thumbHeight = Math.round((height * thumbWidth) / width);
      const thumbs = await Promise.all(
        images.map((file) => sharp(file).resize(thumbWidth, thumbHeight).toBuffer()),
      );
      await sharp({
        create: { width: thumbWidth * 3, height: thumbHeight * 2, channels: 3, background: '#eee' },
      })
        .composite(
          thumbs.map((input, i) => ({
            input,
            left: (i % 3) * thumbWidth,
            top: Math.floor(i / 3) * thumbHeight,
          })),
        )
        .jpeg({ quality: 88 })
        .toFile(`${out}/${name}-${width}-contact.jpg`);
    }
    // Exercise actual PDF paging in each engine, including first/last disabled states.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/app');
    await page.getByLabel('Upload file').setInputFiles('demo-assets/sample-syllabus.pdf');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.goto(base + '/app/inbox');
    await page.getByRole('button', { name: /sample-syllabus.pdf pdf/ }).click();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    for (let p = 2; p <= 4; p++) {
      await page.getByRole('button', { name: 'Next page' }).click();
      await expect(page.getByAltText(`PDF page ${p} of sample-syllabus.pdf`)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.getByAltText('PDF page 3 of sample-syllabus.pdf')).toBeVisible();
    rows.push({ browser: name, pdfPaging: 'passed', errors: [...errors] });
  } finally {
    await browser.close();
  }
}
await writeFile('docs/qa/visual-results.json', JSON.stringify(rows, null, 2) + '\n');
console.log(
  JSON.stringify({ routeViewportChecks: 48, browsers: 2, pdfPagingChecks: 2, failures: 0 }),
);
