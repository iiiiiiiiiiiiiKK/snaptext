import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Translate } from '../i18n';
import { displayRectToImage, isUsableSelection, rectFromPoints, type Box } from '../lib/geometry';
import { languageLabelKey } from '../lib/fileValidation';
import { DEFAULT_ADJUSTMENTS, LANGUAGE_OPTIONS, type Adjustments, type LangKey, type OcrTask, type Rect } from '../lib/types';
import { IconAlert, IconFit, IconRotateLeft, IconRotateRight, IconScanRegion, IconZoomIn, IconZoomOut } from './icons';
import { Button, IconButton, Slider } from './ui';
import { cx } from '../lib/classNames';

const ZOOM_STEPS = [1, 1.5, 2, 3];

export interface ImageWorkspaceProps {
  t: Translate;
  task: OcrTask | null;
  running: boolean;
  langs: LangKey;
  onLangsChange: (langs: LangKey) => void;
  prepare: (task: OcrTask) => Promise<HTMLCanvasElement>;
  onAdjustments: (next: Adjustments) => void;
  onRegion: (rect: Rect | null) => void;
  onRecognize: () => void;
  onCancel: () => void;
}

export function ImageWorkspace({
  t,
  task,
  running,
  langs,
  onLangsChange,
  prepare,
  onAdjustments,
  onRegion,
  onRecognize,
  onCancel,
}: ImageWorkspaceProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [decodeError, setDecodeError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState<Box>({ left: 0, top: 0, width: 0, height: 0 });
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);

  const adjustments = task?.adjustments ?? DEFAULT_ADJUSTMENTS;

  const measure = useCallback(() => {
    const element = imgRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    if (!task) {
      setProcessedUrl(null);
      setNatural({ width: 0, height: 0 });
      return;
    }
    if (task.fromHistory) {
      setProcessedUrl(task.previewUrl || null);
      setNatural({ width: task.width, height: task.height });
      setDecodeError(false);
      return;
    }

    let cancelled = false;
    setDecodeError(false);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const canvas = await prepare(task);
          if (cancelled) return;
          setProcessedUrl(canvas.toDataURL('image/png'));
          setNatural({ width: canvas.width, height: canvas.height });
        } catch {
          if (!cancelled) setDecodeError(true);
        }
      })();
    }, 90);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [task, prepare]);

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, zoom, processedUrl]);

  const scale = useMemo(() => {
    if (!natural.width || !box.width) return { x: 1, y: 1 };
    return { x: box.width / natural.width, y: box.height / natural.height };
  }, [natural.width, natural.height, box.width, box.height]);

  const region = task?.region ?? null;
  const regionBox = region
    ? {
        left: region.left * scale.x,
        top: region.top * scale.y,
        width: region.width * scale.x,
        height: region.height * scale.y,
      }
    : null;

  const dragBox = drag ? rectFromPoints(drag.start, drag.current) : null;
  const dragRelative =
    dragBox && box.width
      ? {
          left: dragBox.left - box.left,
          top: dragBox.top - box.top,
          width: dragBox.width,
          height: dragBox.height,
        }
      : null;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!task || task.fromHistory || running) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ start: { x: event.clientX, y: event.clientY }, current: { x: event.clientX, y: event.clientY } });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ start: drag.start, current: { x: event.clientX, y: event.clientY } });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const selection = rectFromPoints(drag.start, { x: event.clientX, y: event.clientY });
    setDrag(null);
    if (!isUsableSelection(selection) || !natural.width) return;
    const rect = displayRectToImage(selection, box, natural);
    if (rect) onRegion(rect);
  };

  const zoomBy = (direction: 1 | -1) => {
    setZoom((current) => {
      const index = ZOOM_STEPS.indexOf(current);
      const nextIndex = Math.min(Math.max((index === -1 ? 0 : index) + direction, 0), ZOOM_STEPS.length - 1);
      return ZOOM_STEPS[nextIndex];
    });
  };

  const rotate = (delta: 90 | -90) => {
    const next = (((adjustments.rotate + delta) % 360) + 360) % 360;
    onAdjustments({ ...adjustments, rotate: next as Adjustments['rotate'] });
  };

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-label={t('preview.title')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-200/80 px-3 py-2 dark:border-ink-800">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink-900 dark:text-white">
            {task ? task.name : t('preview.title')}
          </h2>
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            {task
              ? task.fromHistory
                ? t('preview.restoredNote')
                : `${natural.width || task.width} × ${natural.height || task.height} px`
              : t('preview.empty')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={t('preview.rotateLeft')} onClick={() => rotate(-90)} disabled={!task || task.fromHistory}>
            <IconRotateLeft size={16} />
          </IconButton>
          <IconButton label={t('preview.rotateRight')} onClick={() => rotate(90)} disabled={!task || task.fromHistory}>
            <IconRotateRight size={16} />
          </IconButton>
          <IconButton label={t('preview.zoomOut')} onClick={() => zoomBy(-1)} disabled={!task}>
            <IconZoomOut size={16} />
          </IconButton>
          <IconButton label={t('preview.zoomIn')} onClick={() => zoomBy(1)} disabled={!task}>
            <IconZoomIn size={16} />
          </IconButton>
          <IconButton label={t('preview.zoomReset')} onClick={() => setZoom(1)} disabled={!task}>
            <IconFit size={16} />
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="relative min-h-[220px] flex-1 overflow-auto bg-ink-100/70 p-2 dark:bg-ink-950/60"
          data-testid="preview-frame"
        >
          {!task ? (
            <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center text-xs text-ink-500 dark:text-ink-400">
              {t('preview.empty')}
            </div>
          ) : null}

          {task && decodeError ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-red-600 dark:text-red-400">
              <IconAlert size={20} />
              {t('errors.decode-failed', { name: task.name })}
            </div>
          ) : null}

          {task && processedUrl && !decodeError ? (
            <div className="flex min-h-full w-full justify-center">
              <div className="relative inline-block self-start">
                <img
                  ref={imgRef}
                  src={processedUrl}
                  alt={task.name}
                  data-testid="preview-image"
                  onLoad={measure}
                  draggable={false}
                  className="block max-w-full select-none"
                  style={
                    zoom === 1
                      ? { maxHeight: 'min(56vh, 620px)', width: 'auto' }
                      : { width: `${zoom * 100}%`, maxWidth: 'none' }
                  }
                />
                {!task.fromHistory ? (
                  <div
                    role="presentation"
                    data-testid="region-overlay"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={() => setDrag(null)}
                    className={cx('absolute inset-0', running ? 'cursor-progress' : 'cursor-crosshair')}
                    style={{ touchAction: 'none' }}
                  >
                    {dragRelative ? (
                      <div
                        className="pointer-events-none absolute border-2 border-accent-500 bg-accent-500/15"
                        style={{
                          left: dragRelative.left,
                          top: dragRelative.top,
                          width: dragRelative.width,
                          height: dragRelative.height,
                        }}
                      />
                    ) : null}
                    {regionBox ? (
                      <div
                        data-testid="region-box"
                        className="pointer-events-none absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10"
                        style={{
                          left: regionBox.left,
                          top: regionBox.top,
                          width: regionBox.width,
                          height: regionBox.height,
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {task && !task.fromHistory ? (
          <div className="border-t border-ink-200/80 dark:border-ink-800">
            <div className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-4">
              <Slider
                label={t('preview.brightness')}
                value={adjustments.brightness}
                min={50}
                max={160}
                onChange={(value) => onAdjustments({ ...adjustments, brightness: value })}
                onReset={() => onAdjustments({ ...adjustments, brightness: 100 })}
                testId="brightness-slider"
              />
              <Slider
                label={t('preview.contrast')}
                value={adjustments.contrast}
                min={50}
                max={200}
                onChange={(value) => onAdjustments({ ...adjustments, contrast: value })}
                onReset={() => onAdjustments({ ...adjustments, contrast: 100 })}
                testId="contrast-slider"
              />
              <label className="flex items-center gap-2 text-xs font-medium text-ink-600 dark:text-ink-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 accent-accent-600 dark:border-ink-600"
                  checked={adjustments.grayscale}
                  onChange={(event) => onAdjustments({ ...adjustments, grayscale: event.target.checked })}
                  data-testid="grayscale-toggle"
                />
                {t('preview.grayscale')}
              </label>
              <button
                type="button"
                className="justify-self-start text-[11px] text-ink-500 underline-offset-2 hover:text-accent-600 hover:underline dark:text-ink-400 dark:hover:text-accent-300"
                onClick={() => onAdjustments({ ...DEFAULT_ADJUSTMENTS })}
              >
                {t('preview.resetAdjustments')}
              </button>
            </div>
            <p className="px-3 pb-1 text-[11px] leading-relaxed text-ink-400 dark:text-ink-500">{t('preview.adjustNote')}</p>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-ink-200/80 px-3 py-2 dark:border-ink-800">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[9rem] flex-1">
              <span className="label mb-1 block">{t('lang.label')}</span>
              <select
                className="field h-9 py-1 text-xs"
                value={task?.langs ?? langs}
                onChange={(event) => onLangsChange(event.target.value as LangKey)}
                data-testid="language-select"
                title={t('lang.autoHint')}
                disabled={Boolean(task?.fromHistory)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {t(languageLabelKey(option.key))}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button variant="secondary" onClick={onCancel} data-testid="cancel-active">
                  {t('task.cancel')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={onRecognize}
                  disabled={!task || task.fromHistory || decodeError}
                  data-testid="recognize-active"
                >
                  <IconScanRegion size={15} />
                  {region ? t('preview.recognizeSelection') : t('preview.recognizeFull')}
                </Button>
              )}
              {region ? (
                <Button variant="ghost" onClick={() => onRegion(null)} data-testid="clear-region">
                  {t('preview.clearSelection')}
                </Button>
              ) : null}
            </div>
          </div>
          {task && !task.fromHistory ? (
            <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
              {region ? t('preview.selectionSize', { width: region.width, height: region.height }) : t('preview.selectHint')}
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed text-ink-400 dark:text-ink-500">{t('lang.hint')}</p>
        </div>
      </div>
    </section>
  );
}
