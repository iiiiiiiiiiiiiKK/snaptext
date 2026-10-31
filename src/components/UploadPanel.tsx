import { useRef, useState, type DragEvent } from 'react';
import type { Translate } from '../i18n';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, formatBytes } from '../lib/fileValidation';
import { MAX_OCR_DIMENSION } from '../lib/imageUtils';
import { IconImage, IconPlus } from './icons';
import { Button } from './ui';
import { cx } from '../lib/classNames';

export interface UploadPanelProps {
  t: Translate;
  onFiles: (files: File[]) => void;
  busy?: boolean;
  compact?: boolean;
}

export function UploadPanel({ t, onFiles, busy, compact }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFiles(Array.from(fileList));
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer?.files ?? null);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dragging) setDragging(true);
  };

  return (
    <div
      data-testid="upload-zone"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      className={cx(
        'rounded-xl border border-dashed p-4 text-center transition',
        dragging
          ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/30'
          : 'border-ink-300 bg-white/60 hover:border-accent-400 hover:bg-accent-50/40 dark:border-ink-700 dark:bg-ink-900/40 dark:hover:border-accent-500/60 dark:hover:bg-ink-900',
        compact ? 'py-3' : 'py-5',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        multiple
        className="sr-only"
        data-testid="file-input"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300">
        <IconImage size={20} />
      </div>

      <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{t('upload.dropTitle')}</p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{t('upload.paste')}</p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()} loading={busy} data-testid="choose-images">
          <IconPlus size={14} />
          {t('upload.choose')}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">{t('upload.formats')}</p>
      <p className="text-[11px] text-ink-400 dark:text-ink-500">
        {t('upload.limits', { size: formatBytes(MAX_FILE_BYTES) })}
      </p>
      <p className="mt-1 text-[11px] text-ink-400 dark:text-ink-500">
        {t('upload.tooLargeNote', { px: MAX_OCR_DIMENSION })}
      </p>
    </div>
  );
}
