import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

async function newProject(page: Page) {
  await page.goto('/#/signup');
  await page.getByRole('textbox', { name: 'Your name' }).fill('Import Tester');
  await page.getByRole('textbox', { name: 'Email' }).fill(`imports-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('import-test-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Import checks');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const modal = page.getByRole('dialog', { name: 'New project' });
  await modal.getByRole('textbox', { name: 'What should it help with?' }).fill('Answer from product documentation');
  await modal.getByRole('textbox', { name: 'Assistant name' }).fill('Product assistant');
  await modal.getByRole('button', { name: 'Create project' }).click();
}

test('real workbook and presentation uploads expose exact source references', async ({ page }) => {
  await newProject(page);
  await page.getByTestId('file-input').setInputFiles([path.resolve('e2e/fixtures/product-catalog.xlsx'), path.resolve('e2e/fixtures/setup-guide.pptx')]);
  const sheet = page.locator('.source-row').filter({ hasText: 'product catalog' });
  const slides = page.locator('.source-row').filter({ hasText: 'setup guide' });
  await expect(sheet).toContainText('Ready', { timeout: 60_000 });
  await expect(slides).toContainText('Ready', { timeout: 60_000 });
  await expect(sheet).toContainText('Warranty');
  await expect(slides).toContainText('Setup');
  await sheet.getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = page.getByRole('dialog');
  await expect(preview).toContainText('Products / A2:B2');
  await expect(preview).toContainText('Warranty months (B2): 24');
  await page.keyboard.press('Escape');
  await slides.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Slide 1');
  await expect(page.getByRole('dialog')).toContainText('adapter supplied');
});

test('Drive selection previews file types and excludes unsupported items before queuing', async ({ page }) => {
  // Google transport is mocked here; authentication and project storage use the real app.
  await page.route('**/api/drive/status?*', route => route.fulfill({ json: { configured: true, connected: true, email: 'drive-test@example.com', link: null } }));
  await page.route('**/api/drive/folders?*', route => route.fulfill({ json: { files: [{ id: 'chosen-folder', name: 'Product knowledge' }] } }));
  await page.route('**/api/drive/preview', async route => {
    expect(route.request().postDataJSON().folderIds).toEqual(['chosen-folder']);
    await route.fulfill({ json: { total: 2, supported: 1, folders: 1, types: { XLSX: 1, Other: 1 }, items: [
      { id: 'sheet', name: 'Catalog', fileType: 'XLSX', folderPath: 'Product knowledge', skipReason: null },
      { id: 'zip', name: 'Archive.zip', fileType: 'Other', folderPath: 'Product knowledge', skipReason: 'Unsupported file type' },
    ] } });
  });
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/drive/import', async route => { submitted = route.request().postDataJSON(); await route.fulfill({ json: { jobId: 'mocked-drive-run' } }); });
  await newProject(page);
  const drive = page.getByRole('region', { name: 'Google Drive knowledge' });
  await drive.getByRole('button', { name: 'Choose folders', exact: true }).click();
  await drive.getByLabel('Product knowledge', { exact: true }).check();
  await drive.getByRole('button', { name: 'Preview documents', exact: true }).click();
  await expect(drive.getByLabel('Import Catalog', { exact: true })).toBeChecked();
  await expect(drive.getByLabel('Import Archive.zip', { exact: true })).toBeDisabled();
  await drive.getByRole('button', { name: 'Import 1 files and prepare knowledge', exact: true }).click();
  await expect(drive).toContainText('Drive work is queued');
  expect(submitted).toMatchObject({ folderIds: ['chosen-folder'], recursive: true, mediaConsent: false, autoSync: false });
});
