// Production evidence for authenticated workspaces; uses fictional test data only.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const base = process.env.ANVESHA_TEST_URL || 'http://127.0.0.1:8000';
const out = path.resolve(process.argv[2] || '.shots/knowledge-studio-pass1');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  window.__studioVitals = { lcp: null, cls: 0 };
  try {
    new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__studioVitals.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__studioVitals.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
});
const axePath = require.resolve('axe-core/axe.min.js');
const reports = [];

async function capture(name, selector, { reduced = false } = {}) {
  await page.locator(selector).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addScriptTag({ path: axePath });
  const audit = await page.evaluate(async selector => {
    const result = await window.axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
  }, selector);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  await page.screenshot({ path: path.join(out, `${name}-hero.png`) });
  const metrics = await page.evaluate(selector => {
    const targets = [...document.querySelector(selector).querySelectorAll('button,input,select,summary,a')].map(el => el.matches('input[type=file], input[type=checkbox], input[type=radio]') ? el.closest('label') ?? el : el).filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height);
    return { viewport: { width: innerWidth, height: innerHeight }, overflowX: document.documentElement.scrollWidth > innerWidth,
      h1: [...document.querySelectorAll('h1')].map(el => el.textContent), vitals: window.__studioVitals,
      smallTargets: targets.filter(el => el.getBoundingClientRect().width < 24 || el.getBoundingClientRect().height < 24).map(el => ({ name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 80), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
  }, selector);
  const report = { name, ...metrics, a11y: audit, consoleErrors: [...errors] };
  reports.push(report);
  await writeFile(path.join(out, `${name}.json`), JSON.stringify(report, null, 2));
  console.log(`${name}: overflow=${metrics.overflowX}, axe=${audit.length}, smallTargets=${metrics.smallTargets.length}`);
}

try {
  await page.goto(`${base}/#/signup`);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Knowledge Studio QA');
  await page.getByRole('textbox', { name: 'Email' }).fill(`studio-qa-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('studio-qa-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Knowledge Studio QA');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const modal = page.getByRole('dialog', { name: 'New project' });
  await modal.getByRole('textbox', { name: 'What should it help with?' }).fill('Find answers in product guides and documentation');
  await modal.getByRole('textbox', { name: 'Assistant name' }).fill('Product knowledge');
  await modal.getByRole('button', { name: 'Create project' }).click();
  await capture('d-upload-empty', '.knowledge-studio');
  const uploadUrl = page.url();
  await page.getByRole('textbox', { name: 'New folder path' }).fill('Product guides');
  await page.getByRole('button', { name: 'Create folder', exact: true }).click();
  await page.getByTestId('file-input').setInputFiles([path.resolve('e2e/fixtures/product-catalog.xlsx'), path.resolve('e2e/fixtures/setup-guide.pptx')]);
  await page.locator('.source-row').filter({ hasText: 'product catalog' }).getByRole('button', { name: 'Preview', exact: true }).waitFor({ timeout: 60000 });
  await page.locator('.source-row').filter({ hasText: 'setup guide' }).getByRole('button', { name: 'Preview', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('searchbox', { name: 'Search sources' }).fill('catalog');
  if (await page.locator('.source-row').count() !== 1) throw new Error('Source search did not filter documents.');
  await page.getByRole('searchbox', { name: 'Search sources' }).clear();
  await page.getByRole('button', { name: 'Continue to Training' }).click();
  await page.getByRole('heading', { name: 'Your assistant is ready to test.' }).waitFor({ timeout: 150000 });
  const trainingUrl = page.url();

  const cdp = await context.newCDPSession(page);
  for (const [name, width, height] of [['d', 1440, 1000], ['m', 390, 844], ['t', 768, 1024], ['w', 1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: name === 'm' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: name === 'm' ? 4 : 1 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: name === 'm' ? 150 : 0, downloadThroughput: name === 'm' ? 200000 : 100000000, uploadThroughput: name === 'm' ? 93750 : 100000000 });
    await page.goto(uploadUrl);
    await page.reload();
    await page.getByRole('navigation', { name: 'Knowledge folders' }).getByRole('button', { name: 'All sources (2)', exact: true }).click();
    await capture(`${name}-upload`, '.knowledge-studio');
    await page.goto(trainingUrl);
    await page.reload();
    await page.getByRole('heading', { name: 'Your assistant is ready to test.' }).waitFor({ timeout: 30000 });
    await capture(`${name}-training`, '.training-studio');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(uploadUrl);
  await capture('r-upload', '.knowledge-studio', { reduced: true });
  const fileButton = page.locator('.intake-well .file-picker');
  await fileButton.locator('input').focus();
  await page.screenshot({ path: path.join(out, 'k-upload-focus.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fileButton.screenshot({ path: path.join(out, 'h-upload-rest.png') });
  await fileButton.hover();
  await fileButton.screenshot({ path: path.join(out, 'h-upload-hover.png') });
  await page.goto(trainingUrl);
  await page.getByRole('heading', { name: 'Your assistant is ready to test.' }).waitFor();
  await capture('r-training', '.training-studio', { reduced: true });
  await writeFile(path.join(out, 'summary.json'), JSON.stringify({ scope: 'Authenticated Upload and Training in production with fictional data; axe is scoped to redesigned screens. Mobile routes are measured after reload at 4x CPU, 150ms latency and 1.6Mbps download with cache disabled; other sizes are unthrottled.', reports, consoleErrors: errors }, null, 2));
  await writeFile(path.join(out, 'audit.txt'), reports.map(r => `${r.name}: ${JSON.stringify({ overflowX: r.overflowX, smallTargets: r.smallTargets, a11y: r.a11y, vitals: r.vitals })}`).join('\n'));
  const serious = reports.flatMap(r => r.a11y).filter(v => ['serious', 'critical'].includes(v.impact));
  if (serious.length || reports.some(r => r.overflowX) || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
