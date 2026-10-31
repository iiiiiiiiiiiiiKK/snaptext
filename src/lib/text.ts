export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  paragraphs: number;
}

const LATIN_WORD = /[A-Za-z0-9_'’-]+/g;
const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

/**
 * Count text statistics.
 *
 * `words` is a mixed-script count: latin/number tokens plus one "word" per CJK
 * character, which matches how word counters treat Chinese text.
 */
export function countStats(text: string): TextStats {
  const characters = Array.from(text).length;
  const charactersNoSpaces = Array.from(text.replace(/\s/g, '')).length;
  const latinWords = text.match(LATIN_WORD)?.length ?? 0;
  const cjkChars = text.match(CJK_CHAR)?.length ?? 0;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean).length;

  return {
    characters,
    charactersNoSpaces,
    words: latinWords + cjkChars,
    lines,
    paragraphs,
  };
}

export interface ScriptComposition {
  cjk: number;
  latin: number;
  digit: number;
  other: number;
  /** Share of CJK characters among cjk+latin characters, 0..1. */
  cjkRatio: number;
  dominant: 'cjk' | 'latin' | 'none';
}

/**
 * Post-recognition script analysis. This is deliberately computed from the
 * recognised text instead of guessing a language before OCR runs: the app never
 * claims to *predict* a language from pixels.
 */
export function analyzeScript(text: string): ScriptComposition {
  const cjk = text.match(CJK_CHAR)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  const digit = text.match(/[0-9]/g)?.length ?? 0;
  const total = Array.from(text.replace(/\s/g, '')).length;
  const other = Math.max(total - cjk - latin - digit, 0);
  const considered = cjk + latin;
  const cjkRatio = considered === 0 ? 0 : cjk / considered;
  const dominant: ScriptComposition['dominant'] =
    considered < 2 ? 'none' : cjkRatio >= 0.5 ? 'cjk' : 'latin';

  return { cjk, latin, digit, other, cjkRatio, dominant };
}

export function findMatches(text: string, term: string): number[] {
  if (!term) return [];
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  const hits: number[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    hits.push(index);
    index = haystack.indexOf(needle, index + needle.length);
  }
  return hits;
}
