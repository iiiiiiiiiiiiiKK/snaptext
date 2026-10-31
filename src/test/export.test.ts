import { describe, expect, it } from 'vitest';
import {
  baseName,
  buildJson,
  buildMarkdown,
  buildTxt,
  exportFileName,
  sanitizeFileName,
  type ExportItem,
} from '../lib/export';

const single: ExportItem = {
  fileName: 'screenshot 01.png',
  text: 'Hello world\n第二行',
  langs: 'chi_sim+eng',
  confidence: 91.4,
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
};

const second: ExportItem = { ...single, fileName: 'shot2.jpg', text: 'Second image text' };

describe('sanitizeFileName', () => {
  it('strips characters that break file systems', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j.png')).toBe('a_b_c_d_e_f_g_h_i_j.png');
  });

  it('falls back for empty names', () => {
    expect(sanitizeFileName('   ')).toBe('snaptext');
    expect(sanitizeFileName('...')).toBe('snaptext');
  });
});

describe('baseName', () => {
  it('drops the extension', () => {
    expect(baseName('scan.final.png')).toBe('scan.final');
    expect(baseName('noext')).toBe('noext');
  });
});

describe('buildTxt', () => {
  it('exports a single result verbatim with a trailing newline', () => {
    expect(buildTxt([single])).toBe('Hello world\n第二行\n');
  });

  it('adds headers for batch exports', () => {
    const output = buildTxt([single, second]);
    expect(output).toContain('===== screenshot 01.png =====');
    expect(output).toContain('===== shot2.jpg =====');
    expect(output).toContain('Second image text');
  });

  it('returns an empty string with no items', () => {
    expect(buildTxt([])).toBe('');
  });
});

describe('buildMarkdown', () => {
  it('documents every image with metadata', () => {
    const output = buildMarkdown([single, second], { exportedAt: Date.UTC(2026, 0, 2) });
    expect(output.startsWith('# SnapText OCR export')).toBe(true);
    expect(output).toContain('## 1. screenshot 01.png');
    expect(output).toContain('## 2. shot2.jpg');
    expect(output).toContain('- Mean confidence: 91%');
    expect(output).toContain('- Languages: chi_sim+eng');
    expect(output).toContain('第二行');
  });
});

describe('buildJson', () => {
  it('produces parseable JSON with the expected shape', () => {
    const parsed = JSON.parse(buildJson([single], { exportedAt: Date.UTC(2026, 0, 2) }));
    expect(parsed.app).toBe('SnapText');
    expect(parsed.count).toBe(1);
    expect(parsed.items[0]).toMatchObject({
      fileName: 'screenshot 01.png',
      languages: 'chi_sim+eng',
      confidence: 91.4,
      text: 'Hello world\n第二行',
    });
    expect(parsed.items[0].createdAt).toBe('2026-01-02T03:04:05.000Z');
  });
});

describe('exportFileName', () => {
  it('uses the image name for single exports', () => {
    expect(exportFileName([single], 'txt')).toBe('screenshot 01.txt');
  });

  it('labels batch exports with the count and a timestamp', () => {
    const name = exportFileName([single, second], 'json');
    expect(name).toMatch(/^snaptext-2-images-.*\.json$/);
  });
});
