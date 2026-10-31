import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createTranslator, detectUiLang, translateError, type UiLang } from './i18n';
import { HistoryPanel } from './components/HistoryPanel';
import { ImageWorkspace } from './components/ImageWorkspace';
import { PrivacyDialog, SettingsDialog } from './components/Dialogs';
import { ResultEditor } from './components/ResultEditor';
import { TaskList } from './components/TaskList';
import { TopBar } from './components/TopBar';
import { UploadPanel } from './components/UploadPanel';
import { IconGithub, IconLoader, IconShield, IconX } from './components/icons';
import { Toasts, type Toast, type ToastTone } from './components/ui';import {
  EXPORT_MIME,
  buildJson,
  buildMarkdown,
  buildTxt,
  downloadText,
  exportFileName,
  type ExportItem,
} from './lib/export';
import { formatBytes, MAX_FILE_BYTES, validateFile } from './lib/fileValidation';
import { createHistoryStore, makeHistoryId, type HistoryRecord } from './lib/history';
import { cx } from './lib/classNames';
import { cropCanvas, decodeImage, makeThumbnail, renderProcessed } from './lib/imageUtils';
import { OcrEngine, OcrError, getOcrEngine } from './lib/ocrEngine';
import {
  detectDefaultConcurrency,
  loadSettings,
  resolveTheme,
  safeStorage,
  saveSettings,
  THEME_KEY,
  type Settings,
} from './lib/settings';
import { DEFAULT_ADJUSTMENTS, taskText, type LangKey, type OcrTask, type Rect } from './lib/types';
import { EMPTY_TASK_STATE, findTask, makeTask, tasksReducer } from './state/tasks';

const AUTHOR_X_URL = 'https://x.com/0xkillcoin';
const REPO_URL = 'https://github.com/iiiiiiiiiiiiiKK/snaptext';
const UI_LANG_KEY = 'snaptext.uiLang';
const MAX_PREPARED_CANVASES = 6;

type MobileTab = 'images' | 'preview' | 'result';

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function canvasKey(task: OcrTask): string {
  const { rotate, brightness, contrast, grayscale } = task.adjustments;
  return [task.previewUrl, rotate, brightness, contrast, grayscale].join('|');
}

function fallbackCopy(value: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export default function App() {
  const storage = useMemo(() => safeStorage(), []);
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = loadSettings(storage);
    if (storage && !storage.getItem('snaptext.settings')) {
      return { ...stored, concurrency: detectDefaultConcurrency() };
    }
    return stored;
  });
  const [uiLang, setUiLang] = useState<UiLang>(() => {
    const saved = storage?.getItem(UI_LANG_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
    return detectUiLang(typeof navigator !== 'undefined' ? navigator.language : 'en');
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [state, dispatch] = useReducer(tasksReducer, EMPTY_TASK_STATE);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>('images');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyKind, setHistoryKind] = useState<'indexeddb' | 'memory'>('indexeddb');
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [offlineHint, setOfflineHint] = useState(false);

  const t = useMemo(() => createTranslator(uiLang), [uiLang]);
  const engine = useMemo<OcrEngine>(() => getOcrEngine(), []);
  const historyStore = useMemo(() => createHistoryStore(), []);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const toastTimers = useRef<number[]>([]);
  const jobsRef = useRef(new Map<string, string>());
  const canvasCache = useRef(new Map<string, { key: string; canvas: HTMLCanvasElement }>());
  const addFilesRef = useRef<(files: File[]) => void>(() => undefined);
  const dropHandledRef = useRef(false);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = makeId();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
    toastTimers.current.push(timer);
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Theme ---------------------------------------------------------------
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = resolveTheme(settings.theme, query.matches);
      setResolvedTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.style.colorScheme = next;
      try {
        storage?.setItem(THEME_KEY, next);
      } catch {
        // ignore quota errors
      }
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [settings.theme, storage]);

  useEffect(() => {
    engine.setConcurrency(settings.concurrency);
  }, [engine, settings.concurrency]);

  useEffect(() => {
    try {
      storage?.setItem(UI_LANG_KEY, uiLang);
    } catch {
      // ignore
    }
    document.documentElement.lang = uiLang === 'zh' ? 'zh-CN' : 'en';
  }, [uiLang, storage]);

  const refreshHistory = useCallback(async () => {
    try {
      const records = await historyStore.list();
      setHistory(records);
      setHistoryKind(historyStore.kind);
    } catch {
      // History failures are never fatal.
    }
  }, [historyStore]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const update = () => setOfflineHint(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        saveSettings(next, storage);
        return next;
      });
    },
    [storage],
  );

  const cacheCanvas = useCallback((id: string, key: string, canvas: HTMLCanvasElement) => {
    const cache = canvasCache.current;
    cache.delete(id);
    cache.set(id, { key, canvas });
    while (cache.size > MAX_PREPARED_CANVASES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }, []);

  /** Decode + preprocess once per (image, adjustments) pair; shared by preview and OCR. */
  const prepare = useCallback(
    async (task: OcrTask): Promise<HTMLCanvasElement> => {
      const key = canvasKey(task);
      const cached = canvasCache.current.get(task.id);
      if (cached && cached.key === key) return cached.canvas;
      if (!task.previewUrl) throw new Error('no image data');
      const response = await fetch(task.previewUrl);
      if (!response.ok) throw new Error('cannot read image data');
      const blob = await response.blob();
      const decoded = await decodeImage(blob);
      try {
        const canvas = renderProcessed(decoded, task.adjustments);
        cacheCanvas(task.id, key, canvas);
        return canvas;
      } finally {
        decoded.close();
      }
    },
    [cacheCanvas],
  );

  const saveHistoryRecord = useCallback(
    async (task: OcrTask, canvas: HTMLCanvasElement, text: string, confidence: number | null) => {
      try {
        const thumbnail = makeThumbnail(canvas, canvas.width, canvas.height);
        await historyStore.add({
          id: makeHistoryId(),
          fileName: task.name,
          text,
          langs: task.langs,
          confidence,
          createdAt: Date.now(),
          thumbnail: thumbnail || null,
          width: canvas.width,
          height: canvas.height,
          edited: false,
        });
        await refreshHistory();
      } catch {
        // Storage problems never break recognition.
      }
    },
    [historyStore, refreshHistory],
  );

  const runTask = useCallback(
    async (task: OcrTask) => {
      if (task.fromHistory) return;
      if (jobsRef.current.has(task.id)) return;
      const jobId = makeId();
      jobsRef.current.set(task.id, jobId);
      dispatch({ type: 'set-status', id: task.id, status: 'preparing' });
      dispatch({ type: 'set-progress', id: task.id, progress: 0 });

      try {
        const canvas = await prepare(task);
        const input = task.region ? cropCanvas(canvas, task.region) : canvas;
        dispatch({ type: 'set-status', id: task.id, status: 'loading-model' });

        const outcome = await engine.recognize({
          jobId,
          langs: task.langs,
          image: input,
          onProgress: (progress) => {
            dispatch({
              type: 'patch',
              id: task.id,
              patch: {
                status: progress.phase === 'model' ? 'loading-model' : 'recognizing',
                progress: progress.ratio,
              },
            });
          },
        });

        dispatch({
          type: 'set-result',
          id: task.id,
          text: outcome.text,
          confidence: outcome.confidence,
          durationMs: outcome.durationMs,
        });

        if (settingsRef.current.saveHistory) {
          await saveHistoryRecord(task, input, outcome.text, outcome.confidence);
        }
        if (window.innerWidth < 1024) setMobileTab('result');
      } catch (error) {
        if (error instanceof OcrError && error.code === 'cancelled') {
          dispatch({ type: 'set-status', id: task.id, status: 'cancelled' });
        } else {
          const code = error instanceof OcrError ? error.code : 'recognize-failed';
          const detail = error instanceof Error ? error.message : String(error);
          dispatch({ type: 'set-status', id: task.id, status: 'error', errorCode: code, errorDetail: detail });
          pushToast(translateError(t, code, { detail }), 'error');
        }
      } finally {
        jobsRef.current.delete(task.id);
      }
    },
    [engine, prepare, pushToast, saveHistoryRecord, t],
  );

  const runMany = useCallback(
    async (tasks: OcrTask[]) => {
      const targets = tasks.filter((task) => !task.fromHistory && !jobsRef.current.has(task.id));
      if (targets.length === 0) return;
      let cursor = 0;
      const limit = Math.max(1, Math.min(settingsRef.current.concurrency, 3));
      const workers = Array.from({ length: limit }, async () => {
        while (cursor < targets.length) {
          const task = targets[cursor];
          cursor += 1;
          await runTask(task);
        }
      });
      await Promise.all(workers);
    },
    [runTask],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setPreparingFiles(true);
      const created: OcrTask[] = [];
      for (const file of files) {
        const validation = validateFile(file);
        if (!validation.ok) {
          pushToast(translateError(t, validation.code, { name: file.name, size: formatBytes(MAX_FILE_BYTES) }), 'error');
          continue;
        }
        if (validation.code === 'large-file') {
          pushToast(t('errors.large-file', { name: file.name }), 'warning');
        }
        try {
          const decoded = await decodeImage(file);
          created.push(
            makeTask({
              id: makeId(),
              name: file.name || 'image',
              size: file.size,
              mimeType: file.type || 'image/*',
              previewUrl: URL.createObjectURL(file),
              width: decoded.width,
              height: decoded.height,
              langs: settingsRef.current.lang,
            }),
          );
          decoded.close();
        } catch {
          pushToast(t('errors.decode-failed', { name: file.name }), 'error');
        }
      }
      setPreparingFiles(false);
      if (created.length > 0) {
        dispatch({ type: 'add', tasks: created });
        setMobileTab('preview');
      }
    },
    [pushToast, t],
  );
  addFilesRef.current = (files) => void addFiles(files);

  // Clipboard paste & global drop ---------------------------------------
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files: File[] = [];
      const items = event.clipboardData?.items;
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind !== 'file') continue;
          const file = item.getAsFile();
          if (file && file.type.startsWith('image/')) files.push(file);
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        addFilesRef.current(files);
      }
    };

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      if (dropHandledRef.current) {
        dropHandledRef.current = false;
        return;
      }
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      const images = dropped.filter(
        (file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(file.name),
      );
      if (images.length === 0) return;
      event.preventDefault();
      addFilesRef.current(images);
    };

    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const activeTask = findTask(state, state.activeId);
  const activeRunning = Boolean(activeTask && jobsRef.current.has(activeTask.id));

  const cancelTask = useCallback(
    (task: OcrTask) => {
      const jobId = jobsRef.current.get(task.id);
      if (jobId) engine.cancel(jobId);
    },
    [engine],
  );

  const removeTask = useCallback(
    (task: OcrTask) => {
      cancelTask(task);
      if (task.previewUrl.startsWith('blob:')) URL.revokeObjectURL(task.previewUrl);
      canvasCache.current.delete(task.id);
      dispatch({ type: 'remove', id: task.id });
    },
    [cancelTask],
  );

  const clearAll = useCallback(() => {
    state.tasks.forEach((task) => {
      cancelTask(task);
      if (task.previewUrl.startsWith('blob:')) URL.revokeObjectURL(task.previewUrl);
    });
    canvasCache.current.clear();
    dispatch({ type: 'clear' });
  }, [cancelTask, state.tasks]);

  const copyText = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        pushToast(t('errors.nothing-to-copy'), 'warning');
        return;
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else if (!fallbackCopy(value)) {
          throw new Error('clipboard unavailable');
        }
        pushToast(t('result.copied'), 'success');
      } catch {
        if (fallbackCopy(value)) {
          pushToast(t('result.copied'), 'success');
        } else {
          pushToast(t('result.copyFailed'), 'error');
        }
      }
    },
    [pushToast, t],
  );

  const toExportItem = (task: OcrTask): ExportItem => ({
    fileName: task.name,
    text: taskText(task),
    langs: task.langs,
    confidence: task.confidence,
    createdAt: task.createdAt,
  });

  const exportItems = useCallback(
    (items: ExportItem[], kind: 'txt' | 'md' | 'json') => {
      if (items.length === 0) {
        pushToast(t('errors.nothing-to-export'), 'warning');
        return;
      }
      const content =
        kind === 'txt' ? buildTxt(items) : kind === 'md' ? buildMarkdown(items) : buildJson(items);
      downloadText(exportFileName(items, kind), content, EXPORT_MIME[kind]);
    },
    [pushToast, t],
  );

  const exportActive = useCallback(
    (kind: 'txt' | 'md' | 'json') => {
      if (!activeTask) {
        pushToast(t('errors.no-active-task'), 'warning');
        return;
      }
      exportItems([toExportItem(activeTask)], kind);
    },
    [activeTask, exportItems, pushToast, t],
  );

  const exportAll = useCallback(
    (kind: 'txt' | 'md' | 'json') => {
      const items = state.tasks.filter((task) => taskText(task).trim()).map(toExportItem);
      exportItems(items, kind);
    },
    [exportItems, state.tasks],
  );

  const copyAll = useCallback(() => {
    const merged = state.tasks
      .filter((task) => taskText(task).trim())
      .map((task) => `===== ${task.name} =====\n\n${taskText(task).trim()}`)
      .join('\n\n\n');
    void copyText(merged);
  }, [copyText, state.tasks]);

  const openHistoryRecord = useCallback((record: HistoryRecord) => {
    const task = makeTask({
      id: makeId(),
      name: record.fileName,
      size: 0,
      mimeType: 'image/*',
      previewUrl: record.thumbnail ?? '',
      width: record.width,
      height: record.height,
      langs: record.langs,
      createdAt: record.createdAt,
    });
    dispatch({
      type: 'add',
      tasks: [
        {
          ...task,
          status: 'done',
          progress: 1,
          text: record.text,
          confidence: record.confidence,
          fromHistory: true,
        },
      ],
    });
    setMobileTab('result');
    pushToast(t('history.restored'), 'info');
  }, [pushToast, t]);

  const deleteHistoryRecord = useCallback(
    async (id: string) => {
      await historyStore.remove(id);
      await refreshHistory();
    },
    [historyStore, refreshHistory],
  );

  const clearHistory = useCallback(async () => {
    await historyStore.clear();
    await refreshHistory();
  }, [historyStore, refreshHistory]);

  const clearModels = useCallback(async () => {
    await engine.reset();
    pushToast(t('settings.modelsCleared'), 'success');
  }, [engine, pushToast, t]);

  const setActiveLangs = useCallback(
    (langs: LangKey) => {
      updateSettings({ lang: langs });
      if (activeTask) dispatch({ type: 'set-langs', id: activeTask.id, langs });
    },
    [activeTask, updateSettings],
  );

  const setAdjustments = useCallback(
    (adjustments: typeof DEFAULT_ADJUSTMENTS) => {
      if (!activeTask) return;
      dispatch({ type: 'set-adjustments', id: activeTask.id, adjustments });
    },
    [activeTask],
  );

  const setRegion = useCallback(
    (region: Rect | null) => {
      if (!activeTask) return;
      dispatch({ type: 'set-region', id: activeTask.id, region });
    },
    [activeTask],
  );

  const mobileTabs: { key: MobileTab; label: string; badge?: number }[] = [
    { key: 'images', label: t('misc.mobileTabsImages'), badge: state.tasks.length },
    { key: 'preview', label: t('misc.mobileTabsPreview') },
    { key: 'result', label: t('misc.mobileTabsResult') },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-ink-100 dark:bg-ink-950">
      <TopBar
        t={t}
        uiLang={uiLang}
        onUiLangChange={setUiLang}
        theme={settings.theme}
        resolvedTheme={resolvedTheme}
        onThemeChange={(theme) => updateSettings({ theme })}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main id="main" className="mx-auto w-full max-w-[1800px] flex-1 px-2.5 pb-24 pt-2.5 sm:px-4 lg:px-6 lg:pb-6">
        <div className="grid min-w-0 grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-3 xl:grid-cols-[minmax(0,320px)_minmax(0,1.05fr)_minmax(0,0.95fr)]">
          {/* Left rail: upload, task list, history */}
          <div className={cx('flex min-w-0 flex-col gap-2.5 lg:gap-3', mobileTab === 'images' ? 'flex' : 'hidden', 'lg:flex')}>
            <UploadPanel t={t} onFiles={(files) => void addFiles(files)} busy={preparingFiles} />

            <div className="min-h-0 lg:flex-1">
              <TaskList
                t={t}
                tasks={state.tasks}
                activeId={state.activeId}
                onSelect={(id) => {
                  dispatch({ type: 'activate', id });
                  setMobileTab('preview');
                }}
                onRemove={removeTask}
                onRecognize={(task) => void runTask(task)}
                onCancel={cancelTask}
                onRecognizeAll={() => void runMany(state.tasks)}
                onCopyAll={copyAll}
                onExportAll={() => exportAll('txt')}
                onClearAll={clearAll}
                onAdd={() => document.querySelector<HTMLInputElement>('[data-testid="file-input"]')?.click()}
              />
            </div>

            <HistoryPanel
              t={t}
              records={history}
              storeKind={historyKind}
              saveHistory={settings.saveHistory}
              onOpen={openHistoryRecord}
              onDelete={(id) => void deleteHistoryRecord(id)}
              onClear={() => void clearHistory()}
            />
          </div>

          {/* Middle: image + adjustments + region selection */}
          <div className={cx('min-w-0', mobileTab === 'preview' ? 'block' : 'hidden', 'lg:block')}>
            <ImageWorkspace
              t={t}
              task={activeTask}
              running={activeRunning}
              langs={settings.lang}
              onLangsChange={setActiveLangs}
              prepare={prepare}
              onAdjustments={setAdjustments}
              onRegion={setRegion}
              onRecognize={() => {
                if (activeTask) void runTask(activeTask);
              }}
              onCancel={() => {
                if (activeTask) cancelTask(activeTask);
              }}
            />
          </div>

          {/* Right: result editor */}
          <div className={cx('min-w-0 lg:col-span-2 xl:col-span-1', mobileTab === 'result' ? 'block' : 'hidden', 'lg:block')}>
            <ResultEditor
              t={t}
              task={activeTask}
              running={activeRunning}
              onEditText={(text) => {
                if (!activeTask) return;
                dispatch({ type: 'set-edited-text', id: activeTask.id, text });
              }}
              onCopy={(value) => void copyText(value)}
              onExport={exportActive}
            />
          </div>
        </div>

        <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink-500 dark:text-ink-400">
          <span className="inline-flex items-center gap-1">
            <IconShield size={12} />
            {t('misc.footerPrivacy')}
          </span>
          <a
            href={AUTHOR_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent-600 dark:hover:text-accent-300"
          >
            <IconX size={11} />
            @0xkillcoin
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent-600 dark:hover:text-accent-300"
          >
            <IconGithub size={12} />
            GitHub
          </a>
          <button type="button" onClick={() => setPrivacyOpen(true)} className="hover:text-accent-600 dark:hover:text-accent-300">
            {t('privacy.title')}
          </button>
          {offlineHint ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <IconLoader size={11} />
              {t('misc.offline')}
            </span>
          ) : null}
        </footer>
      </main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/80 bg-white/95 px-2 pt-1 safe-bottom backdrop-blur dark:border-ink-800 dark:bg-ink-950/95 lg:hidden"
        aria-label="Panels"
      >
        <div className="grid grid-cols-3 gap-1 pb-1">
          {mobileTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMobileTab(tab.key)}
              data-testid={`mobile-tab-${tab.key}`}
              aria-current={mobileTab === tab.key}
              className={cx(
                'flex min-h-[42px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition',
                mobileTab === tab.key
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                  : 'text-ink-500 dark:text-ink-400',
              )}
            >
              {tab.label}
              {tab.badge ? (
                <span className="rounded-full bg-ink-200 px-1.5 text-[10px] text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />

      <PrivacyDialog t={t} open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <SettingsDialog
        t={t}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        uiLang={uiLang}
        onUiLangChange={setUiLang}
        onClearModels={() => void clearModels()}
        onClearHistory={() => void clearHistory()}
        historyCount={history.length}
        storageKind={historyKind}
      />
    </div>
  );
}
