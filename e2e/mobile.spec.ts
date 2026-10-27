import { expect, test, type Page } from '@playwright/test';

async function noHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test('key screens fit a phone without horizontal scrolling or tiny text', async ({ page }) => {
  await page.goto('/');
  await noHorizontalScroll(page);
  const bodySize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(bodySize).toBeGreaterThanOrEqual(16);

  await page.goto('/#/demo');
  await page.getByRole('button', { name: /Ready-to-test sample/ }).click();
  await expect(page.getByRole('heading', { name: 'Try a question your users might ask.' })).toBeVisible();
  await noHorizontalScroll(page);

  // The step indicator fits without its own scrollbar.
  const steps = await page.locator('.steps').evaluate((el) => ({ s: el.scrollWidth, c: el.clientWidth }));
  expect(steps.s).toBeLessThanOrEqual(steps.c);

  // Sources open as a sheet on phones.
  await page.getByRole('button', { name: /How many days of annual leave/ }).click();
  await page.getByRole('button', { name: 'View sources' }).click();
  const sheet = page.getByRole('complementary', { name: 'Sources for this answer' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('mark')).toContainText('18 days');
  await noHorizontalScroll(page);
});
