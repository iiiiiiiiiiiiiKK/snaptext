import { useEffect, useMemo, useRef, useState } from 'react';
import type { Translate } from '../i18n';
import { analyzeScript, countStats, findMatches } from '../lib/text';
import { taskText, type OcrTask } from '../lib/types';
import { IconCheck, IconCopy, IconDownload, IconSearch, IconTrash } from './icons';
import { Button, IconButton, Progress, TextField } from './ui';
import { cx } from '../lib/classNames';

export interface ResultEditorProps {
  t: Translate;
  task: OcrTask | null;
  running: boolean;
  onEditText: (text: string | null) => void;
  onCopy: (text: string) => void;
  onExport: (kind: 'txt' | 'md' | 'json') => void;
}

export function ResultEditor({ t, task, running, onEditText, onCopy, onExport }: ResultEditorProps) {
  const text = task ? taskText(task) : '';
  const stats = useMemo(() => countStats(text), [text]);
  const composition = useMemo(() => analyzeScript(text), [text]);
  const [findTerm, setFindTerm] = useState('');
  const [showFind, setShowFind] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const [showCompare, setShowCompare] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const matches = useMemo(() => findMatches(text, findTerm), [text, findTerm]);

  useEffect(() => {
    setMatchIndex(0);
  }, [findTerm]);

  const gotoMatch = (index: number) => {
    if (matches.length === 0) return;
    const wrapped = ((index % matches.length) + matches.length) % matches.length;
    setMatchIndex(wrapped);
    const element = textareaRef.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(matches[wrapped], matches[wrapped] + Math.max(findTerm.length, 1));
  };

  const hasText = text.trim().length > 0;
  const edited = Boolean(task && task.editedText !== null);

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-label={t('result.title')} data-testid="result-panel">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-200/80 px-3 py-2 dark:border-ink-800">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink-900 dark:text-white">{t('result.title')}</h2>
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500 dark:text-ink-400">
            {task && task.confidence !== null ? (
              <span title={t('result.confidenceHelp')} className="chip">
                {t('result.confidence')}: {Math.round(task.confidence)}%
              </span>
            ) : null}
            {task?.durationMs ? <span>{t('result.duration', { seconds: (task.durationMs / 1000).toFixed(1) })}</span> : null}
            {edited ? (
              <span className="chip border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300">
                {t('result.edited')}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={t('result.find')} onClick={() => setShowFind((value) => !value)} data-testid="toggle-find">
            <IconSearch size={16} />
          </IconButton>
          <IconButton
            label={edited ? t('result.resetEdits') : t('result.clear')}
            onClick={() => onEditText(edited ? null : '')}
            disabled={!task}
            data-testid="reset-edits"
          >
            <IconTrash size={16} />
          </IconButton>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200/70 px-3 py-2 dark:border-ink-800/70">
        <Button size="sm" variant="primary" onClick={() => onCopy(text)} disabled={!hasText} data-testid="copy-text">
          <IconCopy size={13} />
          {t('result.copy')}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const element = textareaRef.current;
            if (!element) return;
            element.focus();
            element.select();
          }}
          disabled={!hasText}
          data-testid="select-all"
        >
          {t('result.selectAll')}
        </Button>
        <Button size="sm" onClick={() => onEditText('')} disabled={!hasText} data-testid="clear-text">
          {t('result.clear')}
        </Button>
        <span className="mx-1 hidden h-4 w-px bg-ink-200 dark:bg-ink-700 sm:block" />
        <Button size="sm" onClick={() => onExport('txt')} disabled={!hasText} data-testid="export-txt">
          <IconDownload size={13} />
          {t('result.exportTxt')}
        </Button>
        <Button size="sm" onClick={() => onExport('md')} disabled={!hasText} data-testid="export-md">
          {t('result.exportMd')}
        </Button>
        <Button size="sm" onClick={() => onExport('json')} disabled={!hasText} data-testid="export-json">
          {t('result.exportJson')}
        </Button>
      </div>

      {showFind ? (
        <div className="flex items-center gap-2 border-b border-ink-200/70 px-3 py-2 dark:border-ink-800/70">
          <TextField
            value={findTerm}
            onChange={(event) => setFindTerm(event.target.value)}
            placeholder={t('result.findPlaceholder')}
            aria-label={t('result.find')}
            data-testid="find-input"
            className="h-8 py-1"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-ink-500 dark:text-ink-400" data-testid="find-count">
            {findTerm
              ? matches.length === 0
                ? t('result.findNone')
                : t('result.findCount', { current: matchIndex + 1, total: matches.length })
              : ''}
          </span>
          <IconButton label={t('result.prevMatch')} onClick={() => gotoMatch(matchIndex - 1)} disabled={matches.length === 0}>
            <span aria-hidden className="text-xs">
              ↑
            </span>
          </IconButton>
          <IconButton label={t('result.nextMatch')} onClick={() => gotoMatch(matchIndex + 1)} disabled={matches.length === 0}>
            <span aria-hidden className="text-xs">
              ↓
            </span>
          </IconButton>
        </div>
      ) : null}

      {running ? <Progress value={task?.progress ?? 0} className="mx-3 mt-2" /> : null}

      {showCompare && task?.previewUrl ? (
        <div className="border-b border-ink-200/70 p-2 dark:border-ink-800/70">
          <img src={task.previewUrl} alt="" className="mx-auto max-h-40 rounded-md object-contain" />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {!task ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{t('result.empty')}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">{t('result.emptyHint')}</p>
          </div>
        ) : (
          <>
            {task.status === 'done' && !hasText ? (
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                {t('result.noText')}
              </p>
            ) : null}
            <textarea
              ref={textareaRef}
              data-testid="result-text"
              className={cx(
                'field min-h-[220px] flex-1 resize-y whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed',
                'lg:min-h-[300px]',
              )}
              value={text}
              spellCheck={false}
              placeholder={t('result.emptyHint')}
              onChange={(event) => onEditText(event.target.value)}
              aria-label={t('result.title')}
            />
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-200/80 px-3 py-2 text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
        <span className="tabular-nums">
          {t('result.statCharacters')} {stats.characters}
        </span>
        <span className="tabular-nums">
          {t('result.statWords')} {stats.words}
        </span>
        <span className="tabular-nums">
          {t('result.statParagraphs')} {stats.paragraphs}
        </span>
        {composition.dominant !== 'none' ? (
          <span className="tabular-nums" data-testid="composition">
            {t('result.compositionValue', {
              cjk: composition.cjk,
              latin: composition.latin,
              digit: composition.digit,
            })}
          </span>
        ) : null}
        {task?.previewUrl ? (
          <button
            type="button"
            onClick={() => setShowCompare((value) => !value)}
            className="ml-auto inline-flex items-center gap-1 text-ink-500 underline-offset-2 hover:text-accent-600 hover:underline dark:text-ink-400 dark:hover:text-accent-300"
            data-testid="toggle-compare"
          >
            {showCompare ? <IconCheck size={12} /> : null}
            {t('result.compare')}
          </button>
        ) : null}
      </footer>
    </section>
  );
}
