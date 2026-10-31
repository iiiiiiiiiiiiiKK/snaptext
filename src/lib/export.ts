import type { LangKey } from './types';

export interface ExportItem {
  fileName: string;
  text: string;
  langs: LangKey;
  confidence: number | null;
  createdAt: number;
}

export const EXPORT_MIME = {
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  json: 'application/json;charset=utf-8',
} as const;

export function sanitizeFileName(name: string, fallback = 'snaptext'): string {
  // eslint-disable-next-line no-control-regex -- strip control characters that break file names
  const controlChars = /[\\/:*?"<>|\u0000-\u001f]/g;
  const base = name
    .replace(controlChars, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return base.length ? base.slice(0, 120) : fallback;
}

export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return sanitizeFileName(base);
}

/** Plain text export: a single result is exported verbatim; batches get headers. */
export function buildTxt(items: ExportItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].text.trimEnd() + '\n';
  return (
    items
      .map((item) => `===== ${item.fileName} =====\n\n${item.text.trimEnd()}`)
      .join('\n\n\n') + '\n'
  );
}

export function buildMarkdown(items: ExportItem[], meta: { exportedAt?: number; appVersion?: string } = {}): string {
  const exportedAt = new Date(meta.exportedAt ?? Date.now());
  const header = [
    '# SnapText OCR export',
    '',
    `- Exported: ${exportedAt.toISOString()}`,
    `- Images: ${items.length}`,
    meta.appVersion ? `- App version: ${meta.appVersion}` : null,
    '- Generated locally in the browser: no image ever left this device.',
    '',
    '---',
    '',
  ].filter((line): line is string => line !== null);

  const body = items.map((item, index) => {
    const confidence = item.confidence === null ? '-' : `${Math.round(item.confidence)}%`;
    return [
      `## ${index + 1}. ${item.fileName}`,
      '',
      `- Languages: ${item.langs}`,
      `- Mean confidence: ${confidence}`,
      `- Characters: ${item.text.length}`,
      '',
      item.text.trimEnd(),
      '',
    ].join('\n');
  });

  return [...header, ...body].join('\n');
}

export function buildJson(items: ExportItem[], meta: { exportedAt?: number } = {}): string {
  return JSON.stringify(
    {
      app: 'SnapText',
      generatedAt: new Date(meta.exportedAt ?? Date.now()).toISOString(),
      count: items.length,
      items: items.map((item) => ({
        fileName: item.fileName,
        languages: item.langs,
        confidence: item.confidence,
        characters: item.text.length,
        createdAt: new Date(item.createdAt).toISOString(),
        text: item.text,
      })),
    },
    null,
    2,
  );
}

export function exportFileName(items: ExportItem[], extension: 'txt' | 'md' | 'json'): string {
  if (items.length === 1) return `${baseName(items[0].fileName)}.${extension}`;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `snaptext-${items.length}-images-${stamp}.${extension}`;
}

export function downloadText(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
