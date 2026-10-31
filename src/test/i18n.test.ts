import { describe, expect, it } from 'vitest';
import { createTranslator, detectUiLang, dictionaries, isI18nKey, translateError, TASK_STATUS_KEY } from '../i18n';

describe('dictionaries', () => {
  it('have exactly the same keys in both languages', () => {
    const en = Object.keys(dictionaries.en).sort();
    const zh = Object.keys(dictionaries.zh).sort();
    expect(zh).toEqual(en);
  });

  it('never ship empty translations', () => {
    for (const [key, value] of Object.entries(dictionaries.en)) {
      expect(value.length, `en:${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(dictionaries.zh)) {
      expect(value.length, `zh:${key}`).toBeGreaterThan(0);
    }
  });
});

describe('createTranslator', () => {
  it('translates with interpolation', () => {
    const t = createTranslator('en');
    expect(t('task.count', { count: 3 })).toBe('3 images');
    const zh = createTranslator('zh');
    expect(zh('task.count', { count: 3 })).toBe('3 张图片');
  });

  it('falls back to the key for unknown entries', () => {
    const t = createTranslator('en');
    expect(t('not.a.real.key' as never)).toBe('not.a.real.key');
  });
});

describe('translateError', () => {
  it('maps codes onto messages', () => {
    const t = createTranslator('en');
    expect(translateError(t, 'unsupported-type', { name: 'a.pdf' })).toBe('Unsupported file type: a.pdf');
  });

  it('returns the code when no message exists', () => {
    const t = createTranslator('en');
    expect(translateError(t, 'something-else')).toBe('something-else');
  });
});

describe('helpers', () => {
  it('detects keys', () => {
    expect(isI18nKey('app.name')).toBe(true);
    expect(isI18nKey('app.nope')).toBe(false);
  });

  it('has a label for every task status', () => {
    for (const key of Object.values(TASK_STATUS_KEY)) {
      expect(isI18nKey(key)).toBe(true);
    }
  });

  it('detects the UI language from a locale', () => {
    expect(detectUiLang('zh-CN')).toBe('zh');
    expect(detectUiLang('zh-Hant-TW')).toBe('zh');
    expect(detectUiLang('en-GB')).toBe('en');
    expect(detectUiLang('de-DE')).toBe('en');
  });
});
