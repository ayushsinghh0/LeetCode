# Contest Intelligence & Contest Revision — V13 design record (2026-08-19)

**STATUS: PLAN ONLY — no code written.** Produced under the V13 directive's §65 ("inspect first,
produce an implementation plan, do not immediately edit code"). §0 is the measured baseline, §2
records five blockers the inspection found that the directive could not have known about, and §10
lists the decisions that need a human call before slice 1 starts.

The directive's own §64 is the acceptance test for this plan: the deliverable is **not** "a page
containing 2,500 LeetCode questions" — it is a system that answers *which contest problem should I
practice next*. Everything below is arranged so the intelligence layer is the product and the
dataset is plumbing.

---

## 0. Verified baseline (2026-08-19, `main` @ 43eecf4)

Measured for this record, not read from a doc:

- **1176/1176 tests across 83 files**, exit 0 on a clean run. `npx tsc --noEmit` clean.
  `npm run build` clean. `npm run validate:data` OK.
- **App chunk 280.77 kB against the 301 kB budget** — 20.23 kB of headroom.
  `data-curriculum` 386.47 kB, `data-ml` 275.12 kB, `AnalyticsPage` 435.49 kB.
- Dataset: 539 questions / 28 patterns / 103 families / 108 sub-pattern groups / **528 with a
  verified LeetCode identity**, 61 premium, 11 declared not-on-LeetCode.
- Contest machinery already shipped: `engine/contest.ts` (385 lines), `contestSlice` (live,
  unpersisted), `contestsSlice` (derived, persisted), `ContestPage` (518 lines), and
  `weakness.ts`'s `contest` signal at weight **0.08**.

### What is directly reusable (the directive's §65 inventory)

| Existing asset | Reuse |
|---|---|
| `engine/spacedRepetition.ts` — `ladderEntry` / `ladderAfterReview` / `isLadderDue` | **Verbatim.** Contest Revision gets the same 1/3/7/15/30 ladder in a second register. No new scheduler. |
| `engine/contest.ts` `buildContest({ all, byId, seed, shape })` | **`all` is already the pool parameter.** Generalising it (§5.1) is a type change, not a rewrite. |
| `engine/prng.ts` `hashSeed`/`mulberry32` | Verbatim — seeded determinism for filtered contests. |
| `contestSlice` (live sitting, **unpersisted**) | Widen its key type. Zero migration cost — see §3.5. |
| `contestsSlice` + `analyzeContest` → `stalledPatterns` | The single channel contest evidence uses to reach weakness. **No second weakness model** (§6.3). |
| `ChipRadioRow`, `QuestionFilterRow`, `Page.tsx` primitives (`RuledList`, `Meta`, `Ledger`, `Disclosure`, `Section`) | The whole Contest Library UI. No new visual language (directive §53). |
| `scripts/fetch-leetcode-catalog.mjs`, `generate-questions.mjs`, `validate-questions.mjs` | The pipeline shape, the closed-world discipline, and the three-valued live-audit pattern. |
| `mlTrackIndex.ts` + `analyticsSelectors.ts` | The two precedents that keep a large dataset off the app chunk. Both apply here. |

---

## 1. Locked constraints that shape V13 (do not re-litigate)

- **The 539 are untouched** (directive §60). `questions.json` is generated under a closed-world
  rule and its intelligence file's key set must be *exactly* the SECTIONS titles — so a contest
  problem cannot become a `Question` without authoring `type` and `tests` for it. This is not a
  preference; it is a build failure.
- **The daily plan must stay finishable** (CLAUDE.md). `currentDay` derives from solved count and
  `selectRankedWork` caps new work. 2,561 problems must never enter that plan. The Contest Library
  is a **pool you draw from**, never a second roadmap.
- **One prioritizer, one weakness model, one ladder, one time budget.**
- **Full Contest is locked spec** (PRODUCT.md:46): easy/medium/medium/hard, distinct patterns,
  unsolved only, date-seeded, live slice never persisted, conservative reading, no score/rank/
  percentile. V13 adds modes *around* it and must leave it byte-identical.
- **No runtime network** (directive §34) — already the architecture; all ingestion is
  engineering-time and committed.
- **Sourced or silent.** Every external claim needs a way to be re-checked (`audit:links`,
  `audit:companies` are the two precedents). ZeroTrac gets a third.

---

## 2. Five blockers the inspection found

These are the reason this is a plan and not a patch.

### 2.1 ⛔ The committed catalog's `id` is LeetCode's INTERNAL id, not the frontend id

`scripts/fetch-leetcode-catalog.mjs` maps `p.stat.question_id` — the internal id — into
`leetcode-catalog.json`. ZeroTrac's `ID` column is the **frontend** id. They diverge, and the
divergence is silent and wrong:

| ZeroTrac ID | ZeroTrac title | Catalog record at that `id` |
|---|---|---|
| 4017 | Peaks in Array II | **"Filter Characters by Frequency"** ❌ |
| 3285 | Find Indices of Stable Mountains | **"Manager of the Largest Department"** ❌ |
| 2561 | Rearranging Fruits | **"Number of Distinct Averages"** ❌ |
| 746 | Min Cost Climbing Stairs | **"Prefix and Suffix Search"** ❌ |

Slug lookup is correct in every case (`peaks-in-array-ii` → catalog id 4336). Catalog max id is
**4371** against a max frontend id near 4017, which is the tell.

**Consequence:** a numeric-ID join between ZeroTrac and this repo produces *wrong problems, with
no error*. **Identity is the slug, everywhere, full stop.** Numeric ids are display-only.

**Secondary finding (pre-existing, out of V13 scope but worth a decision):** every
`Question.leetcodeId` in `questions.json` is therefore the internal id, not the number LeetCode
shows the user. URLs are built from slugs so all 528 links are correct; only the displayed numeral
can differ. Directive §7 asks for `questionFrontendId`. Fixing it means extending the catalog
fetcher with `frontend_question_id` and regenerating — one line plus a regeneration, but it
touches the locked dataset, so it is listed in §10 rather than assumed.

### 2.2 ⛔ `selectContestProblems` can only resolve the 539

`selectors.ts:826` resolves the live contest's ids through `questionById` — a `Map` built over
`questions.json` alone (`selectors.ts:84`). Its `flatMap` returns `[]` for an unknown id, so a
contest-library problem pushed through today's contest slice would **silently disappear from the
UI** rather than error. This is the single most important integration point in the feature.

### 2.3 ⛔ Numeric id-space collision

`contestSlice.questionIds: number[]` and `attempts: Record<number, …>` share a key space with
`progress.byId`, which is keyed by roadmap ids **1–539**. LeetCode frontend ids run **1–4017**.
Direct overlap. Solving contest problem 47 would corrupt roadmap question 47.

### 2.4 ⛔ The catalog carries no topic tags

`leetcode-catalog.json` fields are exactly `{ id, title, slug, difficulty, paid }`.
`/api/problems/all/` does not serve tags. Topics require a **new GraphQL fetch**
(`problemsetQuestionList` → `topicTags { name slug }`), which is the one genuinely new network
surface in this feature.

### 2.5 ⚠️ Bundle headroom is 20.23 kB and the dataset is bigger than the curriculum

2,561 records carrying slug, title, rating, contest, index, difficulty, topics and mapped patterns
estimate to **~700 kB raw JSON**, i.e. larger than `data-curriculum` (386 kB). It cannot touch the
app chunk. See §3.6 for the encoding decision.

---

## 3. Architectural decisions

### 3.1 A contest problem is NOT a `Question`

New type `ContestProblem` in `src/types/index.ts`, keyed by `slug`. Three forcing reasons:

1. `Question` requires authored `type` and `tests`; the generator's exact-key-set rule makes
   authoring 2,561 of them the only legal way to reuse it.
2. `Question.pattern` is a single `PatternId`; the directive's §7 requires `aicmPatterns: string[]`.
3. The 539 are a *curated curriculum*; the library is a *pool*. Directive §6 requires the two
   universes stay conceptually distinct, and one type for both is how that distinction rots.

```ts
export interface ContestProblem {
  slug: string;                    // PRIMARY KEY (§2.1)
  frontendId: number;              // display only — LeetCode's visible number
  title: string;
  url: string;                     // built from the slug, never from the title
  officialDifficulty: Difficulty | null;
  contestRating: number | null;    // ZeroTrac. NEVER `officialRating`.
  contest: {
    slug: string;                  // "weekly-contest-514"
    number: number | null;
    type: 'weekly' | 'biweekly' | 'unknown';
    index: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  };
  leetcodeTopics: string[];        // LeetCode's own taxonomy, kept verbatim
  aicmPatterns: PatternId[];       // mapped — may be empty
  aicmSubpatterns: string[];       // mapped — may be empty
  mappingConfidence: 'exact' | 'strong' | 'heuristic' | 'unmapped';
  premium: boolean;
  curriculumQuestionId: number | null;  // the identity bridge (§5 of the directive)
}
```

`curriculumQuestionId !== null` **is** `isCurriculumQuestion` — one field, not two that can
disagree.

### 3.2 Learner state lives in a new slice keyed by slug

`contestLibrarySlice`, persisted, sparse, `Record<string, ContestProblemProgress>`:

```ts
interface ContestProblemProgress {
  status: 'unsolved' | 'solved' | 'attempted';
  solvedOn: string | null;
  lastAttemptedOn: string | null;
  attempts: number;
  // The SAME ladder, second register — engine/spacedRepetition.ts unchanged.
  revisionStage: number;
  nextRevision: string | null;
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
}
```

This is exactly the `ml` vs `course` precedent already stated in `store.ts`: *"a separate id space
from `course`… deliberately not the same slice."* It resolves §2.3 completely and satisfies
directive §20 (the existing ladder is untouched — it is *reused*, not modified).

**Curriculum problems keep using `progress.byId`.** When a contest-library problem has a
`curriculumQuestionId`, its progress is *read through* to the roadmap record, never duplicated
(directive §39). One problem, one truth.

### 3.3 Generalize `buildContest`, do not fork it

`engine/contest.ts` gains a structural candidate type and the existing entry point becomes a thin
adapter:

```ts
export interface ContestCandidate {
  key: string;                 // "q:137" for curriculum, slug for library
  difficulty: Difficulty | null;
  patterns: PatternId[];
  contestRating: number | null;
  contestSlug: string | null;
  index: string | null;
  targetMinutes: number;
  solved: boolean;
  lastSolvedOn: string | null;
}

export interface ContestPlan {
  shape?: Difficulty[];        // Full Contest: the locked easy/medium/medium/hard
  ratingBand?: [number, number];
  count?: number;
  diversity?: { distinctPatterns: boolean; distinctContests: boolean };
  recencyWindowDays?: number;
}

export function buildContestFrom(pool: ContestCandidate[], plan: ContestPlan, seed: string): Contest;
```

`buildContest(input)` keeps its exact signature, maps the 539 into candidates, and calls through
with `{ shape: CONTEST_SHAPE, diversity: { distinctPatterns: true } }`. **Acceptance test: the
existing contest tests (21 engine + 14 page + `contestStalls`) pass unmodified**, which is what
"Full Contest remains unchanged" (§44) means operationally.

### 3.4 Rating is a second axis, never a replacement for difficulty

`ratingBand()` lives in a reusable engine util (directive §12), bands are data not literals in
JSX, and every surface shows both signals as separate facts (directive §13):

```
Medium · Contest rating 1648 · Weekly 462 · Q3
```

Tooltip copy, verbatim, from directive §33:
> Estimated contest difficulty from ZeroTrac. Useful for relative comparison; not an official
> LeetCode rating.

**No user-rating claim, ever** (directive §31). Post-session copy is band language about the
*problems*: "You solved problems in the 1600–1700 contest-rating band," never "your rating is."
This is the same rule that already governs company claims and interview self-assessment.

### 3.5 Widening the live slice costs nothing, because it is not persisted

`contestSlice` keys become `string` (`"q:<id>"` for curriculum, the bare slug for library). Because
the slice is deliberately unpersisted, **there is no payload migration and no quarantine risk** —
the single most expensive class of change in this repo simply does not apply here.

`contestsSlice` *is* persisted, so it takes the standard optional-with-boundary-default treatment:
`ContestProblemRecord` gains `slug?: string` beside the existing `questionId: number`, validated as
a bare string (the `missKind` precedent), so an older payload keeps validating and a renamed
problem can never quarantine a learner's state.

### 3.6 Bundle: measure, then dictionary-encode if needed

- New pinned chunk `data-contests` in `vite.config.ts` `manualChunks`. **Non-negotiable** — left
  unlisted it lands in the app chunk with no error, only a bigger bundle.
- `src/data/contestLibraryIndex.ts` restates only what the *store* needs (slug list, and slug →
  pattern ids), test-pinned against the dataset — the `mlTrackIndex.ts` precedent. `selectors.ts`
  and `actions.ts` must never import the full dataset.
- **Due counts are computable without the dataset**, because `nextRevision` dates live in the
  slice. So "8 contest problems due" renders eagerly; *which* problems requires the lazy route.
  That single property keeps ~700 kB off every session that never opens Contest Practice.
- If the generated JSON exceeds ~300 kB, apply dictionary encoding (topics, contest slugs and
  patterns are massively repetitive; parallel arrays + a string table should cut it ~60%), with a
  tiny decode step in `src/data/contestLibrary.ts`. Decide by measurement in slice 1, not now.

---

## 4. The data pipeline (directive §34–§38)

```
scripts/fetch-zerotrac-ratings.mjs   → scripts/data/zerotrac-ratings.json   (network, snapshot, dated)
scripts/fetch-leetcode-catalog.mjs   → EXTEND: add frontendId + topicTags   (network, GraphQL)
scripts/data/contest-pattern-map.json → hand-verified, auditable topic→pattern table
scripts/generate-contest-library.mjs → src/data/contestLibrary.json          (offline, closed-world)
npm run validate:data                → EXTEND with the contest checks below
npm run audit:ratings                → LIVE re-check vs ZeroTrac, three-valued PASS/FAIL/UNVERIFIABLE
```

**Join order:** ZeroTrac slug → catalog slug → (difficulty, premium, frontendId) → GraphQL slug →
topics → mapping table → patterns. **Every join is on the slug.** A ZeroTrac slug absent from the
catalog is a hard failure, not a silent drop (directive §37).

### Validation — fail the build on

duplicate slugs · duplicate (contest, index) pairs · malformed slug · missing title · rating
outside 800–4000 · index outside Q1–Q4 · contest type not in {weekly, biweekly, unknown} · a
`PatternId` not in `PATTERNS` · a `curriculumQuestionId` not in `questions.json` · a URL not
derived from its own slug · **any mutation of an existing curriculum identity**.

### Warn (never fail) on

missing rating (newest contests are unrated for weeks) · missing topics · `mappingConfidence:
'unmapped'` · premium problems.

### Audit report (directive §37)

```
Contest ingestion complete   (zerotrac @ <sha>, leetcode @ <fetchedAt>)

Problems discovered:      2,561
Rating records:           2,561
Catalog matched by slug:  2,5XX      unmatched: 0
Topic metadata matched:   2,5XX
AICM mapping:  exact XXX · strong XXX · heuristic XXX · unmapped XXX
Curriculum overlap:  existing XXX · contest-only X,XXX
Invalid records: 0
```

### Provenance (directive §38)

`{ generatedAt, zerotracCommit, catalogFetchedAt, mappingVersion }` at the dataset root — for
maintainability and `audit:ratings`, not for the UI.

---

## 5. The mapping layer (directive §9, §10, §58) — the real cost of this feature

LeetCode's ~70 tags are a *different classification system* from the 28 AICM patterns, and some
tags are near-useless ("Array" appears on well over a thousand problems). The table therefore
needs three things:

1. **Explicit entries**, hand-verified, in `scripts/data/contest-pattern-map.json` — the same
   editorial status as `curriculum.json`, and validated the same way.
2. **Priority order**, so `["Array", "Monotonic Stack"]` resolves to `stacks`, not a generic
   bucket. Specific tags outrank container tags; container tags alone never produce a mapping.
3. **Honest confidence.** `exact` (single unambiguous tag ↔ pattern), `strong` (tag combination
   the table names explicitly), `heuristic` (inferred, shown as inferred), `unmapped`.

**`unmapped` is a legitimate, shipped outcome.** The UI says *"Pattern mapping unavailable"*; it
never guesses. This is the repo's existing rule — *unmeasured is not zero* — applied to a new
dataset, and it is why §6.3 can safely let contest evidence reach the weakness model.

Only `exact` and `strong` mappings may (a) satisfy a pattern filter or (b) contribute a stall to
weakness. `heuristic` is visible and browsable but evidentially inert.

**This is judgement work, not code, and it is the schedule's critical path.** Budget 1.5–2 days.

---

## 6. Engine, store, and the feedback loop

### 6.1 New pure module — `src/utils/engine/contestLibrary.ts`

No React, no Redux, no `localStorage`, no `Date`. ISO strings in.

```ts
filterContestProblems(pool, filter): ContestProblem[]   // ONE generic predicate (directive §19)
buildContestIndex(pool): ContestIndex                   // the 10 indexes of directive §11
ratingBand(rating): RatingBand
contestRevisionPool(input): ContestProblem[]            // the 10 selection inputs of directive §25
selectionReason(problem, filter): string[]              // "Why this problem?" (directive §45)
recommendNextBand(evidence): RatingBand | null          // conservative; null when unevidenced
```

`filterContestProblems` is **one predicate over a filter object**, not a function per combination
(directive §19). Every filter field is optional; absent means unconstrained.

`contestRevisionPool` ranking, in order: due on the ladder → mapped to the requested pattern →
inside the rating band → not solved within `recencyWindowDays` (default 7; fully eligible again
past 30 — a decaying penalty, never an infinite exclusion, per directive §26) → contest diversity
→ index diversity → sub-pattern diversity → seeded tiebreak.

### 6.2 Recommendation must be conservative

`recommendNextBand` returns `null` below a stated minimum of evidence, and never advances more
than one band per sitting (directive §28, §46, §51). This is the `timeEstimate.ts` rule —
*a personal figure appears only past a stated sample threshold* — applied to rating.

### 6.3 Weakness: no new signal, no new weight

Contest-library stalls resolve to AICM patterns through the mapping and enter the **existing**
`contestSittingRecorded` → `stalledPatterns` channel, feeding the `contest` signal already
weighted 0.08 in `weakness.ts`. Nothing new is added to `SIGNAL_WEIGHTS`.

Two guards: only `exact`/`strong` mappings may contribute a stall (an unmapped problem produces no
claim), and `analyzeContest` remains the single owner of the conclusive/inconclusive decision.

### 6.4 XP and the day ledger

Contest-library solves are real work and pay the ordinary solve XP through the existing path — but
see §10.2, because 2,561 problems against a curriculum worth ~11k XP will recalibrate the level
curve, and that is a product call rather than an implementation detail.

---

## 7. Surfaces

### 7.1 `/contest-practice` — the Contest Library (new route)

Three files to add a route: lazy import + `<Route>` in `App.tsx`, one entry in `navItems.ts`
(`mobile: 'more'`, `group: 'work'`) — and `routes.test.tsx` picks up mount coverage automatically
off `NAV_ITEMS`.

**Simple mode by default** (directive §61): pattern → rating → Start. Advanced filters live behind
a `Disclosure`. Filters read as one coherent control system built from `ChipRadioRow`, with an
always-visible **result count** ("137 matching problems"), a visible active-filter state, and
`Clear filters` (directive §55–§56).

The table is dense and scannable — `RuledList`/`RuledItem`, `Meta` lines, restrained rating
treatment, **no per-row color** (directive §54). Columns: ID · Problem · Rating · Difficulty ·
Contest · # · Topics · Pattern · Status. Virtualize only if measurement demands it.

Empty state keeps the learner's filters and suggests the loosening that would help — *"No matching
contest problems. Try widening the rating range."* (directive §57).

### 7.2 Pattern page CTA — the journey the whole feature is judged on

`PatternDetailPage` gains one action: **`Practice contest problems →`**, deep-linking to
`/contest-practice?pattern=two-pointers`, with the filter **already applied** (directive §22–§23).
Recommend, never gate (directive §47).

This is directive §63's acceptance path and it is the first thing to build end-to-end.

### 7.3 Revision page — a mode selector, additively

`RevisionPage` gains Standard · Contest · Weak areas · Pattern. **Standard is the default and is
untouched** — the existing preview → frozen run → complete flow, `sessionSlice`, and every copy
assertion in `revision.test.tsx` (30 tests) stay exactly as they are. Contest mode exposes
pattern / rating / topic / contest type / count, and runs through the shared contest engine.

### 7.4 Contest session

Filtered contests reuse `ContestPage`'s timer, navigation, solve state and finish flow — the same
components, a different pool. Full Contest keeps its own entry point and its locked behaviour.

Per-problem detail shows title · frontend id · official difficulty · contest rating (with the
tooltip) · contest · Q-index · LeetCode topics · AICM pattern · sub-pattern · curriculum status ·
**Open on LeetCode →** (canonical slug URL), plus **Why this problem?** (directive §45).

---

## 8. Tests

Data: ZeroTrac parser · contest-name/number/type normalization · slug validity · URL construction
· **slug-join correctness including the frontend-vs-internal-id trap of §2.1** · dedupe · mapping
table resolution and confidence tiers · `unmapped` is preserved, never guessed.

Engine: each filter dimension · combined filters · rating bands · seeded determinism · pattern
diversity · contest diversity · recency exclusion and its decay · revision pool ordering ·
`recommendNextBand` returns `null` below threshold and never skips a band · **`buildContest`
byte-identical for a fixed seed after the generalization**.

Store: `contestLibrarySlice` ladder transitions match `spacedRepetition` exactly · curriculum
problems read through to `progress.byId` rather than duplicating · persisted round-trip of every
value the UI can write (`persistence.test.ts` discipline) · stalls reach `contestSittingRecorded`
· unmapped problems contribute no stall.

UI: pattern preselection from the query param · result counts · empty state keeps filters ·
contest launch · revision mode selector leaves Standard unchanged · canonical links ·
`routes.test.tsx` picks up the new route.

Bundle: a test pinning `contestLibraryIndex.ts` against the dataset, and a check that
`selectors.ts`/`actions.ts` do not import `@/data/contestLibrary`.

---

## 9. Delivery sequence

| Slice | Content | Est. |
|---|---|---|
| **0** | Measure: ZeroTrac field shape; GraphQL tag fetch feasibility; **slug overlap between the 2,561 and the 528**; generated size before/after dictionary encoding. | 2–3 h |
| **1** | Fetchers + generator + validator + audit report + `data-contests` chunk + index restatement. Dataset lands, nothing consumes it. | 1 d |
| **2** | **The mapping table.** Hand-verified, priority-ordered, confidence-tiered. *Critical path.* | 1.5–2 d |
| **3** | `engine/contestLibrary.ts` + generalized `buildContestFrom` + `contestLibrarySlice`. Existing contest tests must stay green unmodified. | 1 d |
| **4** | `/contest-practice`: filters, table, counts, empty state, detail. | 1–1.5 d |
| **5** | **The §63 journey end-to-end**: pattern CTA → preselected filter → 4-problem filtered contest → timer → canonical links → results → evidence banked. | 1 d |
| **6** | Revision mode selector + Contest Revision pool + conservative band recommendation. | 1 d |
| **7** | Mixed-pattern contest, "Recreate contest", progression polish. | 0.5–1 d |

**~7–9 days**, with slice 2 the item most likely to slip and the one that decides whether this is
an intelligence layer or a database viewer.

Slices 0–5 deliver the directive's acceptance journey. 6–7 complete the taxonomy of §50.

---

## 10. Decisions needed before slice 1

### 10.1 The `leetcodeId` correction (§2.1 secondary)

Every stored `Question.leetcodeId` is LeetCode's internal id, not the number a user sees. Links are
unaffected. Fixing it is one field in the catalog fetcher plus a regeneration — but it touches the
locked 539 dataset. **Recommendation:** fix it, as a separate committed change *before* slice 1,
so the new dataset and the old one agree about what "LeetCode ID" means. Directive §36 lists
"inconsistent IDs" as a validation failure, which argues the same way.

### 10.2 Do contest-library solves pay XP?

PRODUCT.md says contest solves take the ordinary path — same XP, ledger, streak, ladder. But
2,561 problems × ~20 XP ≈ 51k XP against a curriculum worth ~11k recalibrates the level curve
substantially. **Recommendation:** pay ordinary XP (it is real work, and "a reward the learner can
explain" argues for it), and treat the curve as a calibration item to check once after slice 5.
The alternative — real solves earning nothing — is harder to justify at 11pm on problem 40.

### 10.3 Do contest-library due items appear on Today?

They are computable eagerly without the dataset (§3.6). **Recommendation: no, not initially.**
`rankWork`'s ordering principle is that retention of *curriculum* knowledge outranks acquisition,
and the daily plan's finishability caps exist for a reason. Contest Revision is a mode the learner
chooses, not work the day assigns. Revisit after the feature has real usage.

---

## 11. Non-goals, stated so they are not re-litigated

- Not a second roadmap, not a second revision engine, not a second weakness model, not a second
  contest engine, not a second prioritizer.
- No runtime scraping of Google, LeetCode or ZeroTrac. Ever.
- No user contest-rating claim.
- No LLM-invented mappings at runtime — the table is data, hand-verified and auditable (§9 of the
  directive, and the repo's existing rule that authored intelligence is generated, never guessed).
- No new color system, theme, card idiom or visual language. The feature is built from `Page.tsx`
  and must read as native.

---

## 12. The one-line test of whether this shipped correctly

Open Two Pointers → **Practice contest problems** → the filter is already set → choose 1400–1600 →
start a 4-problem contest → the timer runs → links are canonical → ratings and topics are shown →
results are recorded → the evidence reaches the existing weakness model → Contest Revision can
retrieve those problems later → **Standard Revision and Full Contest are bit-for-bit what they
were** → 1176+ tests green.

If any clause of that sentence is false, the feature is not done.

---

## 13. Slice 0 — measured results (2026-08-19)

Every figure below was produced by running the probe, not estimated. Sources fetched live at
engineering time; nothing was added to the runtime graph.

### 13.1 ZeroTrac source format — CONFIRMED, and better than assumed

`https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/data.json`
(the same file the GitHub Pages site renders from; `ratings.txt` is the TSV twin).

Fields: `Rating, ID, Title, TitleZH, TitleSlug, ContestSlug, ProblemIndex, ContestID_en, ContestID_zh`
— i.e. it carries a human-readable contest name too, so §8's contest-name normalization has a
source rather than needing to be derived from the slug.

| Property | Measured |
|---|---|
| Records | **2,561** (matches the site's own total exactly) |
| Unique slugs | 2,561 — **no duplicates** |
| Unique IDs | 2,561 — **no duplicates** |
| Duplicate (contest, index) pairs | **0** |
| Contests | 640 — 1,809 weekly / 752 biweekly, **no third type** |
| Rating range | 1084.1 – 3773.8 |
| Problem index | Q1 640 · Q2 640 · Q3 640 · Q4 640 · **Q5 1** |

**⚠️ Spec correction: a Q5 exists.** Weekly Contest 68 ran five problems (`Basic Calculator IV`,
rating 2863). The directive's §7 `problemIndex: "Q1"|"Q2"|"Q3"|"Q4"` union is therefore wrong and
would have hard-failed validation on ingest. The type must admit Q5.

### 13.2 The ID trap, quantified

`frontendId === zerotrac.ID` for **2,561 / 2,561**.
`catalogInternalId === zerotrac.ID` for **0 / 2,561**.

The numeric join is not merely risky — it is wrong for **every single record**. Slug join resolves
**2,561 / 2,561**. §2.1 is settled: the slug is the key, and the frontend id now has two
independent sources that agree.

### 13.3 Coverage — no escape hatch needed

| Check | Result |
|---|---|
| ZeroTrac slugs found in the committed catalog | **2,561 / 2,561** |
| GraphQL metadata found by slug | **2,561 / 2,561** |
| Difficulty: GraphQL vs committed catalog | **2,561 / 2,561 agree** |
| Problems with ≥1 topic tag | **2,517** (44 without — premium-gated) |
| Premium in the pool | 66 (2.6 %) |
| Pool difficulty | 606 easy · 1,285 medium · 670 hard |

The closed-world rule holds with **zero declared exceptions** — there is no `NOT_IN_CATALOG` list
to maintain, and no record is silently discarded. The 44 tagless problems are the first genuine
occupants of `mappingConfidence: 'unmapped'`, which makes §58 a shipped state rather than a
hypothetical one.

### 13.4 Curriculum overlap — the identity bridge is substantial

| | Count |
|---|---:|
| Curriculum questions with a verified LeetCode identity | 528 |
| **Already rated contest problems (the bridge)** | **207** |
| Contest-only, new to the app | **2,354** |
| Curriculum questions with no contest rating (pre-contest-era / unrated) | 321 |

**207 of the existing 539 gain a contest rating for free.** That is a bigger result than the plan
assumed: the identity bridge is not a bookkeeping detail, it is a feature — the curriculum's own
question sheets can show `Medium · Contest rating 2712 · Weekly 338 Q4` with no new content
authored, and Contest Revision starts with 207 problems whose ladder state already exists.

Sample: #264 Collect Coins in a Tree (2712, W338 Q4) · #126 Find the K-Sum of an Array (2648,
W307 Q4) · #478 Finding MK Average (2396, W236 Q4).

### 13.5 Topic tags — the mapping table is ~47 entries, not 157

157 distinct tags appear across the 2,561, averaging **3.39 tags per problem** — but the
distribution is sharply skewed: **110 tags occur ≤20 times**, leaving ~47 that carry real weight.

The container-tag problem is confirmed and quantified: `Array` 1,649 · `String` 625 ·
`Math` 503 · `Sorting` 400 · `Simulation` 177 · `Counting` 177 · `Enumeration` 145. These must
never produce a mapping on their own. The specific tags that map cleanly are exactly the ones the
AICM patterns are named for: `Binary Search` 247 · `Two Pointers` 155 · `Sliding Window` 126 ·
`Union-Find` 75 · `Backtracking` 63 · `Monotonic Stack` 46 · `Trie` 32.

**Slice 2 is therefore smaller than budgeted** — ~47 authored entries plus a priority order,
rather than 157. Revised estimate: 1–1.5 days.

### 13.6 Size — dictionary encoding is mandatory, and sufficient

| Encoding | Size |
|---|---:|
| Naive JSON, every field spelled out | **1,232.9 kB** |
| Dictionary-encoded columnar | **322.1 kB** (−74 %) |

For scale: `data-curriculum` 386.5 kB, `data-ml` 275.1 kB, app chunk 280.8 kB against a 301 kB
budget. The naive form is 1.2 MB and unshippable; the encoded form sits comfortably between the
two existing data chunks. `url`, contest `type` and contest `number` are all derivable from the
slug and contest slug, so they are computed at load rather than stored.

**Decision: ship the dictionary-encoded form** behind `src/data/contestLibrary.ts`, in its own
pinned `data-contests` chunk. §3.6's conditional is now unconditional.

### 13.7 What slice 0 changes in the plan

1. **Q5 must be representable** — index type widens (§7 of the directive is corrected here).
2. **Dictionary encoding moves from "if >300 kB" to required** (§3.6).
3. **No catalog-miss escape hatch is needed** — coverage is total.
4. **Slice 2 shrinks to ~47 mapping entries** (1–1.5 d, from 1.5–2 d).
5. **The 207-problem bridge is promoted from bookkeeping to a shipped surface** — contest rating
   on existing curriculum question sheets, at no content cost.

Nothing here contradicts §1's locked constraints, and no measurement required touching the 539.

---

## 14. Slices 1–3 — implementation log (2026-08-20)

### 14.1 What shipped

**Slice 1 — the pipeline.** `fetch-zerotrac-ratings.mjs` + `fetch-leetcode-topics.mjs` →
committed snapshots → `generate-contest-library.mjs` → dictionary-encoded
`src/data/contestLibrary.json` (336.5 kB), pinned to its own `data-contests` chunk. One command:
`npm run fetch:contest-data`. `validate:data` gained an independent pass over the *artifact*, so
a hand-edit or a stale file is caught by a command anyone can run offline.

**Slice 2 — the mapping table.** `scripts/data/contest-pattern-map.json`: 11 container tags that
never map alone, 16 ordered combination rules, ~110 direct rules, and an explicit
`_unmappableTags` list so a rejected tag reads as *considered* rather than *forgotten*.

```
AICM mappings:  exact 2014 (78.6%) · strong 139 (5.4%) · heuristic 164 (6.4%) · unmapped 244 (9.5%)
Curriculum overlap:  existing 207 · contest-only 2354        Invalid records: 0
```

2,153 of 2,561 (84 %) carry a filterable pattern. The 244 unmapped are honest: 44 premium
problems with no tags at all, and 200 whose only tags are containers (`Array, Enumeration`) or
string-algorithm tags AICM genuinely has no pattern for.

**Slice 3 — engine and store.**
- `src/utils/engine/contestLibrary.ts` — rating bands, ONE filter predicate over an
  all-optional filter object, the ten indexes, the revision scorer, `selectionReason`, and
  `recommendBand`. Pure: no React, no store, no clock, and **no import of the dataset**.
- `engine/contest.ts` gained `selectContestSet(pool, plan, seed)` over a structural
  `ContestCandidate`. `buildContest` is now a thin adapter over it.
- `contestLibrarySlice` — persisted, sparse, **keyed by slug**, reusing `ladderEntry` /
  `ladderAfterReview` / `isLadderDue` verbatim.
- `serialize.ts` — optional-with-boundary-default both ways; lenient on slugs, strict on the
  ladder range.

### 14.2 Verification

| Check | Result |
|---|---|
| Full suite | **86 files / 1,239 tests passed** (baseline 1,176 + 63 new) |
| **Full Contest unchanged** | the 62 pre-existing contest tests pass **unmodified** after the generalization |
| `tsc --noEmit` | clean |
| `npm run build` | clean; app chunk **283.56 kB** against the 301 kB budget (+2.79 kB for the slice, engine and serializer; the 336 kB dataset stays out) |
| `validate:data` | OK — `2561 rated problems, 2153 with a filterable AICM pattern, 207 bridged` |

### 14.3 Decisions taken during implementation

1. **Rating bands live in the engine, not the data module.** Anything importing
   `@/data/contestLibrary` also downloads 336 kB; band arithmetic has no business costing that.
2. **Bands are 200 points wide, not 100.** Contest ratings carry real estimation error, so a
   1500–1599 band would be selecting noise. 200 is wide enough for "I am comfortable here" to be
   a claim the evidence can support.
3. **A re-solve counts as an attempt but does not restart the ladder** and does not move
   `solvedOn`. Practising something again must never silently reset the learner's own schedule;
   the attempt count is evidence, never a penalty.
4. **`contestLibraryIndex.ts` was NOT built.** The plan assumed the store would need dataset facts.
   It does not: due counts come from `dueContestSlugs` over the slice alone, and pattern
   resolution for weakness happens at the lazy page's call site before the thunk. An unused
   indirection module would have been worse than none. Revisit only if a store-side need appears.
5. **`selectContestSet` relaxes diversity in rungs rather than dropping a slot** — both fresh →
   fresh pattern only → any. A short contest is worse than one repeated pattern, which is the
   rule Full Contest already followed.

### 14.4 Still open

§10's three decisions are untouched and none blocks the remaining slices: the `leetcodeId`
correction (10.1), XP for pool solves (10.2), and whether contest work appears on Today (10.3).
Next is slice 4 — the `/contest-practice` surface — then slice 5, the §63 acceptance journey.

---

## 15. Slice 4 — implementation log (2026-08-20)

### 15.1 What shipped

**The `/contest-practice` route** — `ContestPracticePage.tsx`, lazy, the only kind of module
allowed to import `@/data/contestLibrary`. Three-file route wiring per CLAUDE.md; the nav entry
(`Contest Library`, `Library` icon, `mobile: 'more'`, `group: 'work'`) sits at the end of the
rehearsal cluster, and `routes.test.tsx` picked up mount coverage automatically off `NAV_ITEMS`.

**The sixteenth destination broke a shipped guarantee, and the fix is in this slice.** V12.4's
"the rail never scrolls" was calibrated to fifteen rows: at `short:` (≤700px), 16 × 28px rows plus
the rail's fixed chrome is ~602px against the 590px reference viewport. `Sidebar.tsx`'s `short:`
rows are now 26px (`min-h-[26px]` + `py-0.5`), landing the rail at ~570px with the 24px WCAG 2.5.8
floor still cleared. Static arithmetic only — see §15.4.

**The page.** `Screen`/`ScreenHeader`/`Panel` composition, zero plates. Simple mode by default:
one pattern `Select` (with per-pattern mapped counts) + the seven rating-band chips; everything
else — difficulty, contest type, position (data-driven, so Q5 exists), topic, progress status,
curriculum status, free-only, include-inferred, title search — behind one `Disclosure` whose meta
shows "N active". Result count always visible; "Clear filters" only when a filter is active. Rows
are `<details>` summaries in a `RuledList` (the Disclosure idiom at row density): id · title ·
pattern (lg) · contest (md) · difficulty (always) · rating (sm, sr-labelled) · status, folding at
50 rows with a +150 projection-kit fold row. The expanded detail carries the full §7.4 field list,
the `CONTEST_RATING_NOTE` tooltip, sub-pattern display names, and the canonical slug-built
"Open on LeetCode →" link.

**Engine addition** — `contestStateFromQuestionProgress` in `engine/contestLibrary.ts`: the ONE
translation of a curriculum record into contest-state shape, so the 207 bridged problems read
through `progress.byId` identically here and in slice 6's revision pool. `attempts` is a floor
(worked-on vs untouched), because the curriculum register never counted attempts.

**Idiom consolidation** — `QuestionFilterRow`'s chip and group class constants are now exported
and imported here, so the filter-chip idiom has one definition instead of a third hand-written
copy. Filters are deliberately `aria-pressed` single-select-with-clear toggles, NOT `ChipRadioRow`
(§7.1 named it loosely): a radiogroup promises a checked member, and a filter's resting state is
"nothing constrained".

### 15.2 Verification

| Check | Result |
|---|---|
| Full suite | **87 files / 1,252 tests** (slice 3 baseline 1,239 + 9 page + 3 engine + 1 auto route) |
| `tsc --noEmit` | clean |
| Build | app chunk **290.23 kB** against the 301 kB budget; **`data-contests` fills at 343.72 kB** (the empty-chunk status line from the slice 0–3 handoff is retired); page chunk 13.68 kB |
| Chunk isolation | `ZeroTrac` string grep: absent from the app chunk, present in the page chunk — the decoder rides the lazy route |
| Design review | independent fresh-context reviewer: **fix-then-ship** (1 material, 6 minor) → all seven applied → verdict pass: **ship** |

The material finding is worth recording: below `sm` the row hid official difficulty while showing
the ZeroTrac rating — the estimate *instead of* the official signal, inverting §3.4 on exactly the
phone-check-in surface PRODUCT.md makes first-class. Fixed by swapping which column yields.

### 15.3 Decisions taken during implementation

1. **Slice 4 is read-only.** No thunks, no Start button, no XP — the page browses, filters and
   links out. §10.2 (XP for pool solves) therefore stays genuinely open rather than being decided
   by accident, and the contest launch arrives with slice 5's journey.
2. **Display order is rating ascending, slug tiebreak.** A filtered pool reads shallow end first —
   the session arc's "opens achievably" principle — and the order is fully deterministic.
3. **The fold, not virtualization.** 50 rows painted, +150 per fold click, whole-result count
   always visible. Filters are the intended way in; scrolling 2,561 rows is not.
4. **`?pattern=` is two-way.** The CTA preselects through it; choosing or clearing a pattern
   writes it back (`replace: true`), because a stale param would resurrect a cleared filter on
   the next reload. Unknown params are ignored rather than filtering to nothing.
5. **The empty-state hint is verified, not guessed.** Each candidate loosening is re-run through
   `filterContestProblems` before being suggested, so the page never recommends a widening that
   would not help. Runs only when the result is already empty.
6. **Topics live in the detail, not the summary row.** The §7.1 column list re-arranged, nothing
   removed: a dense one-line row cannot carry a topic list at any honest width.

### 15.4 Carried forward

- **Browser QA did not run this session** — the Chrome extension was disconnected (OAuth account
  mismatch). The 26px rail arithmetic, the row's breakpoint behaviour at 375/768/1280, and both
  themes should be eyeballed at 1280×590 next session. The finish review was code-level and is
  disclosed as such.
- §10's three decisions remain open; 10.2 (XP) becomes pressing the moment slice 5 records solves.

---

## 16. Slice 5 — implementation log (2026-08-20)

### 16.1 What shipped — the §63 journey, end to end

**The CTA (§7.2).** `PatternDetailPage` gains its one `PageHeader` action: an outline
`Practice contest problems` link to `/contest-practice?pattern=:id`, landing on slice 4's already-
working preselect. Recommend, never gate.

**The draw.** The library page's `ScreenHeader` action is **Start contest**: pool = the current
matches minus anything solved in *either* register, seeded by `date|filter-signature` (same
filters, same day → same set, until a solve changes the pool — Full Contest's own promise),
composed by the one `selectContestSet` (`count 4`, distinct patterns and contests, no shape — the
rating-driven mode). Bridged rows use their authored estimate; library-only rows use the new
`CONTEST_TARGET_MINUTES` (14/28/48 — authored-band midpoints, planner-style explicit constants).

**The sitting.** `contestSlice` (unpersisted, so widening was free) gains
`libraryProblems: FilteredContestProblem[] | null` — a full display snapshot per row, built by the
lazy page at draw time, so **`ContestPage` runs filtered sittings without ever importing the
336 kB dataset** (chunk-verified). The numeric clock machinery is untouched: bridged rows keep
their real curriculum id; library-only rows get a **sitting-local negative id** — the ID trap's
third appearance, answered this time by making collision arithmetically impossible.

**The engine widening.** `analyzeContest` now takes `ContestQuestionLike`, a structural supertype
of `Question` with `pattern`/`tests` honestly optional: an unmapped stall is informative but
claims no pattern, and a reading without an authored teaching line ends cleanly. **The
pre-existing contest tests pass unmodified**, and the fresh-context reviewer verified by diff that
Full Contest's paths are behaviourally identical (one hand-built state fixture gained the new
null field; no assertion changed).

**Solve routing — §10.2 decided.** A library-only solve enters the slug register
(`contestProblemSolved`), pays the ordinary `SOLVE_XP[difficulty]` **once** (a re-solve records
the attempt, pays nothing, never resets the ladder), and writes **no** day log and **no**
daily-goal interaction — `DayLog.solvedIds` is a curriculum ledger and the plan's finishability
caps are calibrated to it. A bridged row takes the full ordinary `solveQuestion` path: one
problem, one record.

**Evidence.** `finishContest` banks a filtered sitting **pattern-level only**: `stalledPatterns` =
the union of the stalled rows' confident mappings, trimmed to `attempted` (the pattern list
yields; the count is never inflated), and **no `problems` rows** — that `questionId` space is
read back by curriculum surfaces, so a library number there would be the ID trap in persisted
form. Stalled library rows leave slug-keyed *attempts*; an inconclusive sitting writes nothing
anywhere (`analyzeContest` stays the single owner, test-pinned).

### 16.2 Verification

| Check | Result |
|---|---|
| Full suite | **90 files / 1,267 tests** (slice 4 baseline 1,252 + 4 engine + 8 store + 3 journey) |
| `tsc --noEmit` | clean |
| Build | app chunk **292.62 kB** against the 301 kB budget; `data-contests` 343.72 kB unchanged; ContestPage chunk 11.43 kB, **dataset-string-free** (grep-verified) |
| Full Contest | pre-existing engine + page contest suites pass unmodified |
| Design review | fresh-context reviewer: fix-then-ship (1 material, 3 minor) → all four applied |

The material finding: `startFilteredContest` could silently stomp a live sitting. The thunk now
refuses while a sitting runs (test-pinned) and the page's Start disables with a stated reason.
The minors: `attempted` computed before the pattern trim (a stored count must never overstate the
sitting); `CONTEST_RATING_NOTE` relocated to the dataset-free engine so the run surface's rating
claim carries its basis (tooltip added); `premium` snapshotted and shown on the run row so a
paywall never ambushes a timed sitting.

### 16.3 Reviewer NOTEs deliberately not acted on (product calls, recorded)

1. **Library solves don't mark the day active** — no streak/heatmap/day-log effect. True
   consequence of the curriculum-only `DayLog`; `mlActivityByDate`'s derived-merge is the
   established pattern if wanted. Revisit with slice 7 or after real usage.
2. Run rows omit LeetCode topics (they live on the library surface) — deliberate snapshot leanness.
3. ContestPage's pre-existing bordered DifficultyBadge inside a Meta line — V8 debt, out of scope.
4. `selectionReason`'s raw-ISO `Last solved` branch is unreachable from the draw (solved problems
   are excluded); format at point of use if a future surface makes it reachable.

---

## 17. Slice 6 — implementation log (2026-08-20)

### 17.1 What shipped — Contest Revision, beside Standard and never inside it

`/revision` gains a four-chip mode selector (**Standard · Contest · Weak areas · Pattern**) as the
one control above the work. Standard is the default and is what it always was: the 30 tests in
`revision.test.tsx` pass **unmodified**, which was the acceptance condition for this slice.

- **`src/components/revision/ContestRevision.tsx` (new, `lazy()`-ed from `RevisionPage`).** The
  latch is a bundle decision, not a habit: the component imports `@/data/contestLibrary`, and
  `/revision` is a daily route. Build-verified — the only static importers of the data module are
  `ContestPracticePage` and `ContestRevision`; `RevisionPage` carries the dataset only in its
  `__vite__mapDeps` preload table, which is the dynamic-import dependency list, not an import.
- **Three pools, one scorer.** Contest = the whole library; Weak areas = scoped to
  `selectPatternWeakness`'s ids (resolved at the lazy page, so the store still never touches the
  dataset); Pattern = one chosen pattern. All three call `scoreRevisionCandidates` — no second
  ranking heuristic, and the rendered "why this" line is the scorer's own `reasons`, verbatim.
- **The list is split in two, deliberately.** *Due now* is revision and takes a grade; *Worth
  practising* is acquisition and links out. One list with grade buttons on some rows would read as
  a single queue the learner is behind on — the debt notice the standard page was rebuilt to stop
  being. "Start a timed set →" points at `/contest-practice` rather than re-implementing the draw.
- **`reviseLibraryProblem(slug, difficulty, passed)`** (`store/actions.ts`) — solved-and-unmastered
  only, one grade per calendar day, `revisionXp(difficulty)` on pass **and** fail, **no day log**
  (same reasoning as `solveContestProblem`: `DayLog` is the curriculum's ledger and the weekly-clear
  bonus is defined over the curriculum's queue). §10.2's "ordinary path" ruling, applied to reviews.
- **Bridged problems never reach that thunk.** A grade on one of the 207 dispatches
  `reviseQuestion(curriculumQuestionId)`. One problem, one identity, one record.
- **The band reading** sits in the rail with its sample size, reads `contestLibrary.bySlug` **only**
  (curriculum solves are done with guidance, hints and no clock — reading a contest band off them
  would be reading performance off practice), and stays silent below `MIN_BAND_EVIDENCE`.

### 17.2 Three defects found — one of them by the browser, in ten minutes

1. **⛔ `loadInitialState` never mapped `contestLibrary`** (a slice-3 bug, live since then). The
   write path was complete — `selectPersistedState` wrote it, `validatePersisted` accepted it,
   `stateImported` restored it — and `contestLibrarySlice.test.ts` exercised the **import** path.
   So every gate was green while every contest-library solve was silently discarded on the next
   page load. **A persisted channel has two read paths, boot and import, and the tests that feel
   like persistence tests only cover one.** Fixed, with a boot-path round-trip test.
2. **The due list reshuffled under the learner.** Grading pushes the ladder date out, so the graded
   row stopped being due and vanished, the count shrank, and the rows below jumped up — exactly
   what `sessionSlice.frozen` exists to prevent for Standard. The due list is now frozen for the
   sitting (membership *and* order), keyed by `date|mode|pattern` so changing pool composes a new
   sitting while grading inside one never disturbs it.
3. **`recommendBand` named a band as the step up from itself.** From the top band the clamp holds
   `band` at `comfortable` while `step` is still 1, printing "You solved problems around the 2200+
   band. 2200+ is the next step up." The wording now follows whether the band actually moved.

Also found and fixed on the surface: a past-dated "Next review" line on due rows, and the same date
printed twice on a graded row.

### 17.3 Verification

| Gate | Result |
|---|---|
| `npm test` | **91 files / 1,285 passing** (+18 over slice 5's 1,267) |
| `npx tsc --noEmit` | clean |
| `npm run build` | clean; app chunk **294.91 kB** / 301 budget (6.1 kB headroom); `data-contests` 343.72 kB unchanged; `ContestRevision` its own 8.84 kB chunk |
| `npm run validate:data` | OK — unchanged |
| Standard revision | **30 tests pass unmodified** |
| Browser, 1280×590 | all four modes, light + dark, no console errors, no horizontal scroll, the 16-row rail still fits without scrolling |

### 17.4 Decisions taken during implementation

1. **Recording a *solve* stays out of Contest Revision.** The pool ranks unsolved problems, but the
   only place a library solve is recorded is a timed sitting from `/contest-practice`. Adding a
   bare "Solved it" button here would have been a second solve path with its own XP question, and
   the honest alternative — link out, then start a timed set — costs nothing and duplicates nothing.
2. **The mode chips hide while a Standard session runs.** A frozen plan is a commitment; switching
   pools mid-sitting is that reshuffle in its largest form. Same refusal `startFilteredContest`
   makes when a contest clock is already running.
3. **Weak areas with no weakness evidence shows the whole library, and says so.** Fails toward
   silence rather than naming a pattern the one weakness model has not named.

### 17.5 Carried forward to slice 7

- Mixed-pattern contest (`distinctPatterns: false` weak-areas draw) and "Recreate contest"
  (`distinctContests: false` over `index.byContest`) — both on `/contest-practice`.
- The open product call from §16.3: do library solves mark the day active? Still no.
- App-chunk headroom is now **6.1 kB**. Slice 7 adds only to the lazy Contest Practice route, but
  anything that touches `actions.ts` or `selectors.ts` should re-check `npm run build`.
