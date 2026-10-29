import { expect, test } from '@playwright/test';

test('knowledge flow illustration pauses by keyboard and reflows with connected paths', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const beam = page.getByRole('group', { name: /^Illustration: Anvesha connects/ });
  await beam.scrollIntoViewIfNeeded();
  const documents = beam.getByRole('button', { name: 'Documents animation, playing' });
  await documents.focus();
  await documents.press('Enter');
  await expect(beam.getByRole('button', { name: 'Documents animation, paused' })).toHaveAttribute('aria-pressed', 'false');
  await beam.getByRole('button', { name: 'Documents animation, paused' }).press('Space');
  await expect(documents).toHaveAttribute('aria-pressed', 'true');
  const assertEndpoints = async () => {
    await expect.poll(() => beam.evaluate(root => {
      const bounds = root.getBoundingClientRect();
      const tool = root.querySelector('.ui-ib__tool')!.getBoundingClientRect();
      const hub = root.querySelector('.ui-ib__center')!.getBoundingClientRect();
      const path = root.querySelector<SVGPathElement>('.ui-ib__line')!;
      if (!path.getAttribute('d')) return false;
      const a = path.getPointAtLength(0), b = path.getPointAtLength(path.getTotalLength());
      return Math.abs(a.x - (tool.x - bounds.x + tool.width / 2)) < 2 && Math.abs(a.y - (tool.y - bounds.y + tool.height / 2)) < 2
        && Math.abs(b.x - (hub.x - bounds.x + hub.width / 2)) < 2 && Math.abs(b.y - (hub.y - bounds.y + hub.height / 2)) < 2;
    })).toBe(true);
  };
  await assertEndpoints();
  await page.setViewportSize({ width: 390, height: 844 });
  await beam.scrollIntoViewIfNeeded();
  await assertEndpoints();
  await expect.poll(() => beam.locator('.ui-ib__scene').evaluate(el => getComputedStyle(el).getPropertyValue('--ui-ib-stack').trim())).toBe('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/scenes/beam-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('frost cloud stays still for reduced motion and supports keyboard focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/signin');
  const cloud = page.getByRole('button', { name: /Frost cloud/ });
  await expect(cloud).toBeVisible();
  const transforms = () => cloud.locator('g[transform]').evaluateAll(els => els.map(el => el.getAttribute('transform')));
  const before = await transforms();
  await cloud.focus();
  await expect(cloud).toBeFocused();
  await cloud.press('Enter');
  expect(await transforms()).toEqual(before);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await cloud.hover();
  await expect.poll(transforms).not.toEqual(before);
  await page.screenshot({ path: 'test-results/scenes/frost-cloud.png', fullPage: true });
});
