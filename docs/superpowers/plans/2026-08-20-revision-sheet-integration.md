# The Topic-Wise Revision Sheet — V14 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking — **tick
> them in this file as you complete them**, so a paused session resumes exactly where it stopped.

**Goal:** Integrate the user's 1,210-row topic-wise revision sheet as a *lens* over the two
existing question universes plus 159 additions — browsable, revisable on the one 1/3/7/15/30
ladder, drawable into timed sets — with roadmap problems structurally excluded from revision
draws by default.

**Architecture:** No third universe, no new store slice, no persistence change. A generated
dictionary-encoded dataset (`data-sheet` chunk) references the owning universe per row
(curriculum id / library slug / own metadata for the 159). Progress for every non-curriculum row
lives in the existing slug-keyed `contestLibrary.bySlug` register, whose validator already
accepts any non-blank slug. One scorer (extracted core of `scoreRevisionCandidates`) ranks both
contest and sheet revision. Surfaces: a second view on `/contest-practice` (NOT a 17th nav
destination — the 590px rail stays at 16 rows), a fifth `Sheet` mode on `/revision`, timed sets
through the existing `startFilteredContest` path, and `ContestDue` widened to resolve sheet
slugs.

**Tech stack:** React 18 + TS strict + RTK + Vitest; generators are plain `.mjs` under
`scripts/`; everything offline from committed snapshots.

**Spec:** the master specification (user message, 2026-08-20 session) +
`docs/superpowers/specs/2026-08-20-revision-sheet-design.md` (the lens design) +
`revision-sheet-report.md` (the measurement: 1,210 rows / 1,016 unique LC / 295 roadmap /
562 library-only / 159 new / 134 non-LC / 1 ambiguous / 0 unresolved).

---

## Progress ledger

| Task | Status |
|---|---|
| 0. Baseline + shared pattern mapper | ✅ done (baseline 1,306 green; mapper extracted; output proven byte-identical) |
| 1. Generator + dataset + npm script | ✅ done (53.5 kB; 315/587/173/134/1 rows; 159 uniques: 140 exact · 17 strong · 1 heuristic · 1 unmapped) |
| 2. Types + decoder + chunk pin + dataset tests | ✅ done (16 dataset tests; `data-sheet` pinned; = master plan T1.1) |
| 3. Validator rules (`validate:data`) | ✅ done (= master plan T1.2) |
| 4. Scorer-core extraction in `engine/contestLibrary.ts` | ✅ done (pure refactor; 65 tests unmodified; = master plan T1.3) |
| 5. `engine/revisionSheet.ts` + tests | ✅ done (13 tests incl. the structural-exclusion critical; = master plan T1.4) |
| 6. `solveSheetProblem` thunk + tests | ✅ done (= master plan T1.5, amended: `selfReported` provenance flag stamped; lenient validator; both read paths round-tripped) |
| 7. Null-rating widening (`FilteredContestProblem`) + run-page guard | ✅ done (= master plan T1.7) |
| 8. Sheet view on `/contest-practice` + tests | ✅ done (7 tests; `data-sheet` 53.9 kB, importer = ContestPracticePage only; app chunk 296.73 kB; = master plan T1.8) |
| 9. `Sheet` mode in ContestRevision + RevisionPage deep link + tests | ✅ done (frozen sheet due list; exclusion pinned in UI; deep links; standard 30 unmodified; = master plan T1.9) |
| 10. ContestDue → "Practice reviews" + tests | ✅ done (both datasets resolved; unrated stays absent; = master plan T1.10) |
| 11. Report augmentation (explicit states, contest column) | ✅ done (7-state partition sums to 1,210, script-enforced; W/B contest column; closing sections; = master plan T1.11) |
| 12. Docs (CLAUDE.md, HANDOFF, design record) + full gates | ✅ done (94 files / 1,359 green; app 296.78/301 kB; = master plan T1.12) |

**Resume procedure:** `git checkout v14-revision-sheet` → read this ledger → run
`npx vitest run --no-file-parallelism` to confirm the last committed task's state → continue at
the first unticked step of the first non-done task.

---

## Decisions log (all closed for this implementation; flag D1–D4 to the user at the end)

- **D1 — XP.** Sheet-only solves pay ordinary `SOLVE_XP[difficulty]` once, on the first solve —
  the design doc's own recommendation (§5.1), the same ruling V13 §10.2 made for library solves.
  Reviews pay `revisionXp` both ways. No day log, no daily-goal interaction, ever.
- **D2 — the 134 non-LeetCode rows.** Listed with their platform named, **nothing linked,
  nothing tracked** (design §5.2). A fabricated link is the failure this whole pipeline exists
  to avoid. Shown muted in the index.
- **D3 — "Beautiful Numbers".** Stays `AMBIGUOUS`, rendered as such with its candidates note
  (spec §3: never silently resolve). One word from the user makes it a one-line alias in
  `resolve-revision-sheet.mjs`.
- **D4 — no 17th nav destination.** 16 rows × 26px + fixed chrome ≈ 570px against the 590px
  reference; a 17th breaks it (Sidebar.tsx's own arithmetic). The sheet folds into
  `/contest-practice` as a second view (`?view=sheet`), per the design doc's first-listed
  resolution ("folding the sheet into /contest-practice… no new destination"). Nav label stays
  "Contest Library"; discovery runs through /revision's Sheet mode and the page's view chips.
- **D5 — REPORT.md.** Cannot exist: Windows FS is case-insensitive and `report.md` (the repo
  audit) already owns the name. `revision-sheet-report.md` is the audit deliverable and is
  extended (Task 11) to carry the spec's explicit row states + contest columns.
- **D6 — progress register.** `contestLibrary.bySlug` accepts sheet-only slugs today
  (validator checks non-blank string only; `loadInitialState` already spreads the channel).
  **Zero persistence changes.** CLAUDE.md must record that the register now means
  "non-curriculum problems on the one ladder", not "contest problems".
- **D7 — unrated problems stay unrated.** `SheetOnlyProblem` has **no** `contestRating` field;
  `FilteredContestProblem.contestRating` widens to `number | null`; the run page renders the
  rating line only when present. Never a zero, never an invented number.
- **D8 — Today's rail block.** `ContestDue` retitles to **"Practice reviews"** and resolves
  slugs against both datasets, because a due sheet-only review that silently never surfaces is
  a scheduled recall the learner cannot see. Same gating (`settings.contestOnToday`), same
  no-grading rule, still never in `rankWork`.
- **D9 — direct solves.** "Mark solved" exists ONLY on the sheet view and ONLY for
  non-curriculum rows (library + sheet-only kinds). Curriculum rows are reference rows: status
  shown, opened via the question sheet (`activeQuestionSet`), never mutated from here. The
  Contest Library view keeps V13's shape (solves via sittings only).
- **D10 — deep links.** `/contest-practice?view=sheet` (two-way sync like `?pattern=`);
  `/revision?mode=sheet&topic=<name>` (one-way init at mount).

## Global constraints (inherited law — every task implicitly includes these)

- ⛔ **Every join is on the slug, never a number** (frontend vs internal id trap).
- **The daily plan never sees the sheet**: nothing enters `rankWork`, `currentDay`, `DayLog`.
- **Roadmap exclusion is structural**: `selectSheetRevision` drops `kind: 'curriculum'` rows
  itself unless `includeRoadmap: true` — never a UI-only filter. Spec's critical test.
- **One scorer, one weakness model, one ladder.** Reuse `scoreRevisionCandidates`'s extracted
  core, `selectPatternWeakness` (resolved at lazy page call sites only), and
  `ladderEntry`/`ladderAfterReview` via the existing slice reducers.
- **Bundle law:** `revisionSheet.json` pins to a `data-sheet` chunk. `store/selectors.ts` and
  `store/actions.ts` never import `@/data/revisionSheet` or `@/data/contestLibrary`. Static
  importers of the sheet dataset: `ContestPracticePage` (via `SheetView`), `ContestRevision`,
  `ContestDue` — the same three lazy chunks already allowed to hold `data-contests`.
- **Any surface grading a due item freezes its own list** (membership AND order) per sitting.
- **Generated data is never hand-edited**; the generator hard-fails on identity problems.
- **Engine modules**: pure, deterministic, ISO date strings, no clock/store/React/network.
- **Tests pin the clock** (`vi.setSystemTime(new Date('2026-07-30T12:00:00'))`), use
  `renderWithStore`, stay offline. UI copy changes update tests deliberately.
- Windows: PowerShell chaining with `;`; never edit source via shell text replacement; commit
  messages via `git commit -F <file>`. Suite verification: `npx vitest run --no-file-parallelism`.
- Branch: `v14-revision-sheet` off `main` (created). Commit at the end of every task.

---

### Task 0: Baseline + shared pattern mapper — ✅ DONE

- [x] Branch `v14-revision-sheet` created off `main` (7240a10).
- [x] Baseline captured: `npx vitest run --no-file-parallelism` → **91 files / 1,306 passed**;
      (tsc/build/validate re-verified per-task from here on).
- [x] Created `scripts/lib/pattern-map.mjs` exporting `validatePatternMap(patternMap, {knownTags,
      patternIds, fail, warn})`, `makeTagResolver(patternMap)` → `(tags) => Map<pattern,
      confidence>`, and `CONFIDENCE_RANK` — the contest generator's rules verbatim.
- [x] `scripts/generate-contest-library.mjs` rewired to import them (inline copies deleted;
      `const RANK = CONFIDENCE_RANK; const resolveFromTags = makeTagResolver(patternMap);`).
- [x] Regenerated and byte-compared against `git show HEAD:src/data/contestLibrary.json`:
      **identical except `provenance.generatedAt`**; committed copy restored so the diff stays
      clean.
- [ ] Commit (folded into Task 1's commit).

---

### Task 1: Generator — `scripts/generate-revision-sheet.mjs` → `src/data/revisionSheet.json`

**Files:**
- Create: `scripts/generate-revision-sheet.mjs`
- Modify: `package.json` (scripts: add
  `"generate:revision-sheet": "node scripts/resolve-revision-sheet.mjs && node scripts/generate-revision-sheet.mjs"`)

**Interfaces:**
- Consumes: `scripts/data/revision-sheet-resolved.json` (row fields: `topic`, `sub`, `title`,
  `difficulty` ('Easy'|'Medium'|'Hard'|'Theory'|'UNKNOWN'), `status`
  ('leetcode'|'other-platform'|'ambiguous'), and for LC rows `slug`, `frontendId`,
  `officialDifficulty`, `premium`, `leetcodeTopics[]`, `inRoadmap` (question id | null),
  `contestLabel` (string | null), `note`, `platform`); `src/data/questions.json`;
  `src/data/contestLibrary.json` (membership = `problems[i][0]` slug column);
  `scripts/data/leetcode-topics.json`; `scripts/data/contest-pattern-map.json`;
  `scripts/lib/pattern-map.mjs`.
- Produces: `src/data/revisionSheet.json`:

```
{
  "_readme": "GENERATED by scripts/generate-revision-sheet.mjs — never hand-edit. …row layout…",
  "provenance": { "resolvedFrom": "scripts/data/revision-sheet.txt",
                  "metadataFetchedAt": <topics snapshot fetchedAt>, "generatedAt": ISO },
  "dictionaries": {
    "topics":    string[23],                  // sheet order
    "subtopics": [topicIdx, name][99],        // sheet order, parent by index
    "platforms": string[],
    "tags":      string[],                    // LeetCode tags used by sheet-only problems
    "patterns":  string[]                     // AICM pattern ids used by sheet-only problems
  },
  "sheetProblems": [                          // the 159, unique by slug, first-appearance order
    [slug, frontendId, title, diffCode(0|1|2), premium(0|1),
     tagIdxs[], patternIdxs[], inferredPatternIdxs[], confidenceCode(0..3)]
  ],
  "total": 1210,
  "rows": [                                   // sheet order; row[0]=subIdx, row[1]=kind
    [subIdx, 0, questionId]                   // curriculum (roadmap wins over library)
    [subIdx, 1, slug]                         // library-only
    [subIdx, 2, sheetProblemIdx]              // one of the 159
    [subIdx, 3, title, diffCode|3|null, platformIdx]   // external (3 = theory)
    [subIdx, 4, title, diffCode|null, note]   // ambiguous
  ]
}
```

**Steps:**

- [x] **1.1 Write the generator.** Logic, in order:
  1. Load sources; build `curriculumBySlug` (from `questions.json` urls — the contest
     generator's `slugOfQuestion` idiom), `librarySlugs` (Set of `contestLibrary.problems[i][0]`),
     `topicsBySlug`, pattern ids from `patterns.ts` regex (same as contest generator, expect 28).
  2. `validatePatternMap` + `makeTagResolver` from `scripts/lib/pattern-map.mjs`.
  3. Walk `resolved.sheet` in order; intern topic (23) and `(topicIdx, sub)` (99) dictionaries
     by first appearance.
  4. Per row by `status`:
     - `leetcode` + `inRoadmap` → kind 0 with `inRoadmap` id (verify the id exists in
       questions.json, else fail).
     - `leetcode` + slug ∈ `librarySlugs` → kind 1.
     - `leetcode` + neither → kind 2; intern into `sheetProblems` by slug (verify slug ∈
       topics snapshot AND catalog — closed world; resolve patterns via `resolveFromTags(tags)`
       split confident/inferred exactly like the contest generator; `confidenceCode` =
       best rank, 0 when none). Difficulty = `officialDifficulty`. Never store a rating.
     - `other-platform` → kind 3 (fail if `platform` missing/blank; diffCode: Easy/Medium/Hard →
       0/1/2, Theory → 3, UNKNOWN/absent → null).
     - `ambiguous` → kind 4 with `note` (fail if note blank).
  5. Hard-fail checks (spec §39): duplicate slug arriving at two different kinds; a kind-2 slug
     found in either universe (**the exclusion-by-construction check**); malformed slug
     (`^[a-z0-9]+(-[a-z0-9]+)*$`); non-positive `frontendId`; blank titles;
     topics ≠ 23 / subtopics ≠ 99 / rows ≠ `resolved.summary.rows` / sheetProblems ≠
     `resolved.summary.newAndUnrated`; kind-0 id not in questions.json.
  6. Print an audit report (counts per kind, per topic, mapping confidence tallies for the 159,
     encoded size), mirroring the contest generator's closing report.
- [x] **1.2 Add the npm script** (see Files above).
- [x] **1.3 Run** `node scripts/generate-revision-sheet.mjs` — expect: 1,210 rows; kinds
      295-roadmap-backed rows≥295 (row-level counts: curriculum rows 315 by topic-sum? NO —
      row-level counts are what they are; the check is `sheetProblems.length === 159` and
      unique-slug tallies match the resolver summary: curriculum 295, library 562, sheet 159
      **by unique slug**), 134 externals, 1 ambiguous; size ≲ 100 kB.
- [x] **1.4 Commit** `feat: V14 revision sheet — shared tag mapper + sheet dataset generator`
      (includes Task 0's mapper extraction).

---

### Task 2: Types + decoder + chunk pin + dataset tests

**Files:**
- Modify: `src/types/index.ts` (after the `ContestLibraryState` block, ~line 460)
- Create: `src/data/revisionSheet.ts`
- Modify: `vite.config.ts` (manualChunks: add
  `'data-sheet': ['./src/data/revisionSheet.json']` after `data-contests` with a comment noting
  the pin rule and permitted importers)
- Test: `src/data/__tests__/revisionSheet.test.ts`

**Interfaces — produces (exact types added to `src/types/index.ts`):**

```ts
/**
 * A problem the topic-wise revision sheet names that exists in NEITHER universe — one of the
 * 159 additions. Deliberately NOT a Question (no authored type/tests/minutes) and NOT a
 * ContestLibraryProblem (no contest, and no contestRating field at all: these are unrated, and
 * absence is typed rather than zeroed).
 */
export interface SheetOnlyProblem {
  slug: string;
  frontendId: number;
  title: string;
  url: string;
  officialDifficulty: Difficulty;
  premium: boolean;
  leetcodeTopics: string[];
  aicmPatterns: PatternId[];
  inferredPatterns: PatternId[];
  mappingConfidence: MappingConfidence;
}

/** One sheet row's identity — which universe owns it, or the fact that none does. */
export type SheetRowRef =
  | { kind: 'curriculum'; questionId: number }
  | { kind: 'library'; slug: string }
  | { kind: 'sheet'; problem: SheetOnlyProblem }
  | { kind: 'external'; title: string; difficulty: Difficulty | 'theory' | null; platform: string }
  | { kind: 'ambiguous'; title: string; difficulty: Difficulty | 'theory' | null; note: string };

export interface SheetRow {
  topicIndex: number;
  topic: string;
  subtopicIndex: number;
  subtopic: string;
  /** 0-based position within the sub-topic — the sheet's own teaching order. */
  order: number;
  ref: SheetRowRef;
}

export interface SheetSubtopic { index: number; name: string; rows: SheetRow[] }
export interface SheetTopic { index: number; name: string; subtopics: SheetSubtopic[] }
```

**Decoder exports (`src/data/revisionSheet.ts` — decodes ONLY its own JSON; imports no other
dataset, so it can never chain `data-curriculum`/`data-contests` into its consumers):**

```ts
export const SHEET_PROVENANCE: { resolvedFrom: string; metadataFetchedAt: string; generatedAt: string };
export const SHEET_ROWS: SheetRow[];                 // flat, sheet order
export const SHEET_TOPICS: SheetTopic[];             // 23, hierarchy
export const sheetOnlyBySlug: Map<string, SheetOnlyProblem>;  // the 159
export const SHEET_TOTAL: number;                    // rows.length
```

**Steps:**

- [x] **2.1 Write the failing tests** (`src/data/__tests__/revisionSheet.test.ts`), asserting:
  - shape: 23 topics, 99 subtopics, 1,210 flat rows, 159 sheet-only problems;
  - **membership (the spec's critical dataset tests):** every `kind:'curriculum'` questionId
    resolves in `questions.json`; every `kind:'library'` slug resolves in
    `contestProblemBySlug`; every sheet-only slug resolves in NEITHER;
  - **no fake links:** externals carry `platform` and have no slug/url anywhere in their ref;
    ambiguous likewise;
  - spot checks: Two Sum (`two-sum`, #1) is sheet-only under `2 Pointers → Two Pointer on
    Arrays`; `merge-sorted-array` is curriculum (questionId 105); "Beautiful Numbers" is
    ambiguous; "Pongal Bunk" is external platform "Codeforces";
  - dedupe integrity: a slug never appears under two different kinds;
  - order: first row of the sheet is `merge-two-2d-arrays-by-summing-values` (library).
- [x] **2.2 Run tests** — expect FAIL (module missing). *(16/16 failed as expected.)*
- [x] **2.3 Add the types, write the decoder, pin the chunk.**
- [x] **2.4 Run tests** — expect PASS. Run `npx tsc --noEmit` — clean. *(16/16 pass; tsc clean.)*
- [x] **2.5 Commit** `feat: V14 — sheet dataset decoder, types, data-sheet chunk`.

---

### Task 3: Validator rules in `scripts/validate-questions.mjs`

**Files:** Modify `scripts/validate-questions.mjs` (append a "revision sheet" section following
the file's existing fail/warn idioms; read the file first and mirror its structure).

- [x] **3.1** Add checks over `src/data/revisionSheet.json` + `questions.json` +
  `contestLibrary.json`: row/dictionary index bounds; kind codes 0–4 only; kind-0 ids exist in
  questions.json; kind-1 slugs exist in the library; **sheet-only slugs in neither universe**
  (hard fail — "a roadmap problem may never ship as a sheet addition"); slug format; positive
  frontendIds; non-blank titles/platforms/notes; no per-problem invented rating field on
  sheetProblems rows (row length exactly 9); counts (23/99/159) consistent with the file's own
  dictionaries; every pattern id in the patterns dictionary is one of the 28.
- [x] **3.2** Run `npm run validate:data` — expect OK with the new section's counts printed.
      *(OK: 315/587/173 rows, 159 additions, 134 external, 1 ambiguous.)*
- [x] **3.3 Commit** `feat: V14 — validate:data learns the sheet's invariants`.

---

### Task 4: Scorer-core extraction (`engine/contestLibrary.ts`)

**Files:** Modify `src/utils/engine/contestLibrary.ts` (the body of `scoreRevisionCandidates`,
lines ~377–449). **Acceptance: every existing test passes unmodified** — this is a pure
refactor.

**Interfaces — produces:**

```ts
/** The facts the one revision scorer needs about a candidate, universe-agnostic. */
export interface RevisionScoringFacts {
  /** Confident (exact/strong) AICM patterns. */
  patterns: PatternId[];
  /** True when the classification is a guess at best — costs a small penalty, never exclusion. */
  unmapped: boolean;
}

export function scoreRevisionFacts(
  facts: RevisionScoringFacts,
  state: ContestProblemState | undefined,
  today: string,
  weakPatterns: PatternId[],
): { score: number; reasons: string[] };
```

- [x] **4.1** Move scoring blocks 1–5 of `scoreRevisionCandidates` verbatim into
  `scoreRevisionFacts` (weakness block iterates `facts.patterns`; block 5 becomes
  `if (facts.unmapped) score -= 5`). Rewrite `scoreRevisionCandidates`'s loop as:

```ts
for (const problem of filtered) {
  const state = progress(problem.slug);
  const { score, reasons } = scoreRevisionFacts(
    { patterns: problem.aicmPatterns, unmapped: problem.mappingConfidence === 'unmapped' },
    state, today, weakPatterns,
  );
  scored.push({ problem, score, reasons });
}
```

  Sort unchanged.
- [x] **4.2** Run `npx vitest run src/utils/engine/__tests__/contestLibrary.test.ts
  src/pages/__tests__/contestPractice.test.tsx src/pages/__tests__/contestRevision.test.tsx`
  — all pass unmodified. `npx tsc --noEmit` clean. *(65/65 green.)*
- [x] **4.3 Commit** `refactor: V14 — extract scoreRevisionFacts, the one revision scorer's core`.

---

### Task 5: `src/utils/engine/revisionSheet.ts` + tests

**Files:**
- Create: `src/utils/engine/revisionSheet.ts` (pure; imports ONLY types +
  `engine/contestLibrary` helpers + `engine/spacedRepetition` constants — never a dataset)
- Test: `src/utils/engine/__tests__/revisionSheet.test.ts`

**Interfaces — produces:**

```ts
export interface SheetResolvers {
  questionById: (id: number) => Question | undefined;
  libraryBySlug: (slug: string) => ContestLibraryProblem | undefined;
  questionState: (id: number) => QuestionProgress | undefined;
  slugState: (slug: string) => ContestProblemProgress | undefined;
}

export type SheetStatus = 'untouched' | 'attempted' | 'solved' | 'due';

export interface SheetEntry {
  row: SheetRow;
  /** Dedupe/progress identity: curriculum → "q<id>", other LC rows → slug, untracked → null. */
  identity: string | null;
  title: string;
  url: string | null;
  officialDifficulty: Difficulty | 'theory' | null;
  contestRating: number | null;          // library rows only; null everywhere else
  patterns: PatternId[];                 // confident only
  unmapped: boolean;
  onRoadmap: boolean;
  questionId: number | null;
  slug: string | null;
  premium: boolean;
  platform: string | null;
  status: SheetStatus | null;            // null = untracked (external/ambiguous)
  state: ContestProblemState | undefined;
}

/** null when the ref no longer resolves (a regenerated dataset) — inert, never an error. */
export function sheetEntry(row: SheetRow, resolvers: SheetResolvers, today: string): SheetEntry | null;

export interface SheetStats {
  total: number; tracked: number; solved: number; due: number; untracked: number;
  onRoadmap: number;
}
/** Unique problems (not rows): a problem listed under two sub-topics counts once. */
export function sheetStats(rows: readonly SheetRow[], resolvers: SheetResolvers, today: string): SheetStats;

export interface SheetRevisionInput {
  rows: readonly SheetRow[];
  resolvers: SheetResolvers;
  today: string;
  /** THE exclusion rule (spec §6). Default false: roadmap problems never enter the draw. */
  includeRoadmap?: boolean;
  weakPatterns?: PatternId[];
}
export interface ScoredSheetEntry { entry: SheetEntry; score: number; reasons: string[] }
export function selectSheetRevision(input: SheetRevisionInput): ScoredSheetEntry[];
```

**Mechanics (implement exactly):**
- `sheetEntry`: per `ref.kind` —
  - `curriculum`: `q = questionById(id)`; null if absent. title/url/difficulty from `q`;
    patterns `[q.pattern]`; `unmapped: false`; state =
    `questionState(id)` mapped through `contestStateFromQuestionProgress` (imported from
    `engine/contestLibrary`); identity `` `q${id}` ``; onRoadmap true; rating null.
  - `library`: `p = libraryBySlug(slug)`; null if absent. Facts from `p`
    (rating = `p.contestRating`, patterns = `p.aicmPatterns`,
    unmapped = `p.mappingConfidence === 'unmapped'`); state = `slugState(slug)`.
  - `sheet`: facts from `ref.problem` (rating null); state = `slugState(slug)`.
  - `external` / `ambiguous`: title/difficulty/platform from ref; identity/url null;
    status null; state undefined.
  - `status` for tracked rows: solved && `nextRevision != null && nextRevision <= today` →
    `'due'`; solved → `'solved'`; `attempts > 0` → `'attempted'`; else `'untouched'`.
    (`ContestProblemProgress` satisfies `ContestProblemState` structurally.)
- `sheetStats`: dedupe by identity; `tracked` = identity !== null; `untracked` = rows with
  null identity (also deduped, by `platform|title`); count solved/due/onRoadmap over unique
  tracked entries.
- `selectSheetRevision`:
  1. rows → entries (drop nulls, drop `identity === null`);
  2. **drop `entry.onRoadmap` unless `includeRoadmap`** (the structural exclusion);
  3. dedupe by identity keeping first occurrence (sheet order);
  4. score = `scoreRevisionFacts({patterns, unmapped}, entry.state, today, weakPatterns)`;
     for an included roadmap entry, append reason `'On your roadmap'`;
  5. sort: score desc → difficulty rank asc (easy 0 / medium 1 / hard 2 / other 3) →
     `contestRating` asc with null last → identity asc. Deterministic, explainable, no RNG.

- [x] **5.1 Write the failing tests.** Fixtures: hand-build rows via small helpers
  (`row(kind, …)`), resolvers over Maps; spread `QF` from `@/test/questionFixture` for
  Question fixtures. Cases:
  - **critical:** default draw over mixed rows contains NO curriculum entry;
    `includeRoadmap: true` admits it with the `'On your roadmap'` reason;
  - external + ambiguous rows never selected, and never gain a URL;
  - dedupe: the same slug under two sub-topics scores once, first occurrence kept;
  - a due library entry outranks an unsolved one (retention over acquisition, via the core);
  - weak-pattern reason appears via `scoreRevisionFacts` when `weakPatterns` hit;
  - determinism: same input twice → identical order; unrated (null) sorts after rated within
    a difficulty;
  - `sheetEntry` returns null for a dangling questionId/slug; `sheetStats` counts uniques.
- [x] **5.2** Run — FAIL (module missing). **5.3** Implement. **5.4** Run — PASS; tsc clean.
      *(13/13 green.)*
- [x] **5.5 Commit** `feat: V14 — the sheet engine: entries, stats, exclusion-by-default draws`.

---

### Task 6: `solveSheetProblem` thunk + tests

**Files:**
- Modify: `src/store/actions.ts` (beside `reviseLibraryProblem`, ~line 995)
- Test: extend the store test file that covers `reviseLibraryProblem`
  (locate via `grep -rln reviseLibraryProblem src/store/__tests__ src/**/__tests__`).

**Produces:**

```ts
/**
 * A solve recorded from the revision sheet — the sheet's one direct write (V14).
 *
 * Non-curriculum rows only: a roadmap question is solved through its own surfaces, never from
 * here. The record enters the slug-keyed register (the same one contest-library solves use —
 * one ladder, one register for everything non-curriculum) and pays the ordinary SOLVE_XP once,
 * on the first solve, exactly the §10.2 ruling. No day log and no daily-goal interaction:
 * `DayLog` is the curriculum's ledger and the plan's finishability caps are calibrated to it.
 * Idempotent on re-solve: another attempt is recorded, the ladder and `solvedOn` never reset,
 * and no XP is paid twice.
 */
export const solveSheetProblem =
  (slug: string, difficulty: Difficulty): AppThunk =>
  (dispatch, getState) => {
    if (typeof slug !== 'string' || slug.trim() === '') return;
    const already = getState().contestLibrary.bySlug[slug]?.solved === true;
    dispatch(libraryProblemSolved({ slug, date: todayISO() }));
    if (!already) dispatch(xpAdded(SOLVE_XP[difficulty]));
  };
```

- [x] **6.1** Failing tests: first solve → register entry solved, ladder entered
  (`revisionStage 0`? — `ladderEntry` sets stage/nextRevision; assert `nextRevision` is
  tomorrow+? use the register's own invariants: `solved: true`, `nextRevision !== null`), XP
  +SOLVE_XP; second call → attempts 2, `solvedOn` unchanged, XP unchanged; blank slug → no-op;
  `dayLogs` untouched; then `reviseLibraryProblem` on that slug works (grades pass).
  *(Plus the A5.1 amendment's provenance tests: stamp/never-stamp, upgrade-never-downgrade,
  both-read-paths round-trip, pre-V15 fixture, lenient false, corrupt non-boolean.)*
- [x] **6.2** Run — FAIL. **6.3** Implement. **6.4** Run — PASS. *(27/27 slice tests; 139 with storage suites; tsc clean.)*
- [x] **6.5 Commit** `feat: V14 — solveSheetProblem, the sheet's one direct write`.

---

### Task 7: Null-rating widening

**Files:**
- Modify: `src/store/slices/contestSlice.ts` — `FilteredContestProblem.contestRating: number`
  → `number | null` (comment: "Null for sheet-only rows — unrated, and never zeroed.")
- Modify: `src/pages/ContestPage.tsx` (~line 323) — render the rating item only when
  `libraryRow.contestRating !== null` (read the surrounding `Meta`/JSX first; keep the
  official-difficulty item unconditional).
- Test: extend `src/pages/__tests__/contest.test.tsx` (or wherever filtered-sitting rows are
  fixtured — locate via `grep -rln FilteredContestProblem src/pages/__tests__`): a sitting row
  with `contestRating: null` renders its title and difficulty and does NOT render
  `Contest rating`.

- [x] **7.1** Failing test → **7.2** widen + guard → **7.3** suite green
  (`contest*.test` files + tsc). Existing fixtures stay valid (number satisfies the union).
  *(35/35 across the three contest suites; tsc clean.)*
- [x] **7.4 Commit** `feat: V14 — a sitting row may be honestly unrated`.

---

### Task 8: The sheet view on `/contest-practice`

**Files:**
- Create: `src/components/sheet/SheetView.tsx` (statically imported by the page — same chunk)
- Modify: `src/pages/ContestPracticePage.tsx`
- Test: extend `src/pages/__tests__/contestPractice.test.tsx`

**Page changes (`ContestPracticePage.tsx`):**
- `view` state from `?view` (`'library' | 'sheet'`, default library), two-way synced like
  `?pattern=` (`syncViewParam`); view chips under the header via `ChipRadioRow`
  (`label="Library view"`, options `['library','sheet']`, format → `'Contest problems'` /
  `'Revision sheet'`).
- Header per view: library view unchanged; sheet view:
  eyebrow `${SHEET_TOTAL} rows · ${SHEET_TOPICS.length} topics`, title `Revision Sheet`,
  support `"Your topic-wise sheet as a lens over the problems this app already tracks — browse
  by topic, mark what you've solved, and start timed sets from a sub-topic."`, header action:
  none (the weak-areas/start buttons belong to the library view only).
- Body: `view === 'sheet' ? <SheetView contestRunning={contestRunning} /> : (existing Panel)`.

**`SheetView` component (full behavior):**
- Imports: `SHEET_TOPICS`, `SHEET_TOTAL`, from `@/data/revisionSheet`; `contestProblemBySlug`
  from `@/data/contestLibrary`; `selectQuestionById` from `@/store/selectors`;
  `sheetEntry, sheetStats` from `@/utils/engine/revisionSheet`;
  `CONTEST_TARGET_MINUTES, CONTEST_RATING_NOTE` from `@/utils/engine/contestLibrary`;
  `selectContestSet` from `@/utils/engine/contest`; `solveSheetProblem, startFilteredContest`
  from `@/store/actions`; `activeQuestionSet` from `@/store/slices/uiSlice`; Page primitives;
  `DifficultyBadge`, `PatternChip`; `useToday`; `useNavigate`.
- Resolvers (memoized on `progressById`, `contestBySlug`):
  `{ questionById: selectQuestionById, libraryBySlug: (s) => contestProblemBySlug.get(s),
     questionState: (id) => progressById[id], slugState: (s) => contestBySlug[s] }`.
- State: `includeRoadmap` (false; an `aria-pressed` chip labeled
  `Include problems already on my roadmap`), `openTopic` (topic index | null).
- Layout (composition contract — open sections, RuledLists, no plates):
  1. A `Meta`/stats line from `sheetStats(SHEET_ROWS…)`: `X of Y solved · Z due · N not on
     LeetCode` + the include-roadmap chip.
  2. `RuledList` of topics: each topic a `details` row (the ProblemRow disclosure idiom) whose
     summary shows name + per-topic figures (`solved/total` + due count via `sheetStats` of the
     topic's rows); expanded → per sub-topic `Section`-like blocks: sub-topic name, "Start
     timed set" button, then the rows.
  3. A row (per `sheetEntry`): order number, frontendId (hidden below `sm`), title, difficulty
     badge (`variant="bare"`), rating figure when non-null, status column (Due/Solved/Attempted
     with the library page's colors), `On roadmap` marker for curriculum rows, muted
     platform-named line for externals (`not on LeetCode · GeeksforGeeks`), the ambiguous row's
     note in its detail. Row detail (`details`): meta + actions —
     - curriculum: button `View in curriculum` → `dispatch(activeQuestionSet(questionId))`;
     - library/sheet kinds: `Open on LeetCode →` link + `Mark solved` button
       (`dispatch(solveSheetProblem(slug, officialDifficulty))`), which flips to a
       `Solved · next review <date>` line when solved (no un-solve);
     - external/ambiguous: no actions, muted.
- Timed set per sub-topic (`startTimedSet(topic, sub)`):
  - eligible entries = sub-topic rows → `sheetEntry`, identity non-null, not solved,
    `(includeRoadmap || !onRoadmap)`;
  - candidates: `{ key: identity, difficulty: officialDifficulty as Difficulty, patterns,
    targetMinutes: questionId ? question.estimatedTime : CONTEST_TARGET_MINUTES[difficulty],
    contestRating, contestSlug: libraryBySlug(slug)?.contest.slug ?? null }`;
  - `selectContestSet(candidates, { count: 4, distinctPatterns: false, distinctContests: true },
    seed)` with seed `` `${today}|sheet|${topic}|${sub}|${includeRoadmap}` `` —
    `distinctPatterns: false` because a sub-topic IS one theme (the weak-areas precedent);
  - rows: curriculum → `{ id: questionId, kind: 'curriculum', … }`; others →
    `{ id: -(i+1), kind: 'library', … }` (the negative-id rule), `contestRating` may be null,
    `contestLabel` from the library problem or null, `reasons: [` `From the sheet: ${topic} →
    ${sub}` `, difficulty/rating fact, status fact]`;
  - `dispatch(startFilteredContest(rows, seed)); navigate('/contest');` — button disabled while
    `contestRunning` or eligible pool empty, with the library page's `title` wording.

**Tests (extend `contestPractice.test.tsx`; fake timers pinned as the file already does):**
- [x] **8.1** Failing tests:
  - `?view=sheet` renders the Revision Sheet header + topic list; chips switch views and the
    URL param follows;
  - expanding `2 Pointers` shows `Two Pointer on Arrays` with Two Sum row; its detail offers
    `Mark solved`; clicking dispatches → store's `contestLibrary.bySlug['two-sum'].solved` true
    and XP rises by 10 (easy); clicking again does not double-pay;
  - a curriculum row (`Merge Sorted Array`) shows `On roadmap` and offers `View in curriculum`,
    never `Mark solved`;
  - an external row names its platform and has no link;
  - **timed set:** with a seeded store, `Start timed set` on a sub-topic populates
    `state.contest.libraryProblems` with ≤4 rows, none of which is a curriculum row while the
    include toggle is off (**the UI-level exclusion test**); with the toggle on, curriculum
    rows may appear with positive ids;
  - the sheet view never renders while `view` is default.
- [x] **8.2** Run — FAIL. **8.3** Implement component + page wiring. **8.4** PASS + tsc.
      *(24/24 in the page suite.)*
- [x] **8.5** `npm run build` — verify `data-sheet` chunk emitted; app chunk unchanged
  (~296 kB); `grep -l 'from"./contestLibrary-' dist/assets/*.js` still names only the three
  permitted chunk files (SheetView folds into ContestPracticePage's).
  *(data-sheet 53.91 kB; app 296.73 kB (+0.64 from thunk+validator, budget 301); contestLibrary
  importers exactly the three; data-sheet importer = ContestPracticePage only.)*
- [x] **8.6 Commit** `feat: V14 — the sheet as a second view on /contest-practice`.

---

### Task 9: `Sheet` mode in ContestRevision + RevisionPage deep link

**Files:**
- Modify: `src/components/revision/ContestRevision.tsx`
- Modify: `src/pages/RevisionPage.tsx`
- Test: extend `src/pages/__tests__/contestRevision.test.tsx`

**RevisionPage:** `MODES` gains `'sheet'`; `MODE_LABEL.sheet = 'Sheet'`;
`ContestRevisionMode` union (exported from ContestRevision) gains `'sheet'`. Initial mode/topic
from URL (one-way, at mount):

```ts
const [searchParams] = useSearchParams();
const urlMode = searchParams.get('mode');
const [mode, setMode] = useState<RevisionMode>(
  urlMode !== null && (MODES as string[]).includes(urlMode) ? (urlMode as RevisionMode) : 'standard',
);
```

and pass `initialTopic={searchParams.get('topic') ?? undefined}` to `<ContestRevision>`.

**ContestRevision:** props `{ mode, initialTopic }`. For `mode === 'sheet'`:
- new state `topic: string` (initial: `initialTopic` if it names a `SHEET_TOPICS` entry, else
  `''` = all topics) via a `Select` listing topic names; `includeRoadmap` chip (default false,
  same wording as the sheet view).
- pool: `topic === '' ? SHEET_ROWS : SHEET_TOPICS[i].subtopics.flatMap(s => s.rows)`;
  ranked = `selectSheetRevision({ rows, resolvers, today, includeRoadmap, weakPatterns })`
  (resolvers as in SheetView; `weakPatterns` from the existing selector).
- split: due = ranked where `entry.status === 'due'`; practice = next `PRACTICE_SHOWN` others.
- **freeze**: `frozenKey = \`${today}|sheet|${topic}|${includeRoadmap}\`` holding identities —
  the same mechanism the contest modes use (extend the existing `frozenDue` state usage or add
  a parallel one for sheet identities; membership AND order).
- rows: a sheet-flavored candidate row (title, difficulty badge, rating+note only when
  non-null, `On your roadmap` marker, `topic → subtopic` meta, scorer reasons verbatim, next
  review line) with the same grade buttons;
- grading: `entry.questionId !== null` → `reviseQuestion(questionId, passed)`; else
  `reviseLibraryProblem(slug, officialDifficulty as Difficulty, passed)`; graded-today read
  from whichever register owns the record (the `gradedTodayFor` logic keyed off
  questionId/slug);
- unsolved rows in the practice list show no grade buttons (nothing to grade) — the row's
  link opens LeetCode; the rail is unchanged.
- link `Browse the full sheet →` → `/contest-practice?view=sheet`.

**Tests:**
- [x] **9.1** Failing tests: the `Sheet` chip renders the mode; a due sheet-only record (seeded
  register) appears under Due now and grading it moves the ladder (register's `nextRevision`
  changes) while THE ROW STAYS (frozen list); **a curriculum question due today does NOT appear
  in sheet mode by default** and DOES appear with the toggle on (graded through
  `reviseQuestion`); `?mode=sheet` deep link lands on the mode; `?topic=Binary Search` scopes
  it.
- [x] **9.2** FAIL → **9.3** implement → **9.4** PASS + tsc. *(15/15 contestRevision;
  30/30 standard revision unmodified; tsc clean.)*
- [x] **9.5 Commit** `feat: V14 — Sheet mode on /revision, frozen and exclusion-correct`.

---

### Task 10: ContestDue → "Practice reviews"

**Files:**
- Modify: `src/components/today/ContestDue.tsx`
- Test: locate the ContestDue assertions (`grep -rln "Contest reviews" src`) and update.

- [x] **10.1** Failing test: a due sheet-only slug (seeded register + a slug in
  `sheetOnlyBySlug`) renders its title/difficulty with no rating; block titled
  `Practice reviews`.
- [x] **10.2** Implement: resolve each slug via `contestProblemBySlug` then `sheetOnlyBySlug`
  into a unified `{slug,title,url,officialDifficulty,contestRating:number|null,label:string|null}`;
  unknown slugs stay inert. Copy: title `Practice reviews`, support
  `From your practice pools — separate from the day's plan.`; link text
  `Review these and N more →` / `Review it in Revision →` (adjusted from "Contest Revision").
- [x] **10.3** Update the existing copy assertions deliberately; suite green. *(26/26 today
  suite; tsc clean. The Settings toggle keeps its `contestOnToday` key and label — recorded as
  a naming limitation for the report/docs tasks.)*
- [x] **10.4 Commit** `feat: V14 — Today's rail block covers both practice pools`.

---### Task 11: Report augmentation + regeneration

**Files:** Modify `scripts/report-revision-sheet.mjs`; regenerate `revision-sheet-report.md`.

- [x] **11.1** Add, after "The headline": **"Every row's explicit state"** — the master spec §1
  state table computed from resolved data (row counts AND unique-problem counts):
  `ROADMAP_ALREADY_EXISTS`, `CONTEST_LIBRARY_ALREADY_EXISTS`, `REVISION_ONLY_NEW`,
  `NON_LEETCODE_EXTERNAL`, `AMBIGUOUS`, `UNRESOLVED` (0), `DUPLICATE` (rows repeating an
  earlier row's identity). Nothing disappears silently — the counts must sum to 1,210.
  *(295/562/159/133/1/0/60 = 1,210; the script throws if the partition breaks.)*
- [x] **11.2** Add a compact `Contest` column (e.g. `W333 · Q1`) to every per-subtopic table,
  from the resolved `contestLabel`.
- [x] **11.3** Append short closing sections: **Data model** (the row-reference design, three
  kinds, where progress lives), **Validation** (what `validate:data` now enforces),
  **Known limitations** (premium rows; ambiguous row pending the user; ContestDue naming),
  **Next steps** — each a few sentences pointing at the design doc and this plan.
- [x] **11.4** `npm run report:revision-sheet` — regenerated cleanly; diff reviewed.
- [x] **11.5 Commit** `docs: V14 — the report carries the spec's explicit row states`.

---

### Task 12: Documentation + full gates + wrap

**Files:** `CLAUDE.md`, `HANDOFF.md`,
`docs/superpowers/specs/2026-08-20-revision-sheet-design.md`, this plan's ledger.

- [x] **12.1** CLAUDE.md: extend the contest-library section with a **revision sheet**
  subsection: the lens architecture; `data-sheet` chunk + its three permitted importers; the
  slug register's widened meaning ("non-curriculum problems on the one ladder" — record it,
  rename nothing); the structural exclusion rule + where it lives
  (`selectSheetRevision`); `solveSheetProblem`'s scope; D4's no-17th-destination resolution;
  the `?view=`/`?mode=` deep links; "Practice reviews" naming. *(Plus the top resume note.)*
- [x] **12.2** Design record: status flip to implemented; log D1–D10 with rationale (§8);
  note the §5 open questions' adopted recommendations awaiting user confirmation.
- [x] **12.3** HANDOFF.md: rewritten as the V15 Phase 1 resume point (state, gates, decisions,
  what to watch, the user-confirmation items; resume at Phase 2 T2.1).
- [x] **12.4** Full gates: `npx tsc --noEmit` clean · `npx vitest run --no-file-parallelism`
  **94 files / 1,359 green** · `npm run build` app chunk **296.78 kB** (301 budget),
  `data-sheet` 53.91 kB, `data-contests` unchanged; importer greps: `contestLibrary-*` ←
  exactly the three permitted chunks; `data-sheet` ← the shared decoder chunk alone ·
  `npm run validate:data` OK.
- [x] **12.5** Ledger ticked; committed per-task throughout (T1.1–T1.13); D1–D3 confirmation
  asks summarized to the user in the session wrap.

---

## Self-review (writing-plans checklist)

- **Spec coverage:** §0/§6/§36 (roadmap primacy + exclusion) → Tasks 1 (by construction),
  5 (engine default), 8/9 (UI + tests). §1 (explicit states) → Task 11. §2/§55 (report) →
  done pre-plan + Task 11; REPORT.md naming → D5. §3/§39/§40 (closed world, validation,
  non-LC) → Tasks 1–3. §5/§42 (universe metadata, provenance kept) → Tasks 1–2. §8–§9/§21/§50
  (contextual, reasoned, ranked, explainable) → Tasks 4–5 (one scorer, reasons verbatim).
  §13 modes: due/pattern/contest/weakness existed (V13); sheet-topic revision → Task 9;
  timed sub-topic sets → Task 8. §15–§16 (targeted vs pure Full Contest) → untouched, Full
  Contest locked. §17 (rating naming) → D7 + existing `CONTEST_RATING_NOTE`. §19–§20 (mastery/
  weakness reuse) → no new models; stall evidence flows through the existing channel
  (patterns on sitting rows). §24–§25 (hidden pattern/interview) → V8's interview mode and
  Full Contest already carry this; sheet adds nothing that leaks into them. §48 (no flooding)
  → nothing enters Today/rankWork; ContestDue stays 3 titles + link. §51–§53 (determinism,
  tests, regression) → per-task gates + Task 12.4.
- **Placeholders:** none — every step names exact files, signatures, behaviors; component
  steps enumerate concrete UI structure and exact copy where tests will assert it.
- **Type consistency:** `SheetRow`/`SheetRowRef`/`SheetOnlyProblem` (Task 2) are what Tasks
  5/8/9/10 consume; `scoreRevisionFacts` (Task 4) is what Task 5 calls;
  `solveSheetProblem(slug, difficulty)` (Task 6) is what Task 8 dispatches;
  `contestRating: number | null` (Task 7) is what Task 8's rows produce. Names checked.
