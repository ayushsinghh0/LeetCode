# HANDOFF — V13 Contest Intelligence, PAUSED after slice 6 (2026-08-20)

## Read this first, then start

**Branch: `v13-contest-intelligence`** (pushed to origin; `main` is at `43eecf4`, untouched).
**State: everything except slice 7 is done.** The §63 acceptance journey works end to end, and
`/revision` now carries Contest Revision beside Standard. Work was deliberately paused here.

If you are resuming and just want to keep building, the whole instruction is:

> Continue V13 at slice 7 (mixed-pattern contest, "Recreate contest", progression polish). The
> plan is `docs/superpowers/specs/2026-08-19-contest-intelligence-design.md` §7.4 and §9; the
> implementation logs are §14 (slices 1–3), §15 (slice 4), §16 (slice 5), §17 (slice 6).
> Everything slice 7 needs already exists — see "Slice 7 groundwork".

```powershell
git checkout v13-contest-intelligence   # if not already on it
npm test                                # expect 91 files / 1,285 tests green
npx tsc --noEmit                        # expect clean
npm run build                           # expect app chunk ~294.91 kB (budget 301); data-contests 343.72 kB
```

---

## Where things stand

| | |
|---|---|
| Tests | **91 files / 1,285 passing** (V13 so far: +109 over the 1,176 baseline) |
| Type-check | clean |
| Build | clean; app chunk **294.91 kB** / 301 kB budget (**6.1 kB headroom**); `data-contests` 343.72 kB; `ContestRevision` its own 8.84 kB lazy chunk |
| `validate:data` | OK — `2561 rated problems, 2153 with a filterable AICM pattern, 207 bridged` |
| Browser QA | **done for slice 6** at 1280×590, light + dark: all four revision modes, no console errors, no horizontal scroll, the 16-row rail still fits without scrolling. Slices 4–5 remain browser-unverified (below). |
| Standard revision | **30 tests pass unmodified** — the acceptance condition for slice 6 |
| Full Contest | locked spec intact: the 62 pre-existing contest tests pass unmodified |

### Done (design record §14–§17 hold the detail)

| Slice | What landed |
|---|---|
| **0–3** | Pipeline, mapping table, engine (`engine/contestLibrary.ts`), generalized `selectContestSet`, slug-keyed `contestLibrarySlice`. |
| **4** | `/contest-practice` (nav: Contest Library): simple mode, advanced filters behind one Disclosure, always-visible count, pool-verified widening hint, 50-row fold, `<details>` rows, `?pattern=` two-way sync. |
| **5** | **The §63 journey.** Pattern CTA → preselected filter → seeded 4-problem filtered contest → ContestPage's clock → verdict → evidence banked pattern-level. Library solves: slug register + ordinary `SOLVE_XP` once, no day log. |
| **6** | **Contest Revision.** `/revision` gains Standard · Contest · Weak areas · Pattern; three pools over the one `scoreRevisionCandidates`; due list split from the practice list and **frozen for the sitting**; `reviseLibraryProblem` thunk; conservative band reading with its sample size in the rail. Fixed three defects — see below. |

### Remaining

| Slice | Work | Est. | Where to look |
|---|---|---|---|
| **7** | Mixed-pattern contest (weak-areas draw via `selectPatternWeakness` at the page call site, `distinctPatterns: false`), "Recreate contest" (`distinctContests: false` over one contest's own Q1–Q4 — `index.byContest` already exists), progression polish (band recommendation on the library page; the day-active question). | 0.5–1 d | design record §7.4, §17.5 |

### Open decisions (none blocking; all recorded)

1. **`leetcodeId` correction** (§10.1) — every stored `Question.leetcodeId` is LeetCode's INTERNAL
   id. Untouched, unchanged recommendation: fix in the catalog fetcher as its own commit.
2. **XP for library solves — DECIDED in slice 5** (§16.1): ordinary `SOLVE_XP` once, no day log.
   **Library reviews — DECIDED in slice 6** (§17.1): `revisionXp(difficulty)` on pass and fail, no
   day log. Follow-up: check the level curve after real usage.
3. **Contest work on Today** (§10.3) — still no. Revisit after usage.
4. **Do library solves mark the day active?** (§16.3) Currently they don't (no streak/heatmap).
   `mlActivityByDate`'s derived-merge is the pattern if the product wants it. Product call.

---

## The three defects slice 6 found — read these before writing anything similar

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

The first two were found by **running the app in a browser**, not by the suite. That is the
argument for doing the browser pass before calling a slice done.

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
- **The dataset's only permitted static importers are `ContestPracticePage` and `ContestRevision`.**
  `ContestPage`, `store/selectors.ts`, `store/actions.ts` and `RevisionPage` must all stay clear.
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

## QA debt (carry to next session)

- **Slices 4–5 are still browser-unverified.** Verify at 1280×590 in BOTH themes:
  `/contest-practice` (row breakpoints 375/768/1280, the fold, the Disclosure, Start-disabled
  states), the pattern-page CTA, and a filtered sitting on `/contest` (rating tooltip, Why-this-
  problem latch, premium marker, library second-look link).
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
- `questionCard.test.tsx` markdown-preview timeout is a documented under-load flake; passes solo.
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

`CLAUDE.md` (architecture law — the contest-library section reflects slices 0–6), `PRODUCT.md`
(locked product truth), `DESIGN.md` (visual system + mandatory composition contract),
`report.md` (repo audit), and the design records under `docs/superpowers/specs/` — with
**2026-08-19-contest-intelligence-design.md the active plan; §14/§15/§16/§17 are its
implementation logs for slices 1–3 / 4 / 5 / 6.**
