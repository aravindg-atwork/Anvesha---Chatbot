import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The five-minute presenter walkthrough from the README, end to end.

const FILES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/sample-files');
const EMERGENCY = 'I am on probation and my mother is hospitalised. Can I take three days’ leave?';
const REQUIRED_PASSAGE =
  'Employees on probation are not eligible for casual leave. Requests concerning family emergencies must be submitted to HR for individual review. Submission does not guarantee approval.';

async function ask(page: Page, question: string, scope = page.locator('main')) {
  const answers = scope.locator('article[aria-label="Assistant answer"]');
  const before = await answers.count();
  const box = scope.getByRole('textbox', { name: 'Your question' });
  await box.fill(question);
  await box.press('Enter');
  // Wait until the answer to this question has arrived.
  await expect(answers).toHaveCount(before + 1);
  return answers.last();
}

async function sampleIds(page: Page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('anvesha:state')!);
    const a = s.assistants.find((x: { isSample: boolean }) => x.isSample);
    return { id: a.id as string, publicId: a.publicId as string };
  });
}

test('create an organisation, add real files and see honest processing states', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo' }).first().click();
  await page.getByRole('button', { name: /Empty new organisation/ }).click();

  await page.getByRole('textbox', { name: 'Organisation name' }).fill('Greenfield College');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Describe
  await expect(page.getByRole('heading', { name: 'What would you like your assistant to help with?' })).toBeVisible();
  await page.getByRole('button', { name: 'College admissions' }).click();
  await page.getByRole('button', { name: 'Suggest a name and purpose' }).click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Admissions Helper');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Add knowledge: a real text PDF with printed page labels and an image-only PDF.
  await expect(page.getByRole('heading', { name: 'Give your assistant the information it needs.' })).toBeVisible();
  await page.locator('input[type="file"][multiple]').setInputFiles([
    path.join(FILES, 'VayuTech-Employee-Handbook.pdf'),
    path.join(FILES, 'Scanned-Notice.pdf'),
  ]);
  const rows = page.locator('.source-row');
  await expect(rows.filter({ hasText: 'VayuTech Employee Handbook' })).toContainText('Ready', { timeout: 20_000 });
  await expect(rows.filter({ hasText: 'Scanned Notice' })).toContainText('Needs attention', { timeout: 20_000 });
  await expect(rows.filter({ hasText: 'Scanned Notice' })).toContainText(/scanned or image-only PDF/);

  // Duplicate detection
  await page.locator('input[type="file"][multiple]').setInputFiles(path.join(FILES, 'VayuTech-Employee-Handbook.pdf'));
  await expect(page.getByText('This is the same file as “VayuTech Employee Handbook”.')).toBeVisible();

  // Extracted-content preview with genuine page references
  await rows.filter({ hasText: 'Ready' }).first().getByRole('button', { name: 'Preview' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('PDF page 3 · printed page “1”');
  await expect(dialog).toContainText('Standard working hours are 9:30 to 18:00');
  await page.keyboard.press('Escape');

  // FAQ CSV import with validation
  await page.locator('input[type="file"][multiple]').setInputFiles(path.join(FILES, 'VayuTech-FAQ.csv'));
  await expect(page.getByRole('dialog')).toContainText('Missing answer');
  await page.getByRole('button', { name: 'Import 3 questions' }).click();
  await expect(page.getByText('How do I reset my laptop password?')).toBeVisible();

  // Progress survives a refresh.
  await page.reload();
  await expect(rows.filter({ hasText: 'VayuTech Employee Handbook' }).first()).toContainText('Ready');
});

test('full AskHR story: answer, cite, improve, publish, isolate draft, republish, review, unpublish', async ({ page, context }) => {
  await page.goto('/#/demo');
  await page.getByRole('button', { name: /Ready-to-test sample/ }).click();
  await expect(page.getByRole('heading', { name: 'Try a question your users might ask.' })).toBeVisible();
  await expect(page.getByText('Private preview')).toBeVisible();

  // Key demonstration question
  let answer = await ask(page, EMERGENCY);
  await expect(answer).toContainText('casual leave isn’t available');
  await expect(answer).toContainText('submit a request to HR');
  await expect(answer).toContainText('doesn’t guarantee approval');
  await expect(answer).toContainText('can’t approve or reject leave');
  await expect(answer).toContainText('Scripted demo response');

  // Inspect the citation
  await answer.getByRole('button', { name: 'View sources' }).click();
  const sources = page.getByRole('complementary', { name: 'Sources for this answer' });
  await expect(sources).toContainText('VayuTech Leave Policy (2025 edition)');
  await expect(sources).toContainText('Section: 3. Casual leave');
  await expect(sources.locator('mark')).toHaveText(REQUIRED_PASSAGE);
  await sources.getByRole('button', { name: 'Close sources' }).click();

  // Improve the draft through feedback
  await answer.getByRole('button', { name: 'Not helpful' }).click();
  await page.getByRole('button', { name: /Change how it helps/ }).click();
  const contact = page.getByRole('textbox', { name: /Who should people contact/ });
  await expect(contact).toBeFocused();
  await contact.fill('the HR Care desk at hrcare@vayutech.example or extension 2040');
  await page.getByRole('navigation', { name: 'Setup progress' }).getByRole('button', { name: /Try/ }).click();

  // Retest: older answer is kept and marked, the new one uses the contact.
  await expect(page.getByText('Answered using an earlier draft')).toBeVisible();
  answer = await ask(page, EMERGENCY);
  await expect(answer).toContainText('hrcare@vayutech.example or extension 2040');

  // The other demonstration cases
  await expect(await ask(page, 'How many days of annual leave do I get?')).toContainText('18 days');
  await expect(await ask(page, 'How much leave do I get?')).toContainText('Which one do you mean');
  await expect(await ask(page, 'Does VayuTech pay for a gym membership?')).toContainText('couldn’t find information');
  const conflict = await ask(page, 'How many casual leave days do I get?');
  await expect(conflict).toContainText('8 days');
  await expect(conflict).toContainText('12 days');
  await expect(conflict).toContainText('give different information');

  // Publish: audience first, simulated-auth warning, then channel and review.
  await page.getByRole('button', { name: 'Continue to sharing' }).click();
  await page.getByRole('radio', { name: /Only authorised users/ }).click();
  await expect(page.getByText(/is simulated/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /On my website/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review before publishing' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText(/Version 1 is published/)).toBeVisible();
  await expect(page.getByText(/not on your website or app until it is installed/)).toBeVisible();

  // Widget answers from the published version, without owner labels.
  const widget = page.locator('.widget-panel');
  const widgetAnswer = await ask(page, EMERGENCY, widget);
  await expect(widgetAnswer).toContainText('extension 2040');
  await expect(widget).not.toContainText('Scripted demo response');
  await page.getByRole('button', { name: 'Get installation instructions' }).click();
  const { id, publicId } = await sampleIds(page);
  await expect(page.getByRole('dialog', { name: 'Installation instructions' })).toContainText(`data-assistant-id="${publicId}"`);
  await page.keyboard.press('Escape');

  // Edit the draft after launch; published answers must not change.
  await page.goto(`/#/a/${id}/edit/behaviour`);
  await page.getByRole('textbox', { name: /Who should people contact/ }).fill('the HR Care desk at hrcare@vayutech.example or extension 2041');
  await expect(page.getByText(/They still get/)).toBeVisible();

  const visitor = await context.newPage();
  await visitor.goto(`/#/chat/${publicId}`);
  await expect(await ask(visitor, EMERGENCY)).toContainText('extension 2040');

  // Republish
  await page.getByRole('button', { name: 'Review and publish' }).click();
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText(/Version 2 is published/)).toBeVisible();
  await expect(await ask(visitor, EMERGENCY)).toContainText('extension 2041');
  await ask(visitor, 'Does VayuTech pay for a gym membership?');

  // Review conversations and turn an unanswered question into an approved FAQ draft.
  await page.goto(`/#/a/${id}/conversations`);
  await expect(page.locator('.metric').filter({ hasText: 'Not answered' })).toContainText('1');
  await page.getByRole('button', { name: 'Write an answer' }).click();
  const faq = page.getByRole('dialog');
  await faq.getByRole('textbox', { name: 'Answer' }).fill('VayuTech does not pay for gym memberships.');
  await faq.getByRole('button', { name: 'Save to draft' }).click();
  await expect(faq).toContainText('Confirm that this answer is approved');
  await faq.getByRole('checkbox', { name: /I approve this answer/ }).check();
  await faq.getByRole('button', { name: 'Save to draft' }).click();
  await expect(page.getByText('Answer added to draft')).toBeVisible();

  // Unpublish immediately; the open public page stops answering.
  await page.goto(`/#/a/${id}`);
  await page.getByRole('button', { name: 'Unpublish now' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByText('Unpublished', { exact: true })).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText(/isn’t available right now/).first()).toBeVisible();
  await expect(visitor.getByRole('textbox', { name: 'Your question' })).toBeDisabled();
});

test('owner pages without a session ask to sign in, and the sign-in is labelled as a prototype', async ({ page }) => {
  await page.goto('/#/start');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText(/not real authentication/)).toBeVisible();
});
