import { describe, expect, it } from 'vitest';
import { analyzeScript, countStats, findMatches } from '../lib/text';

describe('countStats', () => {
  it('counts characters, words and paragraphs for English', () => {
    const stats = countStats('Hello world.\n\nSecond paragraph here.');
    expect(stats.characters).toBe(36);
    expect(stats.words).toBe(5);
    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(3);
  });

  it('treats each CJK character as a word', () => {
    const stats = countStats('你好世界');
    expect(stats.words).toBe(4);
    expect(stats.characters).toBe(4);
    expect(stats.charactersNoSpaces).toBe(4);
  });

  it('handles mixed Chinese and English', () => {
    const stats = countStats('SnapText 让图片文字可编辑');
    expect(stats.words).toBe(1 + 8);
    expect(stats.paragraphs).toBe(1);
  });

  it('returns zeroes for empty input', () => {
    expect(countStats('')).toEqual({
      characters: 0,
      charactersNoSpaces: 0,
      words: 0,
      lines: 0,
      paragraphs: 0,
    });
  });

  it('counts emoji as a single character', () => {
    expect(countStats('😀😀').characters).toBe(2);
  });
});

describe('analyzeScript', () => {
  it('detects dominant Chinese content', () => {
    const result = analyzeScript('这是一段中文内容，包含 ABC');
    expect(result.dominant).toBe('cjk');
    expect(result.cjkRatio).toBeGreaterThan(0.5);
  });

  it('detects dominant latin content', () => {
    const result = analyzeScript('SnapText turns images into editable text');
    expect(result.dominant).toBe('latin');
    expect(result.cjk).toBe(0);
  });

  it('reports no dominant script for symbol-only text', () => {
    expect(analyzeScript('1234 !!!').dominant).toBe('none');
    expect(analyzeScript('1234').digit).toBe(4);
  });
});

describe('findMatches', () => {
  it('finds case-insensitive occurrences', () => {
    expect(findMatches('SnapText snaptext SNAPTEXT', 'snaptext')).toEqual([0, 9, 18]);
  });

  it('does not overlap matches', () => {
    expect(findMatches('aaaa', 'aa')).toEqual([0, 2]);
  });

  it('returns nothing for an empty term', () => {
    expect(findMatches('anything', '')).toEqual([]);
  });
});
