import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const base = process.env.ANVESHA_TEST_URL || 'http://127.0.0.1:8000';
const out = path.resolve(process.argv[2] || '.shots/premium-pages');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], reports = [];
page.on('pageerror', error => errors.push(error.message));
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const audit = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
  });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  await page.screenshot({ path: path.join(out, `${name}-hero.png`) });
  reports.push({ name, overflowX, a11y: audit });
  console.log(`${name}: overflow=${overflowX}, axe=${audit.length}`);
}
try {
  for (const [prefix, width, height] of [['d', 1440, 1000], ['m', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base); await page.getByRole('heading', { level: 1 }).waitFor(); await capture(`${prefix}-website`);
    await page.goto(`${base}/#/signin`); await page.getByLabel('Email').waitFor(); await capture(`${prefix}-signin`);
    await page.goto(`${base}/#/signup`); await page.getByLabel('Your name').waitFor(); await capture(`${prefix}-signup`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/#/demo`);
  await page.getByRole('button', { name: /Ready-to-test sample/ }).click();
  const tryUrl = page.url();
  await page.getByRole('link', { name: 'All projects', exact: true }).click();
  const projectsUrl = page.url();
  for (const [prefix, width, height] of [['d', 1440, 1000], ['m', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(projectsUrl); await page.locator('.studio-project-open').first().waitFor(); await capture(`${prefix}-projects`);
    await page.goto(tryUrl); await page.getByRole('textbox', { name: 'Your question' }).waitFor(); await capture(`${prefix}-chat`);
    // A demo project exercises real settings forms without a private account.
    const projectId = new URL(page.url()).hash.match(/\/p\/([^/]+)/)?.[1];
    if (projectId) { await page.goto(`${base}/#/p/${projectId}/settings`); await page.getByRole('heading', { level: 1 }).waitFor(); await capture(`${prefix}-settings`); }
  }
  for (const [prefix, width, height] of [['d', 1440, 1000], ['m', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/#/workspace/new`);
    await page.getByRole('textbox', { name: 'Workspace name' }).waitFor();
    await capture(`${prefix}-onboarding`);
  }
  await writeFile(path.join(out, 'summary.json'), JSON.stringify({ scope: 'Public pages and fictional demo projects, production build.', reports, consoleErrors: errors }, null, 2));
  const serious = reports.flatMap(r => r.a11y).filter(v => ['serious', 'critical'].includes(v.impact));
  if (serious.length || reports.some(r => r.overflowX) || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
