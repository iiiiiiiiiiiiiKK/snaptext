export type LangKey = 'chi_sim+eng' | 'chi_sim' | 'chi_tra' | 'chi_tra+eng' | 'eng';

/** Language options exposed in the UI. `langs` is the value passed to Tesseract. */
export const LANGUAGE_OPTIONS: { key: LangKey; langs: string }[] = [
  { key: 'chi_sim+eng', langs: 'chi_sim+eng' },
  { key: 'chi_sim', langs: 'chi_sim' },
  { key: 'chi_tra', langs: 'chi_tra' },
  { key: 'chi_tra+eng', langs: 'chi_tra+eng' },
  { key: 'eng', langs: 'eng' },
];

export function langsFor(key: LangKey): string {
  return LANGUAGE_OPTIONS.find((option) => option.key === key)?.langs ?? 'eng';
}

export function isLangKey(value: unknown): value is LangKey {
  return LANGUAGE_OPTIONS.some((option) => option.key === value);
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Adjustments {
  /** Clockwise rotation in degrees, baked into the pixels we send to OCR. */
  rotate: 0 | 90 | 180 | 270;
  /** Percentage, 100 = untouched. */
  brightness: number;
  /** Percentage, 100 = untouched. */
  contrast: number;
  grayscale: boolean;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  rotate: 0,
  brightness: 100,
  contrast: 100,
  grayscale: false,
};

export type TaskStatus =
  | 'queued'
  | 'preparing'
  | 'loading-model'
  | 'recognizing'
  | 'done'
  | 'error'
  | 'cancelled';

export const RUNNING_STATUSES: TaskStatus[] = ['preparing', 'loading-model', 'recognizing'];

export interface OcrTask {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** Object URL of the untouched original file (only for in-session tasks). */
  previewUrl: string;
  /** Natural size of the original file. */
  width: number;
  height: number;
  status: TaskStatus;
  /** 0..1 for the current phase. */
  progress: number;
  /** Raw text returned by the engine. */
  text: string;
  /** User edits; `null` means "not edited yet". */
  editedText: string | null;
  confidence: number | null;
  errorCode: string | null;
  errorDetail: string | null;
  langs: LangKey;
  /** Region (in processed-image pixels) that was recognised, if any. */
  region: Rect | null;
  adjustments: Adjustments;
  durationMs: number | null;
  createdAt: number;
  /** Set for records restored from history (no File handle available). */
  fromHistory: boolean;
}

export function taskText(task: OcrTask): string {
  return task.editedText ?? task.text;
}
