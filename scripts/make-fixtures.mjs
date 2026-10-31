/**
 * Generate real OCR test fixtures by rendering text in a browser and taking a
 * screenshot. Everything committed to `e2e/fixtures` is produced by this script,
 * so the tests run against genuine images with Chinese, English and mixed text.
 *
 *   node scripts/make-fixtures.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'e2e', 'fixtures');

const cases = [
  {
    file: 'en-invoice.png',
    width: 760,
    height: 460,
    html: `
      <h1>INVOICE #SN-2049</h1>
      <p class="meta">Date: 2026-03-14 &nbsp; Customer: Raycast Labs</p>
      <table>
        <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
        <tr><td>Design sprint</td><td>2</td><td>$1,200</td></tr>
        <tr><td>OCR integration</td><td>1</td><td>$800</td></tr>
      </table>
      <p class="total">Total: $3,200</p>
      <p class="meta">Thank you for your business.</p>
    `,
  },
  {
    file: 'zh-notice.png',
    width: 760,
    height: 460,
    html: `
      <h1>SnapText 使用说明</h1>
      <p class="big">一、把图片拖进窗口</p>
      <p class="big">二、选择识别语言</p>
      <p class="big">三、复制或导出文字</p>
      <p class="meta">所有图片只在本地处理，不会上传。</p>
    `,
  },
  {
    file: 'mixed-chat.png',
    width: 760,
    height: 460,
    html: `
      <h1>Support chat</h1>
      <p class="big">客户：这张截图里的文字能提取吗？</p>
      <p class="big">Support: Yes, SnapText runs OCR locally.</p>
      <p class="big">客户：中英文混排也可以？</p>
      <p class="big">Support: 支持中英混合识别。</p>
    `,
  },
];

const style = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 34px 40px;
    background: #ffffff;
    color: #111318;
    font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 30px; margin: 0 0 14px; letter-spacing: 0.3px; }
  p { margin: 0 0 10px; }
  .big { font-size: 25px; line-height: 1.5; }
  .meta { font-size: 19px; color: #33383f; }
  table { border-collapse: collapse; margin: 6px 0 12px; font-size: 22px; }
  th, td { text-align: left; padding: 4px 26px 4px 0; }
  th { border-bottom: 2px solid #111318; }
  .total { font-size: 24px; font-weight: 700; margin-top: 4px; }
`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

for (const testCase of cases) {
  const page = await browser.newPage({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: 2,
  });
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${style}</style></head><body>${testCase.html}</body></html>`,
  );
  await page.screenshot({ path: join(outDir, testCase.file) });
  await page.close();
  console.log(`fixture written: e2e/fixtures/${testCase.file}`);
}

await browser.close();
console.log('done');
