import { useState } from 'react';
import type { Translate } from '../i18n';
import { languageLabelKey } from '../lib/fileValidation';
import type { HistoryRecord } from '../lib/history';
import { IconClock, IconTrash } from './icons';
import { Button, IconButton } from './ui';
import { cx } from '../lib/classNames';

export interface HistoryPanelProps {
  t: Translate;
  records: HistoryRecord[];
  storeKind: 'indexeddb' | 'memory';
  saveHistory: boolean;
  onOpen: (record: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function HistoryPanel({ t, records, storeKind, saveHistory, onOpen, onDelete, onClear }: HistoryPanelProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-label={t('history.title')} data-testid="history-panel">
      <header className="flex items-center justify-between gap-2 border-b border-ink-200/80 px-3 py-2 dark:border-ink-800">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-white">
            <IconClock size={14} />
            {t('history.title')}
          </h2>
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            {saveHistory ? t('history.count', { count: records.length }) : t('misc.notSaved')}
          </p>
        </div>
        {records.length > 0 && saveHistory ? (
          confirming ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onClear();
                  setConfirming(false);
                }}
                data-testid="confirm-clear-history"
              >
                {t('misc.confirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t('misc.cancel')}
              </Button>
            </div>
          ) : (
            <IconButton label={t('history.clear')} onClick={() => setConfirming(true)} data-testid="clear-history">
              <IconTrash size={15} />
            </IconButton>
          )
        ) : null}
      </header>

      {storeKind === 'memory' ? (
        <p className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          {t('history.memoryOnly')}
        </p>
      ) : null}

      <ul
        className="max-h-64 min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto scrollbar-thin dark:divide-ink-800/70"
        data-testid="history-list"
      >
        {!saveHistory ? (
          <li className="px-3 py-5 text-center text-[11px] text-ink-500 dark:text-ink-400">{t('history.saveHint')}</li>
        ) : null}
        {saveHistory && records.length === 0 ? (
          <li className="px-3 py-5 text-center text-[11px] text-ink-500 dark:text-ink-400">{t('history.empty')}</li>
        ) : null}
        {saveHistory
          ? records.map((record) => (
              <li key={record.id} className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => onOpen(record)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
                  data-testid={`history-item-${record.fileName}`}
                >
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded border border-ink-200 bg-ink-100 dark:border-ink-700 dark:bg-ink-800">
                    {record.thumbnail ? <img src={record.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-ink-800 dark:text-ink-100">
                      {record.fileName}
                    </span>
                    <span className="block truncate text-[10px] text-ink-500 dark:text-ink-400">
                      {formatDate(record.createdAt)} · {t(languageLabelKey(record.langs))} · {record.text.length}
                    </span>
                  </span>
                </button>
                <IconButton
                  label={t('history.delete')}
                  onClick={() => onDelete(record.id)}
                  className={cx('h-7 w-7 shrink-0')}
                  data-testid={`delete-history-${record.fileName}`}
                >
                  <IconTrash size={13} />
                </IconButton>
              </li>
            ))
          : null}
      </ul>
    </section>
  );
}
