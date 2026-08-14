// The daily reflection corpus — one short line for the Dashboard epigraph rail.
//
// This file replaced `quotes.ts`, a wall of motivational internet quotes that included at least
// two famous misattributions. The rule here is absolute and test-enforced: a `quotation` renders
// verbatim from a source we actually fetched and may legally quote, with its attribution shown;
// a `note` is original copy written for this product and shows no attribution at all — an
// unattributed plain sentence makes no false claim. Provenance for every entry, including the
// licensing analysis and the translation decisions, lives in
// docs/superpowers/specs/2026-08-14-practice-engine-design.md.
//
// Sourcing summary:
// - "The Teaching of Buddha" (Bukkyō Dendō Kyōkai, 2005 printing) states "Any part of this book
//   may be quoted without permission"; quotations carry the book's own section locators.
// - The Buddha's last words are NOT in the BDK anthology; they are quoted from DN 16 in the
//   Vajira & Story translation (Buddhist Publication Society, free-distribution terms).
// - No public-domain English translation of Ryōkan exists (verified 2026-08-14: the earliest
//   English book is Fischer 1937). Every Ryōkan line here is translated for this project from
//   the public-domain Japanese original, and the attribution says so. Poems were chosen from the
//   high-attestation corpus only; the famous "falling cherry blossoms" verse is a documented
//   misattribution and must never be added.
//
// One reflection per day, chosen deterministically from the date. On a genuine return (the same
// gate Today's ReturnNotice uses) the line is drawn from the `returning` theme instead — the one
// moment the evidence says a fresh-start word actually lands. No entry is ever a claim about the
// learner, an instruction to do more, or a number.

export type ReflectionTheme =
  | 'beginning'
  | 'returning'
  | 'effort'
  | 'presence'
  | 'impermanence'
  | 'sufficiency';

export interface ReflectionSource {
  tradition: 'buddhist' | 'ryokan' | 'practice';
  /** The work the text comes from, for quotations. */
  work?: string;
  /** Section/locator inside the work, precise enough to re-check. */
  locator?: string;
  /** Licensing basis for shipping the text. */
  license: 'quotable-with-credit' | 'free-distribution-with-credit' | 'public-domain-original' | 'original';
  /** Provenance caveats: trims, variant readings, adaptation history, inspiration for notes. */
  note?: string;
}

export interface Reflection {
  id: string;
  kind: 'quotation' | 'note';
  /** The line itself. Short — the epigraph is a rail, not a reading. */
  text: string;
  /** Rendered under the text for quotations; never present on notes. */
  attribution?: string;
  theme: ReflectionTheme;
  source: ReflectionSource;
}

export const REFLECTIONS: Reflection[] = [
  {
    id: 'b-harp',
    kind: 'quotation',
    text: 'A harp does not make music if the strings are stretched too tight or too loose. It makes music only when the strings are stretched just right.',
    attribution: 'The Teaching of Buddha (BDK) · The Way of Practice II.10',
    theme: 'effort',
    source: {
      tradition: 'buddhist',
      work: 'The Teaching of Buddha (BDK, 2005)',
      locator: 'The Way of Practice, ch. 2, §II.10, p. 170 (the Srona story)',
      license: 'quotable-with-credit',
      note: 'Lightly trimmed from the dialogue ("You know that a harp…"); wording otherwise verbatim.',
    },
  },
  {
    id: 'r-temari',
    kind: 'quotation',
    text: 'Bouncing a handball with the village children in the spring light — a day like this need never end.',
    attribution: 'Ryōkan · from his notebook Furusato, translated for this project',
    theme: 'presence',
    source: {
      tradition: 'ryokan',
      work: 'Furusato (布留散東), autograph notebook',
      locator: 'この里に手まりつきつつ子供らと遊ぶ春日は暮れずともよし',
      license: 'public-domain-original',
      note: 'High attestation (autograph). Fresh translation from the public-domain original.',
    },
  },
  {
    id: 'n-open',
    kind: 'note',
    text: 'You do not need to feel ready. Open the problem and read it; the beginning is the practice.',
    theme: 'beginning',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. Informed by the first-party Atomic Habits material: motivation follows action.',
    },
  },
  {
    id: 'b-farmer',
    kind: 'quotation',
    text: 'A farmer can not expect to see the buds today, to see the plants tomorrow, and to gather the harvest the day after.',
    attribution: 'The Teaching of Buddha (BDK) · The Way of Practice II.1',
    theme: 'effort',
    source: {
      tradition: 'buddhist',
      work: 'The Teaching of Buddha (BDK, 2005)',
      locator: 'The Way of Practice, ch. 2, §II.1, pp. 164-165',
      license: 'quotable-with-credit',
      note: '"can not" is the book\'s own spelling.',
    },
  },
  {
    id: 'r-snow',
    kind: 'quotation',
    text: 'Within the falling snow, the three thousand worlds appear — and inside them, snow falls.',
    attribution: 'Ryōkan · Hachisu no tsuyu, translated for this project',
    theme: 'impermanence',
    source: {
      tradition: 'ryokan',
      work: 'Hachisu no tsuyu (はちすの露), compiled by Teishin-ni',
      locator: 'あわ雪のなかに顕ちたる三千大千世界またその中に沫雪ぞ降る',
      license: 'public-domain-original',
      note: 'High attestation. Fresh translation from the public-domain original.',
    },
  },
  {
    id: 'n-stuck',
    kind: 'note',
    text: 'When you are stuck, find the exact sentence you do not understand. That is the work.',
    theme: 'presence',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. Turns frustration into information; no source claimed.',
    },
  },
  {
    id: 'r-rain',
    kind: 'quotation',
    text: 'If rain falls, let it fall; if the wind blows, let it blow.',
    attribution: 'Ryōkan · Hachisu no tsuyu, translated for this project',
    theme: 'sufficiency',
    source: {
      tradition: 'ryokan',
      work: 'Hachisu no tsuyu (はちすの露), compiled by Teishin-ni',
      locator: '捨てし身をいかにと問はばひさかたの雨ふらば降れ風ふかば吹け (final phrases)',
      license: 'public-domain-original',
      note: 'High attestation. The rendering carries the poem\'s closing phrases.',
    },
  },
  {
    id: 'b-archer',
    kind: 'quotation',
    text: 'When a man is practicing archery, he does not expect quick success but knows that if he practices patiently, he will become more and more accurate.',
    attribution: 'The Teaching of Buddha (BDK) · The Way of Practice II.13',
    theme: 'effort',
    source: {
      tradition: 'buddhist',
      work: 'The Teaching of Buddha (BDK, 2005)',
      locator: 'The Way of Practice, ch. 2, §II.13, p. 174',
      license: 'quotable-with-credit',
    },
  },
  {
    id: 'r-violets',
    kind: 'quotation',
    text: 'Picking violets in the spring field, I came away without my begging bowl — ah, my little bowl.',
    attribution: 'Ryōkan · translated for this project',
    theme: 'presence',
    source: {
      tradition: 'ryokan',
      work: 'Envoy to the chōka "Hachinoko"; sedōka variant in Furusato',
      locator: '春の野に菫つみつつ鉢の子を忘れてぞ来しあはれ鉢の子',
      license: 'public-domain-original',
      note: 'High attestation. Fresh translation from the public-domain original.',
    },
  },
  {
    id: 'n-flat',
    kind: 'note',
    text: 'Improvement rarely announces itself on the day it happens. Flat days still count.',
    theme: 'effort',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. States the plateau plainly without claiming research for it.',
    },
  },
  {
    id: 'r-keepsake',
    kind: 'quotation',
    text: 'What shall I leave as a keepsake? Blossoms in spring, the mountain cuckoo, maple leaves in autumn.',
    attribution: 'Ryōkan · translated for this project',
    theme: 'impermanence',
    source: {
      tradition: 'ryokan',
      work: 'Recorded in Yamamoto Yoshiyuki\'s diary Yaegiku (1831) and in autograph calligraphy',
      locator: '形見とて何か残さむ春は花山ほととぎす秋はもみぢ葉',
      license: 'public-domain-original',
      note: 'Manuscript variants exist (山/夏); this follows the autograph-calligraphy reading.',
    },
  },
  {
    id: 'n-one',
    kind: 'note',
    text: 'Not ten things. One problem, met fully, is a day\'s practice.',
    theme: 'presence',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. Informed by Ryōkan\'s documented simplicity; deliberately unattributed.',
    },
  },
  {
    id: 'b-arrowmaker',
    kind: 'quotation',
    text: 'An arrow-maker tries to make his arrows straight; so a wise man tries to keep his mind straight.',
    attribution: 'The Teaching of Buddha (BDK) · Sacred Sayings',
    theme: 'presence',
    source: {
      tradition: 'buddhist',
      work: 'The Teaching of Buddha (BDK, 2005)',
      locator: 'The Way of Practice, ch. 2, §IV ("Sacred Sayings"), pp. 184-189 (Dhammapada rendering)',
      license: 'quotable-with-credit',
    },
  },
  {
    id: 'r-hut',
    kind: 'quotation',
    text: 'Three measures of rice in my bag, a bundle of firewood by the hearth. On a rainy night in the grass hut, I stretch out both legs at ease.',
    attribution: 'Ryōkan · from his kanshi, translated for this project',
    theme: 'sufficiency',
    source: {
      tradition: 'ryokan',
      work: 'Kanshi corpus (生涯懶立身)',
      locator: '嚢中三升米 炉辺一束薪 … 夜雨草庵裡 双脚等閑伸',
      license: 'public-domain-original',
      note: 'High attestation (all collected editions). Fresh translation of four of the poem\'s lines.',
    },
  },
  {
    id: 'n-hold',
    kind: 'note',
    text: 'Give the problem your full care, and hold the outcome lightly.',
    theme: 'sufficiency',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. A secular reading of non-grasping; deliberately not attributed to any text.',
    },
  },
  {
    id: 'b-watch',
    kind: 'quotation',
    text: 'Even under the best of conditions the mind will bear watching.',
    attribution: 'The Teaching of Buddha (BDK) · The Way of Purification I.7',
    theme: 'presence',
    source: {
      tradition: 'buddhist',
      work: 'The Teaching of Buddha (BDK, 2005)',
      locator: 'The Way of Practice, ch. 1, §I.7, p. 121',
      license: 'quotable-with-credit',
      note: 'Trimmed from "It is so with the minds of people: even under…"; wording otherwise verbatim.',
    },
  },
  {
    id: 'r-maple',
    kind: 'quotation',
    text: 'Showing its underside, showing its face, a maple leaf falls.',
    attribution: 'Recited by Ryōkan at his death, after an older verse · recorded by Teishin-ni',
    theme: 'impermanence',
    source: {
      tradition: 'ryokan',
      work: 'Hachisu no tsuyu (はちすの露)',
      locator: 'うらを見せおもてを見せて散るもみぢ',
      license: 'public-domain-original',
      note: 'Teishin-ni\'s own headnote says it was not his composition; it adapts a hokku by Tani Bokuin. The attribution states this honestly.',
    },
  },
  {
    id: 'b-last',
    kind: 'quotation',
    text: 'All compounded things are subject to vanish. Strive with earnestness.',
    attribution: 'The Buddha\'s last words · Dīgha Nikāya 16, tr. Vajira & Story',
    theme: 'impermanence',
    source: {
      tradition: 'buddhist',
      work: 'Mahāparinibbāna Sutta (DN 16), §6.7',
      locator: 'accesstoinsight.org/tipitaka/dn/dn.16.1-6.vaji.html',
      license: 'free-distribution-with-credit',
      note: 'Not in the BDK anthology — cited to DN 16 directly, as the design record requires.',
    },
  },
  {
    id: 'r-alone',
    kind: 'quotation',
    text: 'It is not that I avoid the world — only that I am better at playing alone.',
    attribution: 'Ryōkan · translated for this project',
    theme: 'presence',
    source: {
      tradition: 'ryokan',
      work: 'Inscription on a self-portrait (calligraphy tradition; Yoshino critical edition)',
      locator: '世の中にまじらぬとにはあらねどもひとり遊びぞ我はまされる',
      license: 'public-domain-original',
      note: 'Medium-high attestation (autograph tradition rather than a dated manuscript).',
    },
  },
  // ——— The returning pool. Drawn only on a genuine return (≥2 days away, nothing logged today),
  // and never on ordinary days, where "a missed day" would describe a miss that did not happen.
  {
    id: 'n-return',
    kind: 'note',
    text: 'A missed day is an accident, not a verdict. The practice is the return.',
    theme: 'returning',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. Informed by the first-party "never miss twice" material, reworded plainly.',
    },
  },
  {
    id: 'n-small',
    kind: 'note',
    text: 'Come back small: one recall, one look at what is waiting. The rest can wait with it.',
    theme: 'returning',
    source: {
      tradition: 'practice',
      license: 'original',
      note: 'Original copy. Recovery shrinks the unit of work, never the cadence.',
    },
  },
];

const ROTATION = REFLECTIONS.filter((r) => r.theme !== 'returning');
const RETURNING = REFLECTIONS.filter((r) => r.theme === 'returning');

/** Deterministic date hash — consecutive dates walk the pool, so adjacent days differ. */
const hash = (iso: string): number => [...iso].reduce((a, c) => a + c.charCodeAt(0), 0);

/**
 * The one reflection for a date. Pure: same date, same line. `returning` follows the exact gate
 * Today's ReturnNotice uses; it swaps the pool, never adds a second line.
 */
export function reflectionForDate(iso: string, returning = false): Reflection {
  const pool = returning && RETURNING.length > 0 ? RETURNING : ROTATION;
  return pool[hash(iso) % pool.length]!;
}
