import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.join(process.cwd(), 'e2e', 'fixtures', name);

const overflowPx = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile project only');

  test('never scrolls horizontally and switches panels with tabs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('mobile-tab-images')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-preview')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-result')).toBeVisible();
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);

    await page.getByTestId('mobile-tab-preview').click();
    await expect(page.getByTestId('preview-frame')).toBeVisible();
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);

    await page.getByTestId('mobile-tab-result').click();
    await expect(page.getByTestId('result-panel')).toBeVisible();
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);

    // The author X link stays reachable in the header on small screens.
    await expect(page.getByTestId('author-x-link')).toHaveAttribute('href', 'https://x.com/0xkillcoin');
  });

  test('uploads, recognises and edits on a phone viewport', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles(fixture('en-invoice.png'));

    // Uploading jumps straight to the preview panel.
    await expect(page.getByTestId('preview-image')).toBeVisible();
    await page.getByTestId('language-select').selectOption('eng');
    await page.getByTestId('recognize-active').click();

    // The UI switches to the text panel when recognition finishes.
    const textarea = page.getByTestId('result-text');
    await expect(textarea).toHaveValue(/INVOICE/i, { timeout: 300_000 });

    await textarea.fill('Edited on a phone');
    await expect(textarea).toHaveValue('Edited on a phone');
    expect(await overflowPx(page)).toBeLessThanOrEqual(1);
  });
});
