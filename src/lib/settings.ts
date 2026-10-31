import { isLangKey, type LangKey } from './types';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  lang: LangKey;
  theme: ThemeMode;
  saveHistory: boolean;
  /** Parallel OCR workers. 1 = safest for phones and low-memory laptops. */
  concurrency: number;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'chi_sim+eng',
  theme: 'system',
  saveHistory: true,
  concurrency: 1,
};

const SETTINGS_KEY = 'snaptext.settings';
export const THEME_KEY = 'snaptext.theme';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function safeStorage(): StorageLike | null {
  try {
    const probe = '__snaptext_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const input = raw as Partial<Record<keyof Settings, unknown>>;
  const lang = isLangKey(input.lang) ? input.lang : DEFAULT_SETTINGS.lang;
  const theme: ThemeMode =
    input.theme === 'light' || input.theme === 'dark' || input.theme === 'system'
      ? input.theme
      : DEFAULT_SETTINGS.theme;
  const concurrency =
    typeof input.concurrency === 'number' && input.concurrency >= 1 && input.concurrency <= 3
      ? Math.round(input.concurrency)
      : DEFAULT_SETTINGS.concurrency;
  const saveHistory = typeof input.saveHistory === 'boolean' ? input.saveHistory : DEFAULT_SETTINGS.saveHistory;
  return { lang, theme, saveHistory, concurrency };
}

export function loadSettings(storage: StorageLike | null = safeStorage()): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: StorageLike | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or disabled: settings simply do not persist.
  }
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function defaultLangFromLocale(locale: string): LangKey {
  const value = locale.toLowerCase();
  if (value.startsWith('zh-tw') || value.startsWith('zh-hk') || value.startsWith('zh-hant')) return 'chi_tra';
  if (value.startsWith('zh')) return 'chi_sim+eng';
  return 'chi_sim+eng';
}

export function detectDefaultConcurrency(): number {
  if (typeof navigator === 'undefined') return 1;
  const cores = navigator.hardwareConcurrency ?? 2;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse) return 1;
  if (cores >= 8) return 2;
  return 1;
}
