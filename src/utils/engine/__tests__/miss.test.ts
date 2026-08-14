import { describe, expect, test } from 'vitest';
import { MISS_KINDS, isMissKind, missKindLabel } from '@/utils/engine/miss';

// The miss taxonomy is the product's own evidence vocabulary — each kind maps to an intervention
// the product actually has (drills for recognition, the deep re-implement treatment for
// implementation and edge cases, the ordinary ladder for recall). It is deliberately small:
// four kinds a learner can tell apart in one tap, not a diagnostic questionnaire.

describe('MISS_KINDS registry', () => {
  test('exactly the four product-vocabulary kinds, each with a tappable label', () => {
    expect(MISS_KINDS.map((k) => k.kind)).toEqual(['recognition', 'implementation', 'edge-case', 'recall']);
    for (const k of MISS_KINDS) {
      expect(k.label.length).toBeGreaterThan(0);
      expect(k.label.length).toBeLessThanOrEqual(40); // a tag, not a sentence
      // Copy rule 4: information, never judgment.
      expect(k.label).not.toMatch(/fail|wrong|bad|should/i);
    }
  });

  test('isMissKind accepts registry kinds and rejects everything else', () => {
    expect(isMissKind('recognition')).toBe(true);
    expect(isMissKind('edge-case')).toBe(true);
    expect(isMissKind('vibes')).toBe(false);
    expect(isMissKind('')).toBe(false);
  });

  test('missKindLabel resolves a kind and returns null for a foreign string', () => {
    expect(missKindLabel('implementation')).toBeTruthy();
    // A payload written by a future version may carry a kind this build does not know —
    // the UI skips it rather than crashing (the validator deliberately admits any string).
    expect(missKindLabel('quantum')).toBeNull();
  });
});
