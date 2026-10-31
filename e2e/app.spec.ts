import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const fixture = (name: string) => path.join(process.cwd(), 'e2e', 'fixtures', name);

test.describe('desktop', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), 'desktop layout only');

  test('exposes the author X link and the privacy statement', async ({ page }) => {
    await page.goto('/');

    const xLink = page.getByTestId('author-x-link');
    await expect(xLink).toBeVisible();
    await expect(xLink).toHaveAttribute('href', 'https://x.com/0xkillcoin');
    await expect(xLink).toContainText('𝕏');

    await page.getByTestId('open-privacy').click();
    const dialog = page.getByTestId('privacy-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('never uploaded');
    await dialog.getByRole('button', { name: 'Got it' }).click();
    await expect(dialog).toBeHidden();
  });

  test('recognises an English invoice, keeps edits, copies, exports TXT and stores history', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles(fixture('en-invoice.png'));

    const image = page.getByTestId('preview-image');
    await expect(image).toBeVisible();

    await page.getByTestId('language-select').selectOption('eng');
    await page.getByTestId('recognize-active').click();

    const textarea = page.getByTestId('result-text');
    await expect(textarea).toHaveValue(/\S/, { timeout: 240_000 });
    await expect(textarea).toHaveValue(/INVOICE/i);
    await expect(textarea).toHaveValue(/Raycast|Labs/i);

    // Confidence and statistics come from the real recognition output.
    await expect(page.getByTestId('result-panel')).toContainText('Characters');

    // Edits survive re-renders and are what gets copied/exported.
    const edited = 'Typed by a human after OCR.\nINVOICE #SN-2049';
    await textarea.fill(edited);
    await expect(textarea).toHaveValue(/Typed by a human/);

    await page.getByTestId('copy-text').click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('Typed by a human after OCR.');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-txt').click()]);
    expect(download.suggestedFilename()).toBe('en-invoice.txt');
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const content = readFileSync(downloadPath as string, 'utf8');
    expect(content).toContain('Typed by a human after OCR.');

    // The result was persisted locally and can be deleted again.
    const historyItem = page.getByTestId('history-item-en-invoice.png');
    await expect(historyItem).toBeVisible();
    await page.getByTestId('delete-history-en-invoice.png').click();
    await expect(historyItem).toHaveCount(0);
  });

  test('batch recognises a Chinese and a mixed-language screenshot', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles([fixture('zh-notice.png'), fixture('mixed-chat.png')]);
    await expect(page.locator('[data-testid^="task-item-"]')).toHaveCount(2);

    await page.getByTestId('language-select').selectOption('chi_sim+eng');
    await page.getByTestId('recognize-all').click();

    const zhItem = page.getByTestId('task-item-zh-notice.png');
    const mixedItem = page.getByTestId('task-item-mixed-chat.png');
    await expect(zhItem).toContainText('Done', { timeout: 300_000 });
    await expect(mixedItem).toContainText('Done', { timeout: 300_000 });

    const textarea = page.getByTestId('result-text');

    await zhItem.click();
    await expect(textarea).toHaveValue(/SnapText/);
    const zhText = await textarea.inputValue();
    expect(zhText.match(/[\u4e00-\u9fff]/g)?.length ?? 0).toBeGreaterThan(10);

    await mixedItem.click();
    await expect(textarea).toHaveValue(/Support|OCR|客户/i);

    // Merged export of both results.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-all').click()]);
    expect(download.suggestedFilename()).toMatch(/snaptext-2-images-.*\.txt$/);
  });

  test('recognises only the selected region of an image', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles(fixture('en-invoice.png'));

    const image = page.getByTestId('preview-image');
    await expect(image).toBeVisible();
    await page.getByTestId('language-select').selectOption('eng');

    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box as { x: number; y: number; width: number; height: number };

    // Drag over the heading block only (top quarter of the invoice).
    await page.mouse.move(x + 10, y + 8);
    await page.mouse.down();
    await page.mouse.move(x + width - 10, y + height * 0.26, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByTestId('region-box')).toBeVisible();
    await page.getByTestId('recognize-active').click();

    const textarea = page.getByTestId('result-text');
    await expect(textarea).toHaveValue(/INVOICE/i, { timeout: 240_000 });
    // Text below the selection must not be part of the result.
    await expect(textarea).not.toHaveValue(/Thank you/i);
    await expect(textarea).not.toHaveValue(/Design sprint/i);
  });

  test('accepts a pasted screenshot from the clipboard', async ({ page }) => {
    await page.goto('/');
    const base64 = readFileSync(fixture('en-invoice.png')).toString('base64');

    await page.evaluate((data) => {
      const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
      const file = new File([bytes], 'pasted-shot.png', { type: 'image/png' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      // Chromium ignores `clipboardData` passed to the ClipboardEvent constructor,
      // so define it on a plain event instead.
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: transfer });
      window.dispatchEvent(event);
    }, base64);

    await expect(page.locator('[data-testid^="task-item-pasted-shot"]')).toHaveCount(1);
    await expect(page.getByTestId('preview-image')).toBeVisible();
  });
});
