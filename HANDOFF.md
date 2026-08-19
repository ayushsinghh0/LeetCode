# HANDOFF — V13 Contest Intelligence, slices 0–3 shipped (2026-08-20)

## Read this first, then start

**Branch: `v13-contest-intelligence`** (pushed to origin; `main` is at `43eecf4`, untouched).
**State: the foundation is complete and green; NO user-facing surface exists yet.**

If you are resuming and just want to keep building, the whole instruction is:

> Continue V13 at slice 4. The plan is `docs/superpowers/specs/2026-08-19-contest-intelligence-design.md`
> §7 (surfaces) and §9 (sequence); the measured baseline is §13 and the implementation log is §14.

Nothing else needs re-deciding. Everything slices 4–7 need already exists as tested pure
functions — slice 4 is wiring, not invention.

```powershell
git checkout v13-contest-intelligence   # if not already on it
npm test                                # expect 86 files / 1239 tests green
npx tsc --noEmit                        # expect clean
npm run build                           # expect app chunk ~283.56 kB (budget 301)
```

---

## Where things stand

| | |
|---|---|
| Tests | **86 files / 1,239 passing** (baseline was 1,176; V13 added 63) |
| Type-check | clean |
| Build | clean; app chunk **283.56 kB** against the 301 kB budget |
| `validate:data` | OK — `2561 rated problems, 2153 with a filterable AICM pattern, 207 bridged` |
| Commits | `e34301e` (repo report), `5a0f3a5` (V13 slices 0–3) |

**The build prints `Generated an empty chunk: "data-contests"`. That is correct and is the
status line for this handoff** — the dataset is pinned and isolated, and nothing imports it yet
because no UI consumes it. It stops being empty in slice 4.

### Done

| Slice | What landed |
|---|---|
| **0 Measurement** | ZeroTrac format, catalog coverage, curriculum overlap, encoding size. Results in design record §13. |
| **1 Pipeline** | `fetch-zerotrac-ratings.mjs`, `fetch-leetcode-topics.mjs`, `generate-contest-library.mjs`, `data-contests` chunk, `validate:data` extension. One command: `npm run fetch:contest-data`. |
| **2 Mapping table** | `scripts/data/contest-pattern-map.json` — 11 container tags, 16 ordered combinations, ~110 direct rules, explicit `_unmappableTags`. |
| **3 Engine + store** | `engine/contestLibrary.ts`, generalized `selectContestSet` in `engine/contest.ts`, `contestLibrarySlice` (slug-keyed), serialize both ways. |

### Not started — this is the visible half

| Slice | Work | Est. |
|---|---|---|
| **4** | `/contest-practice` route: filter bar, dense table, result count, empty state, problem detail | 1–1.5 d |
| **5** | The §63 acceptance journey end to end (pattern CTA → preselected filter → contest → results → evidence) | 1 d |
| **6** | Revision mode selector + Contest Revision pool + band recommendation | 1 d |
| **7** | Mixed-pattern contest, "Recreate contest", progression polish | 0.5–1 d |

**~3.5–4.5 days remaining.**

### Against the directive's §63 acceptance criteria: 6 of 20 pass

Passing: 1 (pattern page exists), 16 (Standard Revision unchanged), 17 (Full Contest unchanged —
its 62 tests pass unmodified), 18 (no runtime network), 19 (data validated), 20 (tests green).
Everything from "user sees Practice Contest Problems" through "Contest Revision retrieves
eligible problems" is slices 4–6.

---

## What already exists to build slice 4 on

Do not re-derive any of this. It is written, tested, and pure.

**`src/utils/engine/contestLibrary.ts`**

| Export | Use |
|---|---|
| `filterContestProblems(pool, filter, progress?, today?)` | The ONE predicate. Every filter field optional; empty array = unconstrained. |
| `isFilterActive(filter)` | Drives the "Clear filters" affordance. |
| `buildContestIndex(pool)` | The ten indexes + `topicsByFrequency` for the filter's option list. Memoize per pool identity. |
| `RATING_BANDS` / `ratingBand(n)` / `bandById(id)` | Bands as data. 200-point wide on purpose. |
| `scoreRevisionCandidates(input)` | Ranked `{problem, score, reasons}` — reasons are render-ready. |
| `selectionReason(problem, state, today, patternName?)` | "Why this problem?" strings. |
| `recommendBand(evidence, current?)` | Conservative; `null` below `MIN_BAND_EVIDENCE`. |
| `initialContestProgress` / `applyContestSolve` / `applyContestReview` / `applyContestAttempt` | Ladder appliers. |
| `dueContestSlugs(bySlug, today)` | Due list from the slice alone — **needs no dataset**. |

**`src/data/contestLibrary.ts`** — `CONTEST_PROBLEMS`, `contestProblemBySlug`,
`contestProblemByCurriculumId` (the 207 bridge), `CONTEST_RATING_NOTE`,
`CONTEST_LIBRARY_PROVENANCE`. **Import only from lazy route components.**

**`src/store/slices/contestLibrarySlice.ts`** — `contestProblemAttempted`,
`contestProblemSolved`, `contestProblemReviewed`. Per repo law these must be wrapped in thunks in
`store/actions.ts` before any component dispatches them.

**`engine/contest.ts`** — `selectContestSet(pool, plan, seed)` takes `ContestCandidate[]` and a
`ContestPlan` (`shape` | `count`, `ratingRange`, `distinctPatterns`, `distinctContests`).

---

## Slice 4 — concrete build order

1. **Route** (3 files, per CLAUDE.md): lazy import + `<Route path="/contest-practice">` in
   `src/App.tsx`; one entry in `src/components/layout/navItems.ts`
   (`mobile: 'more'`, `group: 'work'`); `routes.test.tsx` then picks up mount coverage
   automatically off `NAV_ITEMS`.
2. **Page shell** from `Page.tsx` primitives only — `PageHeader`, `Section`, `RuledList`/
   `RuledItem`, `Meta`, `Ledger`, `Disclosure`, `ChipRadioRow`. No new visual language, no
   per-row colour, plate rule applies (one `Lead` maximum).
3. **Simple mode by default** (directive §61): pattern → rating → Start. Advanced filters behind
   a `Disclosure`. Always show the result count; keep the learner's filters on an empty result and
   suggest widening.
4. **Read the query string** so `?pattern=two-pointers` preselects — slice 5's CTA depends on it.
5. **Show both signals** (`Medium · Contest rating 1648 · Weekly 462 · Q3`) with
   `CONTEST_RATING_NOTE` as the tooltip. Render `Pattern mapping unavailable` for `unmapped`, and
   label `heuristic` as inferred.
6. **Confirm the chunk fills**: after this slice `data-contests` must appear at ~336 kB in the
   build output and the app chunk must stay under 301 kB.

---

## Decisions still open (yours, none blocking)

1. **`leetcodeId` correction.** Every stored one is LeetCode's *internal* id, not the displayed
   number. URLs are unaffected. Fix = add `frontend_question_id` in `fetch-leetcode-catalog.mjs`
   + regenerate, but it touches the locked 539 dataset, so it was left alone.
2. **Do contest-library solves pay XP?** 2,561 problems × ~20 XP against a curriculum worth ~11k
   recalibrates the level curve. Recommendation: pay ordinary XP, check the curve after slice 5.
3. **Do contest-due items appear on Today?** Computable without the dataset. Recommendation: no,
   not initially — the daily plan's finishability caps exist for a reason.

---

## Rules that bit during V13 — do not relearn these

- **⛔ Never join ZeroTrac to this repo on a number.** Its `ID` is LeetCode's *frontend* id;
  `leetcode-catalog.json` stores the *internal* one. They differ for **2561/2561** records. Slug
  only. A test guards it.
- **The catalog has no topic tags** — `/api/problems/all/` does not serve them. Tags come from the
  GraphQL `problemsetQuestionList` snapshot, which also supplies the frontend id as a second
  agreeing source.
- **A Q5 exists.** Weekly Contest 68 ran five problems, so the problem index is a number, not a
  `Q1|Q2|Q3|Q4` union. The original spec assumed four and would have hard-failed ingestion.
- **Dictionary encoding is not optional** — 1,232.9 kB naive vs 336.5 kB encoded.
- **`contestSlice` is unpersisted**, so widening its shape costs no migration. `contestsSlice`
  *is* persisted and takes the optional-with-boundary-default treatment.
- Generator warnings about titles differing from the curriculum (e.g. #144, #276, #358, #454) are
  **expected** — LeetCode renamed those problems and the alias system already handles it. They are
  warnings, not errors, and are how identity drift would first surface.
- `npm run fetch:contest-data` hits the network; it is engineering-time only and must never be
  invoked from tests or runtime.

## Rules that bit during V6–V12 — still standing

- **A layout that only works above a height it cannot control is a layout bug.** Verify at ~590px
  effective height (150 %-scaled 1080p), not just 720/800.
- **`overflow-y: auto` computes `overflow-x` to `auto`** — an inner scroll region turns 1px of
  horizontal overflow into a drawn horizontal scrollbar. Prefer removing the region.
- **Git Bash mangles `/route` args into filesystem paths** — use `MSYS_NO_PATHCONV=1` when passing
  routes to node CLIs.
- **Pushing this repo needs the credential override** (the global `gh` config routes github.com to
  the professional account, which only has read here):
  ```powershell
  git -c "credential.https://github.com.helper=" -c "credential.helper=" -c "credential.helper=manager" push origin <branch>
  ```
- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; passes solo.
  A contended full run can produce ~3 timeout-shaped failures; a clean run is green.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit messages
  via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Hand-built `QuestionProgress` fixtures must carry every required field or `validatePersisted`
  quarantines the whole payload — build from `initialProgress()`.
- Adding an import of `@/data/mlTracks`, `@/data/mlProjects`, `@/data/contestLibrary` or
  `@/utils/engine/insights` to `store/selectors.ts` or `store/actions.ts` silently puts a large
  chunk back on the app bundle.
- `overflow` clips absolutely-positioned descendants ONLY when the scroll container is their
  containing block — `main` and `Panel` keep `relative`.
- Radix `TabsContent` is `display:block`; `[hidden]` is UA-origin, so any author `display` un-hides
  inactive panels. Use `data-[state=active]:flex` if ever needed.
- `Screen` collides with the DOM global `Screen` type — a missing import reads as "cannot be used
  as a JSX component".
- jsdom does not hide closed `<details>` content and `<summary>` has no `button` role — assert the
  `open` attribute (`familyPanel.test.tsx` is the worked example).
- `text-muted-foreground/80` fails AA on the light theme; full-alpha `muted-foreground` is the
  floor for small text.

## Known limitations carried forward

- `button.tsx` ships `h-10` default / `h-9` small (40/36px). Both clear WCAG 2.2 AA's 24×24
  minimum; neither reaches the 44px AAA/HIG figure, and `size="sm"` has ~68 call sites. Moving the
  scale is a design decision awaiting a call, not an open bug.
- **No CI and no linter.** Every quality gate exists (`npm test`, `npx tsc --noEmit`,
  `npm run build`, `npm run validate:data`) and none runs automatically. See `report.md` §16.1.
- The dataset's own estimates imply ~7 h/day at the default 8-questions-per-day pace against a
  180-minute default capacity. Absorbed by the capacity chips by design, but "68 days" is slice
  arithmetic, not a keepable schedule (`report.md` §16.3).

## The law books

`CLAUDE.md` (architecture law — now carries the contest-library section and its invariants),
`PRODUCT.md` (locked product truth), `DESIGN.md` (visual system + the mandatory composition
contract + § The scroll contract), `report.md` (a measured audit of the whole repo), and the
design records under `docs/superpowers/specs/` — V6 practice engine, V7 adaptive mastery, V8
performance engine, V9 composed interface, V10 zero-scroll (superseded by) V11 flowing
application, and **V13 contest intelligence, which is the active plan**.
