import type { LangKey } from './types';

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/gif',
] as const;

export const ACCEPTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.gif',
] as const;

/** Hard ceiling: files beyond this are rejected before decoding to protect memory. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
/** Soft ceiling: accepted, but the UI warns that big images are slow to recognise. */
export const LARGE_FILE_BYTES = 8 * 1024 * 1024;

/** Browsers cannot decode TIFF in most engines; we surface a clear message. */
export const TIFF_EXTENSIONS = ['.tif', '.tiff'];

export type ValidationCode = 'ok' | 'unsupported-type' | 'empty-file' | 'too-large' | 'large-file' | 'tiff-unsupported';

export interface ValidationResult {
  code: ValidationCode;
  ok: boolean;
  /** Human readable size, e.g. `3.4 MB`. */
  sizeLabel: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
}

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

/**
 * Validate an image before it enters the pipeline. Never throws: every file
 * (including broken ones) yields a code the UI can render.
 */
export function validateFile(file: FileLike): ValidationResult {
  const sizeLabel = formatBytes(file.size);
  const extension = fileExtension(file.name);

  if (!file.size) {
    return { code: 'empty-file', ok: false, sizeLabel };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { code: 'too-large', ok: false, sizeLabel };
  }

  const mimeOk = ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number]);
  const extensionOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(extension);
  // Some browsers report an empty type for dragged files; fall back to the extension.
  if (!mimeOk && !(extensionOk && (!file.type || file.type === 'application/octet-stream'))) {
    return { code: 'unsupported-type', ok: false, sizeLabel };
  }

  if ((TIFF_EXTENSIONS as readonly string[]).includes(extension) || file.type === 'image/tiff') {
    return { code: 'tiff-unsupported', ok: false, sizeLabel };
  }

  return { code: file.size > LARGE_FILE_BYTES ? 'large-file' : 'ok', ok: true, sizeLabel };
}

export type LangLabelKey =
  | 'lang.mixedSimplified'
  | 'lang.simplified'
  | 'lang.traditional'
  | 'lang.mixedTraditional'
  | 'lang.english';

export function languageLabelKey(lang: LangKey): LangLabelKey {
  switch (lang) {
    case 'chi_sim+eng':
      return 'lang.mixedSimplified';
    case 'chi_sim':
      return 'lang.simplified';
    case 'chi_tra':
      return 'lang.traditional';
    case 'chi_tra+eng':
      return 'lang.mixedTraditional';
    case 'eng':
      return 'lang.english';
  }
}
