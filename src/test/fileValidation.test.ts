import { describe, expect, it } from 'vitest';
import {
  LARGE_FILE_BYTES,
  MAX_FILE_BYTES,
  fileExtension,
  formatBytes,
  validateFile,
} from '../lib/fileValidation';

const makeFile = (name: string, size: number, type: string) => ({ name, size, type });

describe('formatBytes', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('is defensive about nonsense input', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('fileExtension', () => {
  it('returns lower-cased extensions', () => {
    expect(fileExtension('Shot.PNG')).toBe('.png');
    expect(fileExtension('noext')).toBe('');
    expect(fileExtension('archive.tar.gz')).toBe('.gz');
  });
});

describe('validateFile', () => {
  it('accepts the supported raster formats', () => {
    for (const [name, type] of [
      ['a.jpg', 'image/jpeg'],
      ['a.jpeg', 'image/jpeg'],
      ['a.png', 'image/png'],
      ['a.webp', 'image/webp'],
      ['a.bmp', 'image/bmp'],
      ['a.gif', 'image/gif'],
    ]) {
      expect(validateFile(makeFile(name, 1024, type)).ok, name).toBe(true);
    }
  });

  it('accepts files with a supported extension but no mime type (dragged files)', () => {
    expect(validateFile(makeFile('screen.png', 4096, '')).ok).toBe(true);
    expect(validateFile(makeFile('photo.JPG', 4096, 'application/octet-stream')).ok).toBe(true);
  });

  it('rejects unsupported types', () => {
    expect(validateFile(makeFile('doc.pdf', 4096, 'application/pdf')).code).toBe('unsupported-type');
    expect(validateFile(makeFile('vector.svg', 4096, 'image/svg+xml')).code).toBe('unsupported-type');
  });

  it('rejects empty and oversized files', () => {
    expect(validateFile(makeFile('a.png', 0, 'image/png')).code).toBe('empty-file');
    expect(validateFile(makeFile('a.png', MAX_FILE_BYTES + 1, 'image/png')).code).toBe('too-large');
  });

  it('flags large-but-allowed files as a warning code', () => {
    expect(validateFile(makeFile('a.png', LARGE_FILE_BYTES + 1, 'image/png')).code).toBe('large-file');
    expect(validateFile(makeFile('a.png', LARGE_FILE_BYTES + 1, 'image/png')).ok).toBe(true);
  });

  it('explains that TIFF cannot be decoded in browsers', () => {
    const result = validateFile(makeFile('scan.tiff', 1024, 'image/tiff'));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('tiff-unsupported');
  });
});
