import { TASK_STATUS_KEY, translateError, type Translate } from '../i18n';
import { formatBytes } from '../lib/fileValidation';
import { isRunning } from '../state/tasks';
import { taskText, type OcrTask, type TaskStatus } from '../lib/types';
import { IconAlert, IconCheck, IconDownload, IconLoader, IconPlus, IconTrash } from './icons';
import { Button, IconButton, Progress } from './ui';
import { cx } from '../lib/classNames';

const STATUS_TONE: Record<TaskStatus, string> = {
  queued: 'border-ink-200 text-ink-500 dark:border-ink-700 dark:text-ink-400',
  preparing: 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-300',
  'loading-model': 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-300',
  recognizing: 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-300',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
  cancelled: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
};

export interface TaskListProps {
  t: Translate;
  tasks: OcrTask[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (task: OcrTask) => void;
  onRecognize: (task: OcrTask) => void;
  onCancel: (task: OcrTask) => void;
  onRecognizeAll: () => void;
  onCopyAll: () => void;
  onExportAll: () => void;
  onClearAll: () => void;
  onAdd: () => void;
}

export function TaskList({
  t,
  tasks,
  activeId,
  onSelect,
  onRemove,
  onRecognize,
  onCancel,
  onRecognizeAll,
  onCopyAll,
  onExportAll,
  onClearAll,
  onAdd,
}: TaskListProps) {
  const doneCount = tasks.filter((task) => task.status === 'done' && taskText(task).trim()).length;

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-label={t('task.batch')}>
      <header className="flex items-center justify-between gap-2 border-b border-ink-200/80 px-3 py-2 dark:border-ink-800">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink-900 dark:text-white">{t('upload.title')}</h2>
          <p className="text-[11px] text-ink-500 dark:text-ink-400">{t('task.count', { count: tasks.length })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={t('upload.choose')} onClick={onAdd} data-testid="add-images">
            <IconPlus size={16} />
          </IconButton>
          {tasks.length > 0 ? (
            <IconButton label={t('task.clearAll')} onClick={onClearAll} data-testid="clear-tasks">
              <IconTrash size={16} />
            </IconButton>
          ) : null}
        </div>
      </header>

      {tasks.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-ink-200/80 px-3 py-2 dark:border-ink-800">
          <Button size="sm" variant="primary" onClick={onRecognizeAll} data-testid="recognize-all">
            {t('task.recognizeAll')}
          </Button>
          <Button size="sm" onClick={onCopyAll} disabled={doneCount === 0} data-testid="copy-all">
            {t('task.copyAll')}
          </Button>
          <Button size="sm" onClick={onExportAll} disabled={doneCount === 0} data-testid="export-all">
            <IconDownload size={13} />
            {t('task.exportAll')}
          </Button>
        </div>
      ) : null}

      <ul className="min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto scrollbar-thin dark:divide-ink-800/70" data-testid="task-list">
        {tasks.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-ink-500 dark:text-ink-400">{t('upload.emptyTasks')}</li>
        ) : null}
        {tasks.map((task) => {
          const running = isRunning(task.status);
          const text = taskText(task);
          return (
            <li key={task.id} className={cx('group', activeId === task.id && 'bg-accent-50/60 dark:bg-accent-950/20')}>
              <div className="flex items-start gap-2 p-2">
                <button
                  type="button"
                  onClick={() => onSelect(task.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left"
                  aria-current={activeId === task.id}
                  data-testid={`task-item-${task.name}`}
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-ink-200 bg-ink-100 dark:border-ink-700 dark:bg-ink-800">
                    {task.previewUrl ? (
                      <img src={task.previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink-900 dark:text-ink-100">{task.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className={cx('chip', STATUS_TONE[task.status])}>
                        {running ? <IconLoader size={10} /> : null}
                        {task.status === 'done' ? <IconCheck size={10} /> : null}
                        {task.status === 'error' ? <IconAlert size={10} /> : null}
                        {t(TASK_STATUS_KEY[task.status])}
                      </span>
                      <span className="text-[10px] text-ink-400 dark:text-ink-500">{formatBytes(task.size)}</span>
                      {task.status === 'done' && text ? (
                        <span className="text-[10px] text-ink-400 dark:text-ink-500">{t('result.statCharacters')}: {Array.from(text).length}</span>
                      ) : null}
                    </span>
                    {running ? <Progress value={task.progress} className="mt-1.5" /> : null}
                    {task.status === 'error' && task.errorCode ? (
                      <span className="mt-1 block truncate text-[10px] text-red-600 dark:text-red-400">
                        {translateError(t, task.errorCode, { detail: task.errorDetail ?? '' })}
                      </span>
                    ) : null}
                  </span>
                </button>

                <span className="flex shrink-0 flex-col items-center gap-0.5">
                  {running ? (
                    <IconButton label={t('task.cancel')} onClick={() => onCancel(task)} className="h-7 w-7" data-testid={`cancel-${task.name}`}>
                      <span className="block h-2.5 w-2.5 rounded-[2px] bg-current" />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={task.status === 'done' ? t('task.retry') : t('task.recognize')}
                      onClick={() => onRecognize(task)}
                      disabled={task.fromHistory}
                      className="h-7 w-7"
                      data-testid={`recognize-${task.name}`}
                    >
                      <IconCheck size={14} className={task.status === 'done' ? '' : 'opacity-70'} />
                    </IconButton>
                  )}
                  <IconButton label={t('task.remove')} onClick={() => onRemove(task)} className="h-7 w-7">
                    <IconTrash size={14} />
                  </IconButton>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
