# HANDOFF — V13 Contest Intelligence: ALL SLICES SHIPPED (2026-08-20)

> **⚡ V14→V15 IS IN FLIGHT (2026-08-20, branch `v14-revision-sheet`), PAUSED CLEANLY.**
> The governing document is the APPROVED master plan
> **`docs/superpowers/plans/2026-08-20-master-plan-v15.md`** — 13 phases / 48 tasks: audit
> (Part A), architecture + models (Part B), open questions (Part C), resume procedure
> (Part D + the B16 phase ledger). Its Phase 1 absorbs the earlier V14 execution plan
> (`2026-08-20-revision-sheet-integration.md`, still binding for step-level detail of
> T1.1–T1.12, with the A5 amendments).
> **State at pause:** groundwork committed (`5f36816` shared tag mapper + V14 plan;
> `66ad94c` sheet dataset generator + `src/data/revisionSheet.json`). Baseline 1,306 tests
> green. **Resume at Phase 0 T0.1** (re-run gates), then Phase 1 T1.1 (= V14 Task 2: types +
> decoder + `data-sheet` chunk + dataset tests). Everything below describes the V13 state
> this builds on.

## Read this first, then start

**Branch: `v13-contest-intelligence`** (`main` is at `43eecf4`, untouched).
**State: slices 0–7 are all implemented and green. V13 has ONE piece of outstanding debt:
slice 7 never had its browser pass** (the session's Chrome extension was paired to a browser on a
different machine, and the user chose to skip rather than re-pair). Everything else — the §63
journey, Contest Revision, the weak-areas contest, Recreate contest, the band reading — is done,
tested, and documented in the design record (§14–§19).

If you are resuming, the two candidate tasks, in order:

1. **Slice 7 browser QA** (small): `/contest-practice` at 1280×590 / 768 / 375 in both themes —
   the two header buttons (does the pair wrap acceptably at 375?), the weak-areas draw landing on
   `/contest`, Recreate from a row detail (original Q-order on the run page), the band reading
   line and its one-tap filter, light-theme contrast of the new text. Four of V13's five defects
   were browser-found; treat this as real verification, not a formality.
2. **The topic-wise revision sheet** (next feature): plan is
   `docs/superpowers/specs/2026-08-20-revision-sheet-design.md`, evidence is
   `revision-sheet-report.md` (`npm run report:revision-sheet` regenerates). Three questions need
   the user first (XP for sheet-only solves; the 134 non-LeetCode rows; one ambiguous title), and
   `/sheet` would be the **17th nav destination** — resolve the 590px rail arithmetic (16 rows @
   `short:` = 26px in `Sidebar.tsx`) before building the route.

```powershell
git checkout v13-contest-intelligence   # if not already on it
npx vitest run --no-file-parallelism    # expect 91 files / 1,306 tests green
npx tsc --noEmit                        # expect clean
npm run build                           # expect app chunk ~296.09 kB (budget 301); data-contests 343.72 kB
```

---

## Where things stand

| | |
|---|---|
| Tests | **91 files / 1,306 passing** (V13 total: +130 over the 1,176 baseline) |
| Type-check | clean |
| Build | clean; app chunk **296.09 kB** / 301 kB budget (**4.9 kB headroom**); `data-contests` 343.72 kB; `ContestRevision` / `ContestDue` / `ContestPracticePage` their own lazy chunks |
| `validate:data` | OK — checks `leetcodeId` against the FRONTEND id |
| Browser QA | done for slices 4–6 (design record §17.3, §18.1); **slice 7 outstanding — see above** |
| Standard revision | 30 tests pass unmodified |
| Full Contest | locked spec intact: the 62 pre-existing contest tests pass unmodified |
| Contest Revision | its suite passes **unmodified** after slice 7's band-evidence refactor |

### What shipped, by slice (design record §14–§19 hold the detail)

| Slice | What landed |
|---|---|
| **0–3** | Pipeline, mapping table, engine (`engine/contestLibrary.ts`), generalized `selectContestSet`, slug-keyed `contestLibrarySlice`. |
| **4** | `/contest-practice` (nav: Contest Library): simple mode, advanced filters, always-visible count, verified widening hint, 50-row fold, `?pattern=` two-way sync. |
| **5** | The §63 journey: pattern CTA → preselected filter → seeded 4-problem filtered contest → ContestPage's clock → verdict → evidence banked. |
| **6** | Contest Revision on `/revision` (Standard · Contest · Weak areas · Pattern), frozen due list, `reviseLibraryProblem`, conservative band reading in the rail. |
| **7** | **Weak-areas contest** (`selectPatternWeakness` at the page call site, `distinctPatterns: false`, disabled-not-hidden without evidence), **Recreate contest** (row detail → the contest's own Q1–Q4/Q5 in original order, solved rows included, `distinctContests: false`), **band reading on the Library page** (`bandEvidenceFromRegister` shared with Contest Revision, one-tap band filter, silent below threshold). Row-builder extracted once (`toCandidates`/`toRows`/`startSitting`); `WEAK_PATTERN_REASON` is the one weakness-selection sentence. |

### Decisions log (all closed; §18–§19)

`leetcodeId` = frontend id (237/528 were wrong). Library solves pay ordinary `SOLVE_XP` once, no
day log; library reviews pay `revisionXp` both ways, no day log. Contest reviews on Today behind
`settings.contestOnToday` (default on), rail-only, never in `rankWork`. Library work marks the day
active (derived). Weak draw ignores page filters. Recreation includes solved rows and is never
capped at `DRAW_COUNT`. The band reading is silent below threshold on the Library page — the
Contest Revision rail is the one surface that counts toward the threshold. The only thing left to
watch is the XP curve after real usage.

---

## Five defects the browser found in slices 0–6 — why the slice-7 pass matters

1. **⛔ `loadInitialState` never mapped `contestLibrary`** — live for three slices, all gates
   green, every library solve silently discarded on reload. Any new persisted channel needs a
   `loadInitialState` spread AND a `makeStore(loadInitialState(...))` boot-path test.
2. **The due list reshuffled under the learner** — Contest Revision now freezes membership and
   order per `date|mode|pattern`; any surface grading a due item must freeze its own list.
3. **`recommendBand` named a band as the step up from itself** at the top band.
4. **"Why this problem?" named the wrong pattern** — the stated reason must be the actual
   selection reason (slice 7's `reasonsFor` callbacks exist because of this).
5. **The row title was crushed at 375px** — the id column yields below `sm`.

## Slice-7 code map (for the QA pass or future work)

- `src/pages/ContestPracticePage.tsx` — all three entry points; `toCandidates`/`toRows`/
  `startSitting` are the shared builders; the band line sits under the Rating chips.
- `src/utils/engine/contestLibrary.ts` — `bandEvidenceFromRegister`, `WEAK_PATTERN_REASON`.
- `src/components/revision/ContestRevision.tsx` — now reads the shared band helper; nothing else
  changed.
- Tests: `src/pages/__tests__/contestPractice.test.tsx` (three new describes),
  `src/utils/engine/__tests__/contestLibrary.test.ts` (`bandEvidenceFromRegister`).

## Rules that bit during V13 — do not relearn these

- **⛔ Never join the two universes on a number.** ZeroTrac↔catalog: slug only (ids differ
  2561/2561). Live sitting: library rows carry sitting-local NEGATIVE ids; a positive id in
  `contestSlice` MEANS "curriculum question N". Persisted `ContestStallRecord.problems[]` is
  curriculum-only.
- **The dataset's only permitted static importers are `ContestPracticePage`, `ContestRevision`
  and `ContestDue`.** Verify after a build: `grep -l 'from"./contestLibrary-' dist/assets/*.js`.
  A chunk name in a `__vite__mapDeps` array is a dynamic-import dep list, not an import.
- **A bridged problem is graded through `reviseQuestion`, never `reviseLibraryProblem`.**
- **`attempted` is computed first; the stalled-pattern list trims to it.** One sitting record per
  calendar date, first-write-wins.
- The catalog has no topic tags; tags come from the GraphQL snapshot. A Q5 exists (Weekly 68 —
  and slice 7 pins that recreation carries it). Dictionary encoding is mandatory. Generator title
  warnings (#144 #276 #358 #454) are expected. `npm run fetch:contest-data` is engineering-time
  only.
- **16 nav rows @ `short:` = 26px each** (`Sidebar.tsx`); a 17th destination breaks 590px.

## QA recipes

- **The Chrome extension can be paired to a browser on ANOTHER machine.** Before driving it at a
  local dev server, check `list_connected_browsers` for `isLocal: true` (this session lost an
  hour to ERR_CONNECTION_REFUSED from a remote browser; a public-IP comparison settled it).
  The Vite dev server may bind IPv6-only (`[::1]:5173`) — `npx vite --host 127.0.0.1` pins it.
- Browser QA recipe that worked in prior sessions (in-app pane, when available):
  `preview_start {name:'dsa-roadmap-dev'}` → resize 1280×590 → seed
  `localStorage['dsa-roadmap:v1']` → navigate with `force:true` → drive via `javascript_tool`
  clicks by accessible name → measure layout with JS, never screenshots.

## Rules that bit during V6–V12 — still standing

- Verify layouts at ~590px effective height, not just 720/800.
- `overflow-y: auto` computes `overflow-x` to `auto` — prefer removing inner scroll regions.
- Git Bash mangles `/route` args — `MSYS_NO_PATHCONV=1` for node CLIs.
- **Pushing needs the credential override** (global gh config routes github.com to the
  professional account, which only has read here):
  ```powershell
  git -c "credential.https://github.com.helper=" -c "credential.helper=" -c "credential.helper=manager" push origin <branch>
  ```
- **Testing Library only detects *Jest's* fake timers.** Under plain `vi.useFakeTimers()` any test
  that awaits a query deadlocks; use `vi.useFakeTimers({ shouldAdvanceTime: true })` — see
  `contestRevision.test.tsx`.
- **The suite is load-sensitive.** Under full parallelism 1–2 varying async tests time out.
  Confirm with `npx vitest run --no-file-parallelism` before believing a failure. Give a new
  `findBy*` crossing a `lazy()` boundary `{ timeout: 5000 }`.
- Never edit source via PowerShell text replacement (mojibake); Edit tool only. Commit messages
  via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Hand-built progress fixtures build from `initialProgress()`; hand-built `ContestState` fixtures
  need `libraryProblems: null`.
- Imports of `@/data/mlTracks`, `@/data/mlProjects`, `@/data/contestLibrary` or
  `@/utils/engine/insights` in `selectors.ts`/`actions.ts` silently bloat the app chunk.
- jsdom keeps closed `<details>` content queryable — scope queries with `within(details)` (the
  slice-7 recreate tests do) and assert the `open` attribute.
- `text-muted-foreground/80` fails AA on light; full-alpha is the floor for small text.

## Known limitations carried forward

- `button.tsx` ships 40/36px controls; the 44px scale move awaits a design call.
- **No CI and no linter** — all four gates are manual. See `report.md` §16.1.
- Dataset estimates imply ~7h/day at the default pace; absorbed by capacity chips by design.
- App-chunk headroom is **4.9 kB**. Re-check `npm run build` whenever `actions.ts` or
  `selectors.ts` grows.

## The law books

`CLAUDE.md` (architecture law — the contest-library section reflects slices 0–7), `PRODUCT.md`
(locked product truth), `DESIGN.md` (visual system + mandatory composition contract), `report.md`
(repo audit), and the design records under `docs/superpowers/specs/` — with
**2026-08-19-contest-intelligence-design.md the completed V13 record (§14–§19 are the
implementation logs), and 2026-08-20-revision-sheet-design.md the next plan in the queue.**
