import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Sign in → workspace → projects → Upload → Training → Try → Review → Make → Publish.

const FILES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/sample-files');
const EMERGENCY = 'I am on probation and my mother is hospitalised. Can I take three days’ leave?';
const REQUIRED_PASSAGE =
  'Employees on probation are not eligible for casual leave. Requests concerning family emergencies must be submitted to HR for individual review. Submission does not guarantee approval.';

async function ask(page: Page, question: string, scope: Locator = page.locator('main')) {
  const answers = scope.locator('article[aria-label="Assistant answer"]');
  const before = await answers.count();
  const box = scope.getByRole('textbox', { name: 'Your question' });
  await box.fill(question);
  await box.press('Enter');
  await expect(answers).toHaveCount(before + 1);
  return answers.last();
}

const step = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Project steps' }).getByRole('button', { name: new RegExp(`^${name}`) });

async function projectIds(page: Page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('anvesha:state')!);
    const a = s.assistants.at(-1);
    return { id: a.id as string, publicId: a.publicId as string };
  });
}

test('offline demo: create a workspace and project, and upload real files with the Choose files button', async ({ page }) => {
  await page.goto('/#/demo');
  await page.getByRole('button', { name: /Start from scratch/ }).click();

  // Workspace
  await expect(page.getByRole('heading', { name: /Create your.*knowledge space/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Greenfield College');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  // Projects: the first project dialog opens by itself.
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'College admissions' }).click();
  await dialog.getByRole('button', { name: 'Create project' }).click();

  // Upload — a real click on "Choose files" opens the browser's file chooser.
  await expect(page.getByRole('heading', { name: 'Give your assistant the information it needs.' })).toBeVisible();
  await expect(page.getByText('Admissions Helper').first()).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Choose files', { exact: true }).click();
  await (await chooser).setFiles([path.join(FILES, 'VayuTech-Employee-Handbook.pdf'), path.join(FILES, 'Scanned-Notice.pdf')]);

  const rows = page.locator('.source-row');
  await expect(rows.filter({ hasText: 'VayuTech Employee Handbook' })).toContainText('Ready', { timeout: 20_000 });
  await expect(rows.filter({ hasText: 'Scanned Notice' })).toContainText('Needs attention', { timeout: 20_000 });

  // Duplicate detection and the extracted-content preview with genuine page labels
  await page.getByTestId('file-input').setInputFiles(path.join(FILES, 'VayuTech-Employee-Handbook.pdf'));
  await expect(page.getByText('This is the same file as “VayuTech Employee Handbook”.')).toBeVisible();
  await rows.filter({ hasText: 'Ready' }).first().getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('dialog')).toContainText('PDF page 3 · printed page “1”');
  await page.keyboard.press('Escape');

  // CSV import through the same picker, with row validation
  await page.getByTestId('file-input').setInputFiles(path.join(FILES, 'VayuTech-FAQ.csv'));
  await expect(page.getByRole('dialog')).toContainText('Missing answer');
  await page.getByRole('button', { name: 'Import 3 questions' }).click();

  // Training summarises what was prepared.
  await page.getByRole('button', { name: 'Continue to Training' }).click();
  await expect(page.getByRole('heading', { name: 'Your assistant is ready to answer.' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/not used to train an AI model/)).toBeVisible();

  // Every step stays reachable, and progress survives a refresh.
  await page.reload();
  await expect(step(page, 'Training')).toHaveAttribute('aria-current', 'step');
  await step(page, 'Upload').click();
  await expect(rows.filter({ hasText: 'VayuTech Employee Handbook' }).first()).toContainText('Ready');

  // Projects list shows the project and its progress.
  await page.getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
  await expect(page.locator('.studio-project-open').filter({ hasText: 'Admissions Helper' })).toContainText('Step 1 of 6');
});

test('presenter story from scratch: sample documents, training, cited answer, improve, make, publish, isolate draft, unpublish', async ({ page, context }) => {
  await page.goto('/#/demo');
  await page.getByRole('button', { name: /Start from scratch/ }).click();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('VayuTech');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('button', { name: 'Employee questions' }).click();
  await dialog.getByRole('button', { name: 'Create project' }).click();

  // 1 Upload: demo-only sample documents
  await page.getByRole('button', { name: /Use VayuTech sample documents/ }).click();
  await expect(page.locator('.source-row').filter({ hasText: 'VayuTech Leave Policy (2025 edition)' })).toContainText('Ready');
  await page.getByRole('button', { name: 'Continue to Training' }).click();

  // 2 Training: topics and the version conflict to review
  await expect(page.getByRole('heading', { name: 'Your assistant is ready to answer.' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.tag').filter({ hasText: 'Casual leave' })).toBeVisible();
  await expect(page.getByText('Casual leave allowance')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Try' }).click();

  // 3 Try: key question, citation, improvement
  let answer = await ask(page, EMERGENCY);
  await expect(answer).toContainText('casual leave isn’t available');
  await expect(answer).toContainText('doesn’t guarantee approval');
  await expect(answer).toContainText('can’t approve or reject leave');
  await answer.getByRole('button', { name: 'View sources' }).click();
  const sources = page.getByRole('complementary', { name: 'Sources for this answer' });
  await expect(sources).toContainText('Section: 3. Casual leave');
  await expect(sources.locator('mark')).toHaveText(REQUIRED_PASSAGE);
  await sources.getByRole('button', { name: 'Close sources' }).click();

  await answer.getByRole('button', { name: 'Not helpful' }).click();
  await page.getByRole('button', { name: /Change how it helps/ }).click();

  // 4 Review: the flagged answer is listed; set the contact
  await expect(page.getByText('Answers you marked “not helpful”')).toBeVisible();
  const contact = page.getByRole('textbox', { name: /Who should people contact/ });
  await expect(contact).toBeFocused();
  await contact.fill('the HR Care desk at hrcare@vayutech.example or extension 2040');
  await step(page, 'Try').click();
  await expect(page.getByText('Answered using an earlier draft')).toBeVisible();
  answer = await ask(page, EMERGENCY);
  await expect(answer).toContainText('extension 2040');
  const conflict = await ask(page, 'How many casual leave days do I get?');
  await expect(conflict).toContainText('8 days');
  await expect(conflict).toContainText('12 days');
  await page.getByRole('button', { name: 'Continue to Review' }).click();
  await page.getByRole('radio', { name: /Formal/ }).click();
  await page.getByRole('button', { name: 'Continue to Make' }).click();

  // 5 Make: colour and avatar show in the live preview
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
  await page.getByRole('radio', { name: '#2e6a4a' }).click();
  await page.getByRole('radio', { name: 'Avatar handshake' }).click();
  await expect(page.locator('.make-preview .widget-head')).toHaveCSS('background-color', 'rgb(46, 106, 74)');
  await page.getByRole('button', { name: 'Continue to Publish' }).click();

  // 6 Publish
  await page.getByRole('radio', { name: /Only authorised users/ }).click();
  await expect(page.getByText(/is simulated/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /On my website/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('main').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText(/Version 1 is published/)).toBeVisible();

  // Widget answers from version 1, in the chosen (formal) tone, without owner labels.
  const widget = page.locator('.widget-panel');
  const widgetAnswer = await ask(page, EMERGENCY, widget);
  await expect(widgetAnswer).toContainText('I am sorry for the difficult circumstances');
  await expect(widgetAnswer).toContainText('extension 2040');
  await expect(widget).not.toContainText('Scripted demo response');

  // Edit the draft after launch; the published assistant is unchanged until republished.
  const { id, publicId } = await projectIds(page);
  await step(page, 'Review').click();
  await page.getByRole('textbox', { name: /Who should people contact/ }).fill('the HR Care desk at hrcare@vayutech.example or extension 2041');
  await expect(page.getByText(/People still see/)).toBeVisible();
  const visitor = await context.newPage();
  await visitor.goto(`/#/chat/${publicId}`);
  await expect(await ask(visitor, EMERGENCY)).toContainText('extension 2040');
  await page.getByRole('button', { name: 'Review and publish' }).click();
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText(/Version 2 is published/)).toBeVisible();
  await expect(await ask(visitor, EMERGENCY)).toContainText('extension 2041');

  // Overview → unpublish; the public page stops answering.
  await page.goto(`/#/p/${id}`);
  await expect(page.getByRole('heading', { name: /is live/ })).toBeVisible();
  await page.getByRole('button', { name: 'Unpublish now' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click();
  await visitor.reload();
  await expect(visitor.getByText(/isn’t available right now/).first()).toBeVisible();
  await expect(visitor.getByRole('textbox', { name: 'Your question' })).toBeDisabled();
});

test('published sample: conversations turn an unanswered question into an approved answer', async ({ page, context }) => {
  await page.goto('/#/demo');
  await page.getByRole('button', { name: /Published sample/ }).click();
  await expect(page.getByRole('heading', { name: /is live/ })).toBeVisible();
  const { id, publicId } = await projectIds(page);
  const visitor = await context.newPage();
  await visitor.goto(`/#/chat/${publicId}`);
  await ask(visitor, 'Does VayuTech pay for a gym membership?');

  await page.goto(`/#/p/${id}/conversations`);
  await expect(page.locator('.metric').filter({ hasText: 'Not answered' })).toContainText('1');
  await page.getByRole('button', { name: 'Write an answer' }).click();
  const faq = page.getByRole('dialog');
  await faq.getByRole('textbox', { name: 'Answer' }).fill('VayuTech does not pay for gym memberships.');
  await faq.getByRole('button', { name: 'Save to draft' }).click();
  await expect(faq).toContainText('Confirm that this answer is approved');
  await faq.getByRole('checkbox', { name: /I approve this answer/ }).check();
  await faq.getByRole('button', { name: 'Save to draft' }).click();
  await expect(page.getByText('Answer added to draft')).toBeVisible();
});

test('owner pages without a session ask to sign in with a backend account', async ({ page }) => {
  await page.goto('/#/projects');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText(/account is saved on the local backend/)).toBeVisible();
});
