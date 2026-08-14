import { describe, expect, test } from 'vitest';
import { REFLECTIONS, reflectionForDate } from '@/data/reflections';

// The corpus rules are product law (design record §4): a quotation renders verbatim with its
// attribution and carries checkable provenance; an original note carries none. These tests are
// the regression fence against the corpus drifting back into `quotes.ts` territory —
// unattributable lines wearing famous names.

describe('reflections corpus integrity', () => {
  test('ids are unique and every text is short, trimmed prose', () => {
    const ids = new Set(REFLECTIONS.map((r) => r.id));
    expect(ids.size).toBe(REFLECTIONS.length);
    for (const r of REFLECTIONS) {
      expect(r.text.length).toBeLessThanOrEqual(200);
      expect(r.text).toBe(r.text.trim());
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  test('every quotation carries an attribution and a re-checkable source; notes carry neither attribution nor a quotable license', () => {
    for (const r of REFLECTIONS) {
      if (r.kind === 'quotation') {
        expect(r.attribution, r.id).toBeTruthy();
        expect(r.source.locator, r.id).toBeTruthy();
        expect(['quotable-with-credit', 'free-distribution-with-credit', 'public-domain-original']).toContain(
          r.source.license,
        );
      } else {
        expect(r.attribution, r.id).toBeUndefined();
        expect(r.source.license, r.id).toBe('original');
        expect(r.source.tradition, r.id).toBe('practice');
      }
    }
  });

  test('Ryōkan quotations are honestly labeled: a fresh project translation or an attested record, never a copyrighted translation', () => {
    for (const r of REFLECTIONS.filter((x) => x.source.tradition === 'ryokan')) {
      expect(r.kind, r.id).toBe('quotation');
      expect(r.source.license, r.id).toBe('public-domain-original');
      expect(
        /translated for this project|recorded by Teishin-ni/.test(r.attribution ?? ''),
        `${r.id} must state its translation/record basis in the attribution`,
      ).toBe(true);
      // The locator holds the public-domain Japanese original the translation was made from.
      expect(/[぀-ヿ一-鿿]/.test(r.source.locator ?? ''), r.id).toBe(true);
    }
  });

  test('the misattribution fence: no famous-name attributions from the old quotes corpus', () => {
    // quotes.ts shipped "Aristotle" (actually Will Durant) and a Lincoln line with no primary
    // source. The corpus must never again attribute text to anyone outside its verified sources.
    const banned = /Aristotle|Lincoln|Einstein|Churchill|Jobs|Gladwell|Confucius|Ford|Edison|Mandela/i;
    for (const r of REFLECTIONS) {
      expect(banned.test(r.attribution ?? ''), r.id).toBe(false);
      expect(banned.test(r.text), r.id).toBe(false);
    }
  });

  test('themes cover the returning pool, and no returning line leaks into ordinary rotation', () => {
    const returning = REFLECTIONS.filter((r) => r.theme === 'returning');
    expect(returning.length).toBeGreaterThan(0);
    // Ordinary days must never show "a missed day" copy describing a miss that did not happen.
    for (let day = 1; day <= 28; day++) {
      const iso = `2026-08-${String(day).padStart(2, '0')}`;
      expect(reflectionForDate(iso, false).theme).not.toBe('returning');
    }
  });
});

describe('reflectionForDate', () => {
  test('deterministic: the same date always yields the same reflection', () => {
    expect(reflectionForDate('2026-08-14')).toBe(reflectionForDate('2026-08-14'));
    expect(reflectionForDate('2026-08-14', true)).toBe(reflectionForDate('2026-08-14', true));
  });

  test('a genuine return draws from the returning pool', () => {
    expect(reflectionForDate('2026-08-14', true).theme).toBe('returning');
  });

  test('consecutive dates vary the line', () => {
    const a = reflectionForDate('2026-08-14');
    const b = reflectionForDate('2026-08-15');
    expect(a.id).not.toBe(b.id);
  });
});
