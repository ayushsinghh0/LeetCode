# The Topic-Wise Revision Sheet — integration design (2026-08-20)

**Status: planned, not started.** V13 slice 7 is still the active work; this is queued behind it.
The evidence this plan rests on is `revision-sheet-report.md`, generated from committed snapshots
with no network.

---

## 0. What the measurement changed

The sheet looked like a third question universe: 1,210 rows, 23 topics, 99 sub-topics. It is not.

| | |
|---|---:|
| Unique LeetCode problems | **1,016** |
| Already in the 539 roadmap and/or the contest library | **857 (84%)** |
| In **neither** — genuinely new | **159** |
| Not on LeetCode at all (GfG / CSES / Codeforces / AtCoder / theory) | 134 rows |

So the sheet's contribution is **not problems**. It is **a topic-wise ordering and grouping over
problems this repository already tracks**, plus 159 additions. That single fact makes the whole
integration an order of magnitude smaller — and it is why the design below adds no third universe,
no third progress register, and no second scheduler.

A second measured finding worth acting on: the 539 curriculum, being AICM/Grokking-shaped, picks
*representative* problems per pattern and therefore **omits several canonical ones** — Two Sum,
4Sum, 3Sum Closest, and Container With Most Water are all absent. The sheet fills real gaps, not
just re-orders.

---

## 1. Locked constraints (inherited, do not re-litigate)

- **The two universes never merge.** The 539 are a curated curriculum; the contest library is a
  pool. This sheet becomes a **lens**, not a universe.
- **⛔ Every join is on the slug.** Never a number. (`CLAUDE.md` — the ID trap.)
- **One problem, one identity, one record.** A sheet row that is curriculum question N keeps its
  record in `progress.byId`; everything else uses the slug register.
- **No runtime network**, no LLM-invented mappings, no guessed links.
- **Any new large generated JSON must be pinned to its own bundle chunk.**
- **The daily plan must stay finishable** — nothing here may enter `rankWork`.

## 2. The one product rule the user stated

> *"the revision should not repeat the question that I have solved in the roadmap"*

**295 of the 1,016 are on the 539 roadmap.** Because membership is known at generation time, this
is enforced **by construction** rather than by a filter someone has to remember: the sheet's draw
excludes roadmap-backed rows by default, and the exclusion is visible and reversible in the UI
(*"Include problems already on my roadmap"*), never silent.

## 3. Architecture — a lens, not a universe

### 3.1 The dataset: `src/data/revisionSheet.json` (generated)

Emitted by `scripts/generate-revision-sheet.mjs` from the transcript + the same snapshots the
report uses. Dictionary-encoded like the contest library. Shape, per row:

```
[topicIdx, subtopicIdx, order, slug, frontendId, titleIdx?, difficultyCode, source]
```

`source` is the load-bearing field — `curriculum` (resolve through `questions.json` by slug),
`library` (resolve through `contestLibrary.json` by slug), or `sheet` (the 159; this dataset
carries their title/difficulty/topics itself, because nothing else does).

Rows that resolve to an existing universe **carry no duplicated metadata** — title, difficulty and
rating are read from the universe that owns them. That is what keeps this dataset small and what
stops it drifting out of step when the library is regenerated.

**Estimated size ~70–90 kB encoded.** Pin it to a `data-sheet` chunk in `vite.config.ts`; it must
never land in the app bundle (the `mlTrackIndex.ts` trap, now a documented three-time offender).

### 3.2 Progress: no new register

- `source: 'curriculum'` → `progress.byId[questionId]` (already exists).
- `source: 'library'` → `contestLibrary.bySlug[slug]` (already exists).
- `source: 'sheet'` → **`contestLibrary.bySlug[slug]` as well.**

That third line is the key simplification, and it is safe *today* without any schema change:
`contestLibrarySlice` is a sparse **slug**-keyed map whose reducers never consult the dataset, and
`validatePersisted` deliberately accepts any non-blank slug so a retired problem goes inert rather
than quarantining the learner's state. A sheet-only problem is exactly that shape.

**Consequence to accept deliberately:** `contestLibrary.bySlug` stops meaning "contest problems"
and starts meaning "non-curriculum problems on the one ladder". Rename nothing (renaming a
persisted channel is a migration); instead say so in `CLAUDE.md`, because a name that quietly
widened is how the next person builds on a false assumption.

### 3.3 Engine: `src/utils/engine/revisionSheet.ts` (pure, dataset-free)

Pool in, answer out — the `contestLibrary.ts` discipline exactly.

```ts
sheetProgress(row, lookups): SheetRowState       // one row, three possible sources, one shape
topicStats(rows, lookups): TopicStat[]           // solved / due / untouched per topic + sub-topic
selectSheetRevision(input): ScoredProblem[]      // ranked, excludeRoadmap defaulting to true
nextUnstartedInTopic(rows, lookups): SheetRow    // "continue where I left off", per sub-topic
```

Ranking **reuses `scoreRevisionCandidates`** rather than restating it. There is one scorer for
non-curriculum practice and this must not become the second.

### 3.4 Surfaces

1. **`/sheet` — the index.** Topic → sub-topic → rows, with per-topic progress. Built from
   `Page.tsx` primitives only, the `/contest-practice` row idiom reused verbatim. This is the
   "revision list" the user actually asked for.
2. **Contest Revision gains a fifth mode: `Sheet`.** `/revision` already has Standard · Contest ·
   Weak areas · Pattern; a Sheet mode scoped to a chosen topic fits the existing selector with no
   new page. It reuses the frozen-due-list machinery — which exists precisely because grading
   pushes the ladder date out from under the row.
3. **A timed set from a sub-topic**, via the existing `startFilteredContest` path. No new draw.

Nothing is added to Today. `settings.contestOnToday` already governs the one rail block, and the
sheet is a chosen activity, not work the day assigns.

---

## 4. Delivery sequence

| Slice | Content | Est. |
|---|---|---|
| **S0** | ✅ **Done** — transcript, resolver, `revision-sheet-report.md`. The measurement above. | — |
| **S1** | Generator + `revisionSheet.json` + `data-sheet` chunk + validator rules + the 159 metadata. Dataset lands, nothing consumes it. | 0.5 d |
| **S2** | `engine/revisionSheet.ts` + tests. `scoreRevisionCandidates` reused, not forked. | 0.5 d |
| **S3** | `/sheet` index route (3 files: `App.tsx`, `navItems.ts`, the page). **Check the 590px rail arithmetic — this would be the 17th destination.** | 1 d |
| **S4** | Sheet mode in Contest Revision + the roadmap-exclusion toggle + a timed set from a sub-topic. | 0.5–1 d |

**~2.5–3 days**, after V13 slice 7.

### The nav problem, flagged early

`CLAUDE.md`: *16 nav rows @ `short:` 26px each; a 17th destination breaks 590px again.* `/sheet`
would be the 17th. Resolve it **before** S3, by one of: folding the sheet into `/contest-practice`
as a second tab (no new destination), demoting a rarely-used destination to `mobile: 'more'`, or
re-doing the rail arithmetic. Do not discover this at the end of S3.

---

## 5. Open questions for the user

1. **Should sheet-only problems pay XP?** Recommendation: yes, the ordinary `SOLVE_XP` once — the
   same ruling §10.2 made for library solves, for the same reason ("real work, and a reward the
   learner can explain"). Consistency matters more than the curve here.
2. **The 134 non-LeetCode rows** (GfG / CSES / Codeforces / AtCoder). Recommendation: **list them,
   link nothing, track nothing.** They are real problems worth doing, but the repo has no honest
   way to verify or link them offline, and a fabricated link is the one failure mode this whole
   report was built to avoid. Shown greyed in the index with their platform named.
3. **"Beautiful Numbers"** — one ambiguous title (Appendix D). One word from you resolves it.

## 6. Non-goals

- Not a third universe, not a second scheduler, not a second scorer, not a second weakness model.
- Not on Today, not in `rankWork`, not in the roadmap, not in `currentDay`.
- No scraping. No guessed links. No invented ratings for the 159 unrated problems — they have no
  contest rating and the UI must show absence, not a zero.

## 7. The one-line test of whether this shipped correctly

Open `/sheet` → pick **Two Pointers → Two Pointer on Arrays** → the 20 rows show, 17 marked as
already on the roadmap → toggle *exclude roadmap* off and on and the list changes visibly → start a
revision draw and **not one roadmap question appears** → grade a sheet-only problem and it climbs
the same 1/3/7/15/30 ladder → reload and it is still there → **the 539, Full Contest, Standard
Revision and Contest Revision are all bit-for-bit what they were.**
