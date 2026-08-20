# HANDOFF — V13 Contest Intelligence, PAUSED before slice 7 (2026-08-20)

## Read this first, then start

**Branch: `v13-contest-intelligence`** (pushed to origin; `main` is at `43eecf4`, untouched).
**State: slice 7 is the only thing left, and nothing else is outstanding.** The §63 journey works
end to end, `/revision` carries Contest Revision beside an untouched Standard, the slice-4/5 browser
QA debt is cleared, and all four open decisions are decided and implemented. Paused deliberately.

If you are resuming and just want to keep building, the whole instruction is:

> Continue V13 at slice 7 (mixed-pattern contest, "Recreate contest", progression polish). The
> plan is `docs/superpowers/specs/2026-08-19-contest-intelligence-design.md` §7.4 and §9; the
> implementation logs are §14 (slices 1–3), §15 (slice 4), §16 (slice 5), §17 (slice 6).
> Everything slice 7 needs already exists — see "Slice 7 groundwork".

```powershell
git checkout v13-contest-intelligence   # if not already on it
npm test                                # expect 91 files / 1,295 tests green
npx tsc --noEmit                        # expect clean
npm run build                           # expect app chunk ~295.80 kB (budget 301); data-contests 343.72 kB
```

---

## Where things stand

| | |
|---|---|
| Tests | **91 files / 1,295 passing** (V13 so far: +119 over the 1,176 baseline) |
| Type-check | clean |
| Build | clean; app chunk **295.80 kB** / 301 kB budget (**5.2 kB headroom**); `data-contests` 343.72 kB; `ContestRevision` 8.97 kB and `ContestDue` 1.43 kB as their own lazy chunks |
| `validate:data` | OK — and now checks `leetcodeId` against the FRONTEND id, not the catalog's internal one |
| Browser QA | **done for slices 4, 5 and 6**, at 1280/768/375 in both themes — see design record §17.3 and §18.1. No QA debt outstanding. |
| Standard revision | **30 tests pass unmodified** — the acceptance condition for slice 6 |
| Full Contest | locked spec intact: the 62 pre-existing contest tests pass unmodified |

### Done (design record §14–§18 hold the detail)

| Slice | What landed |
|---|---|
| **0–3** | Pipeline, mapping table, engine (`engine/contestLibrary.ts`), generalized `selectContestSet`, slug-keyed `contestLibrarySlice`. |
| **4** | `/contest-practice` (nav: Contest Library): simple mode, advanced filters behind one Disclosure, always-visible count, pool-verified widening hint, 50-row fold, `<details>` rows, `?pattern=` two-way sync. |
| **5** | **The §63 journey.** Pattern CTA → preselected filter → seeded 4-problem filtered contest → ContestPage's clock → verdict → evidence banked pattern-level. Library solves: slug register + ordinary `SOLVE_XP` once, no day log. |
| **6** | **Contest Revision.** `/revision` gains Standard · Contest · Weak areas · Pattern; three pools over the one `scoreRevisionCandidates`; due list split from the practice list and **frozen for the sitting**; `reviseLibraryProblem` thunk; conservative band reading with its sample size in the rail. Fixed three defects — see below. |

### Remaining

| Slice | Work | Est. | Where to look |
|---|---|---|---|
| **7** | Mixed-pattern contest (weak-areas draw via `selectPatternWeakness` at the page call site, `distinctPatterns: false`), "Recreate contest" (`distinctContests: false` over one contest's own Q1–Q4 — `index.byContest` already exists), progression polish (band recommendation on the library page). | 0.5–1 d | design record §7.4, §17.5 |

### Queued behind V13 — the topic-wise revision sheet

A 1,210-row curated sheet (23 topics, 99 sub-topics) was resolved offline against the committed
snapshots on 2026-08-20. **`revision-sheet-report.md`** is the evidence (every problem, LeetCode id
and link, topic-wise); **`docs/superpowers/specs/2026-08-20-revision-sheet-design.md`** is the
plan. Regenerate with `npm run report:revision-sheet`.

The measurement that shaped the plan: **857 of its 1,016 unique LeetCode problems (84%) are
already in this repo**, so it becomes a *lens* over the two existing universes plus 159 additions —
no third universe, no third register. ~2.5–3 days, four slices, **after slice 7**. Three questions
need the user's answer first (XP for sheet-only solves; what to do with the 134 non-LeetCode rows;
one ambiguous title), and `/sheet` would be the **17th nav destination** — resolve the 590px rail
arithmetic before building the route, not after.

### Open decisions — ALL FOUR ARE CLOSED (2026-08-20)

Nothing here is waiting on anyone. Kept as a record of what was decided and why (design record §18).

1. **`leetcodeId`** (§10.1) — **DONE.** It is now the FRONTEND id, resolved by slug from the topics
   snapshot; 237 of 528 were wrong. Offline, 528/528 coverage, build fails rather than falling back.
2. **XP for library solves** (§16.1) — ordinary `SOLVE_XP` once, no day log. **Library reviews**
   (§17.1) — `revisionXp(difficulty)` on pass and fail, no day log. Follow-up: check the level
   curve after real usage; that is an observation, not an open question.
3. **Contest work on Today** (§10.3) — **YES, behind `settings.contestOnToday` (default on)**, as a
   rail block that is never in `rankWork`, never in the day's counts, and does not grade.
4. **Do library solves mark the day active?** (§16.3) — **YES**, derived via
   `contestLibraryActivityByDate` → `selectOtherTrackActivityByDate`. `DayLog` still gains nothing.

The only thing left to watch is the XP curve after real usage.

---

## Five defects the browser found — read these before writing anything similar

1. **⛔ `loadInitialState` never mapped `contestLibrary`.** A slice-3 bug, live for three slices.
   The write path was complete and `stateImported` restored it, so `contestLibrarySlice.test.ts`
   was green — but that file tests the **import** path, and the path a real learner hits is
   **boot**. Every library solve was saved and then silently discarded on the next page load, with
   all four gates passing. Fixed, plus a boot-path round-trip test. **Any new persisted channel
   needs a `loadInitialState` spread AND a `makeStore(loadInitialState(...))` test.**
2. **The due list reshuffled under the learner.** Grading pushes the ladder date out, so the graded
   row stopped being due and vanished mid-sitting — the exact failure `sessionSlice.frozen` exists
   to prevent. Contest Revision now freezes membership *and* order, keyed by `date|mode|pattern`.
3. **`recommendBand` named a band as the step up from itself** at the top band (the clamp holds
   `band` at `comfortable` while `step` is still 1). The wording now follows whether the band
   actually moved.

4. **"Why this problem?" named the wrong pattern.** The draw passed `aicmPatterns[0]`, so a
   two-pointers contest explained a problem tagged
   `['bitwise-manipulation','modified-binary-search','two-pointers']` with *"Bitwise
   Manipulation"* — a stated reason unrelated to the actual selection. Both the draw and Contest
   Revision's Pattern mode now name the scoped pattern.
5. **The row title was crushed at 375px** (111px, ~12 characters) by fixed id and status columns.
   The `aria-hidden` id column now yields below `sm`.

Four of these five were found by **running the app in a browser**, not by the suite — including one
that had been silently destroying saved data for three slices. Do the browser pass before calling a
slice done.

## Slice 7 groundwork (verified against the code — do not re-derive)

- **`selectContestSet(pool, plan, seed)` already takes everything slice 7 needs.**
  `distinctPatterns: false` gives the mixed-pattern draw; `distinctContests: false` plus a pool
  filtered to one `contest.slug` gives "Recreate contest". No engine change should be required.
- **`ContestPracticePage.startContestFromFilters` is the row builder to reuse**, not to copy. If
  slice 7 needs a second entry point, extract the `FilteredContestProblem` mapping rather than
  writing it twice — the negative-id rule and `selectionReason` wiring both live in it.
- **`index.byContest` is already built** by `buildContestIndex` (contest slug → member slugs).
- **A live sitting is a commitment**: `startFilteredContest` refuses while one runs. Keep that
  refusal in any new start path.
- **Weak patterns resolve at the page's call site**, never in the store — `selectPatternWeakness`
  returns `{id, name, score, signals, summary}`, and only `exact`/`strong` mappings may satisfy an
  `aicmPatterns` filter (that is the default; do not pass `includeInferredPatterns`).

## Rules that bit during V13 — do not relearn these

- **⛔ Never join the two universes on a number.** ZeroTrac↔catalog: slug only (ids differ
  2561/2561). Live sitting: library rows carry sitting-local NEGATIVE ids; a positive id in
  `contestSlice` MEANS "curriculum question N" and routes real progress. Persisted
  `ContestStallRecord.problems[].questionId` is curriculum-only — library sittings omit `problems`.
- **The dataset's only permitted static importers are `ContestPracticePage`, `ContestRevision` and
  `ContestDue`.** `ContestPage`, `store/selectors.ts`, `store/actions.ts`, `RevisionPage` and
  `TodayPage` must all stay clear — the last two reach their island through `lazy()`.
  Verify after a build: `grep -l 'from"./contestLibrary-*.js"' dist/assets/*.js`. A chunk name
  appearing in a `__vite__mapDeps` array is a dynamic-import dep list, not an import.
- **A bridged problem is graded through `reviseQuestion`, never `reviseLibraryProblem`.** One
  problem, one identity, one record.
- **`CONTEST_RATING_NOTE` lives in `engine/contestLibrary.ts`** (dataset-free) so run surfaces can
  carry the basis tooltip; `@/data/contestLibrary` re-exports it.
- **`attempted` is computed first; the stalled-pattern list trims to it.**
- **One sitting record per calendar date, first-write-wins** (`contestsSlice`).
- The catalog has no topic tags; tags come from the GraphQL snapshot. A Q5 exists (Weekly 68).
  Dictionary encoding is mandatory. Generator title warnings (#144 #276 #358 #454) are expected.
  `npm run fetch:contest-data` is engineering-time only.
- **16 nav rows @ `short:` = 26px each** (`Sidebar.tsx`); a 17th destination breaks 590px again.

## QA debt

**None.** Slices 4, 5 and 6 have all had a browser pass (design record §17.3, §18.1).

- **Browser QA recipe that works** (the extension was broken last session; the in-app Browser pane
  is not): `preview_start {name:'dsa-roadmap-dev'}` → `resize_window 1280×590` → seed state by
  writing a `PersistedStateV1` to `localStorage['dsa-roadmap:v1']` and then **navigating with
  `force:true`** (an in-page `location.replace` does not always take, and the running store will
  clobber the seed on its next save). Drive controls with `javascript_tool` clicks by accessible
  name — `computer` ref→coordinate mapping is off in this pane. Measure layout with JS, never from
  a screenshot (screenshots are downscaled and unreadable above ~487px).

## Rules that bit during V6–V12 — still standing

- Verify layouts at ~590px effective height (150%-scaled 1080p), not just 720/800.
- `overflow-y: auto` computes `overflow-x` to `auto` — prefer removing inner scroll regions.
- Git Bash mangles `/route` args — `MSYS_NO_PATHCONV=1` for node CLIs.
- **Pushing needs the credential override** (global gh config routes github.com to the
  professional account, which only has read here):
  ```powershell
  git -c "credential.https://github.com.helper=" -c "credential.helper=" -c "credential.helper=manager" push origin <branch>
  ```
- **Testing Library only detects *Jest's* fake timers.** Under a plain `vi.useFakeTimers()` its
  `waitFor`/`findBy*` polls with a mocked `setInterval` that nothing advances, so any test that
  awaits a query **deadlocks instead of failing**. Use `vi.useFakeTimers({ shouldAdvanceTime: true })`
  when a test both pins the date and awaits — see `contestRevision.test.tsx`.
- A "failed" background agent may have finished its work — `git status` before assuming loss.
- **The suite is load-sensitive, and it is broader than one file.** Under full parallel execution
  a small, *varying* set of async tests times out — `questionCard`'s markdown preview,
  `routes.test.tsx`'s lazy mounts, `contestRevision`'s lazy boundary. Every one passes solo.
  Confirm a green suite with `npx vitest run --no-file-parallelism` before believing a failure
  (measured 2026-08-20: 91 files / 1,295 passing, 0 failed serially; 1–2 spurious failures per
  parallel run). Give a new `findBy*` that crosses a `lazy()` boundary an explicit
  `{ timeout: 5000 }` — a generous timeout, never a weakened assertion.
- Never edit source via PowerShell text replacement (mojibake); Edit tool only (a Node/Python utf8
  script is fine for mechanical replacement). Commit messages via `git commit -F <file>`.
  PowerShell chains with `;`, not `&&`.
- Hand-built progress fixtures must carry every required field (build from `initialProgress()`),
  and hand-built `ContestState` fixtures need `libraryProblems: null`.
- Imports of `@/data/mlTracks`, `@/data/mlProjects`, `@/data/contestLibrary` or
  `@/utils/engine/insights` in `selectors.ts`/`actions.ts` silently bloat the app chunk.
- `overflow` clips absolutely-positioned descendants only when the scroll container is their
  containing block — `main` and `Panel` keep `relative`.
- Radix `TabsContent`: use `data-[state=active]:flex`, never a bare author `display`.
- `Screen` collides with the DOM global type — a missing import reads as "cannot be used as JSX".
- jsdom keeps closed `<details>` content queryable and `<summary>` has no button role — assert the
  `open` attribute; `fireEvent.click` on a summary DOES toggle it.
- `text-muted-foreground/80` fails AA on light; full-alpha is the floor for small text.

## Known limitations carried forward

- `button.tsx` ships 40/36px controls; the 44px scale move awaits a design call (~68 `sm` sites).
- **No CI and no linter** — all four gates (`npm test`, `npx tsc --noEmit`, `npm run build`,
  `npm run validate:data`) are manual. See `report.md` §16.1.
- Dataset estimates imply ~7h/day at the default pace; absorbed by capacity chips by design.
- App-chunk headroom is down to **6.1 kB**. Re-check `npm run build` whenever `actions.ts` or
  `selectors.ts` grows.

## The law books

`CLAUDE.md` (architecture law — the contest-library section reflects slices 0–6 plus §18), `PRODUCT.md`
(locked product truth), `DESIGN.md` (visual system + mandatory composition contract),
`report.md` (repo audit), and the design records under `docs/superpowers/specs/` — with
**2026-08-19-contest-intelligence-design.md the active plan; §14/§15/§16/§17 are its
implementation logs for slices 1–3 / 4 / 5 / 6, and §18 closes the outstanding items.**
