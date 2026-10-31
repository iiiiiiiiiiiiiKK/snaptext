import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  defaultLangFromLocale,
  loadSettings,
  normalizeSettings,
  resolveTheme,
  saveSettings,
} from '../lib/settings';

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    dump: () => Object.fromEntries(data),
  };
}

describe('normalizeSettings', () => {
  it('keeps valid values', () => {
    const settings = normalizeSettings({ lang: 'eng', theme: 'dark', saveHistory: false, concurrency: 2 });
    expect(settings).toEqual({ lang: 'eng', theme: 'dark', saveHistory: false, concurrency: 2 });
  });

  it('repairs invalid values field by field', () => {
    const settings = normalizeSettings({ lang: 'klingon', theme: 'neon', saveHistory: 'yes', concurrency: 99 });
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('tolerates junk', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });
});

describe('loadSettings / saveSettings', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    saveSettings({ lang: 'chi_tra', theme: 'light', saveHistory: true, concurrency: 1 }, storage);
    expect(loadSettings(storage)).toEqual({ lang: 'chi_tra', theme: 'light', saveHistory: true, concurrency: 1 });
  });

  it('falls back to defaults when storage holds broken JSON', () => {
    const storage = memoryStorage({ 'snaptext.settings': '{not json' });
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults when storage is unavailable', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, null)).not.toThrow();
  });
});

describe('resolveTheme', () => {
  it('resolves the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('defaultLangFromLocale', () => {
  it('maps Chinese locales onto the matching script', () => {
    expect(defaultLangFromLocale('zh-TW')).toBe('chi_tra');
    expect(defaultLangFromLocale('zh-Hant-HK')).toBe('chi_tra');
    expect(defaultLangFromLocale('zh-CN')).toBe('chi_sim+eng');
    expect(defaultLangFromLocale('en-US')).toBe('chi_sim+eng');
  });
});
