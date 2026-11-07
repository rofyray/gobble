import { expect, test, type Page } from '@playwright/test';

const WIDTHS = [375, 768, 1280];
const SHOTS = process.env.GOBBLE_SCREENS_DIR;

async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBe(innerWidth);
}

test('mid-plan board shows every problem stamp', async ({ page }) => {
  await page.goto('/e/demo-mid');
  const rails = page.locator('.board-rails');
  for (const stamp of ['NEEDS A COOK', 'DOUBLED', 'LABEL IT', 'OVEN CLASH']) {
    await expect(rails.getByText(stamp, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('Pecan pie has tree nuts. It needs a label and its own plate.').filter({ visible: true })).toBeVisible();
});

test('complete board shows the plan stamp', async ({ page }) => {
  await page.goto('/e/demo');
  await expect(page.getByText('ALL ORDERS OWNED')).toBeVisible();
  await expect(page.getByText('LOCKED · SEE YOU AT 4:00 PM')).toBeVisible();
  await expect(page.getByText('Nothing left to sort.').first()).toBeAttached();
});

test('unknown boards say so', async ({ page }) => {
  await page.goto('/e/nothing-here');
  await expect(page.getByText('No potluck on this rail.')).toBeVisible();
});

test('a live board picks up a claim within one poll', async ({ page, request }) => {
  const created = await request.post('/api/events', {
    data: { title: 'Live test', date: '2026-11-26', dinnerTime: '16:00', headcount: 12, host: 'rofy' },
  });
  const { slug } = await created.json();
  await page.goto(`/e/${slug}`);
  await expect(page.getByRole('article', { name: 'Gravy, needs a cook' })).toBeVisible();
  await request.post(`/api/events/${slug}/ops`, { data: { op: 'claim', handle: 'kia', slotId: 'gravy', item: 'Gravy' } });
  await expect(page.getByRole('article', { name: 'Gravy, on it' })).toBeVisible({ timeout: 8_000 });
});

for (const width of WIDTHS) {
  test(`no horizontal scroll at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    const created = await request.post('/api/events', {
      data: { title: 'Empty plan', date: '2026-11-26', dinnerTime: '16:00', headcount: 15, host: 'rofy' },
    });
    const { slug } = await created.json();
    for (const [name, path] of [['complete', '/e/demo'], ['mid', '/e/demo-mid'], ['empty', `/e/${slug}`], ['landing', '/']]) {
      await page.goto(path);
      await page.locator('.board, .landing').first().waitFor();
      await noHorizontalScroll(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
    }
  });
}
