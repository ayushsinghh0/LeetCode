# HANDOFF — V15 Phase 1 (the revision sheet) SHIPPED · resume at Phase 2 (2026-08-22)

> **The governing document is the approved master plan
> `docs/superpowers/plans/2026-08-20-master-plan-v15.md`** — 13 phases / 48 tasks, ledger in
> §B16. **Phases 0–1 are complete and ticked.** Phase 1 absorbed the V14 execution plan
> (`2026-08-20-revision-sheet-integration.md`, whose per-task checkboxes are the step-level
> record), with the A5 amendments (`selfReported` provenance, band-evidence guard, verified
> external links). The design record is
> `docs/superpowers/specs/2026-08-20-revision-sheet-design.md` — §8 is the implementation log,
> D1–D10 as shipped.
>
> **Resume at Phase 2 T2.1** (`engine/capability.ts`, the pattern-mastery READER per master
> plan §B5) — but note OQ-3 (mastery thresholds) should be confirmed with the user before
> Phase 2's copy lands, and OQ-6 is already discharged (absent `selfReported` = sitting-made).

## Read this first, then start

**Branch: `v14-revision-sheet`** (`main` is at `7240a10`, untouched — the branch holds Phase 0–1
plus the plan docs). Working tree clean; every task landed as its own commit with the suite green.

```powershell
git checkout v14-revision-sheet
npx vitest run --no-file-parallelism    # expect 94 files / 1,359 tests green
npx tsc --noEmit                        # expect clean
npm run validate:data                   # OK — now also validates the sheet + external-links
npm run build                           # app chunk 296.73 kB (budget 301); data-sheet 53.9 kB
```

## Where things stand

| | |
|---|---|
| Tests | **94 files / 1,359 passing** (+53 over V13's 1,306 baseline) |
| Type-check | clean |
| Build | app chunk **296.73 kB** / 301 budget (~4.3 kB headroom); `data-sheet` **53.91 kB** new; `data-contests` 343.72 kB unchanged |
| `validate:data` | OK — sheet section (1,210 rows partitioned, exclusion, 9-column rule) + external-links closed world |
| Chunk imports | `data-sheet` is imported by the shared decoder chunk (`contestLibrary-*.js`), whose importers are exactly ContestDue/ContestPracticePage/ContestRevision — the three permitted surfaces and nothing else |
| Locked specs | 62 contest tests, Standard Revision's 30, Contest Revision's suite — all pass **unmodified** |
| Browser QA | **not run for Phase 1** (deliberate: master plan Phase 11 is the one real pass); V13 slice 7's pass is still outstanding debt too |

### What Phase 1 shipped (T1.1–T1.13, one commit each)

- **T1.1** types + `src/data/revisionSheet.ts` decoder (the dataset's only door, imports no
  other dataset) + `data-sheet` chunk pin + 16 dataset tests.
- **T1.2** `validate:data` sheet section — artifact re-check independent of the generator;
  sheet-only slugs in NEITHER universe; exactly-9-column sheetProblems rows.
- **T1.3** `scoreRevisionFacts` extracted from `scoreRevisionCandidates` — the one revision
  scorer's universe-agnostic core; 65 tests unmodified (pure refactor).
- **T1.4** `engine/revisionSheet.ts`: `sheetEntry` / `sheetStats` / `selectSheetRevision` with
  THE structural exclusion (roadmap rows out of draws unless `includeRoadmap`) in the draw
  itself, never a UI filter.
- **T1.5** `ContestProblemProgress.selfReported?: true` (A5.1): stamped by direct solves, never
  by sittings; a later TIMED solve clears it; lenient validator; round-tripped through BOTH
  read paths (import + boot) with a pre-V15 fixture. Plus `solveSheetProblem` — the sheet's one
  direct write (ordinary SOLVE_XP once per slug = OQ-2 default, no day log, idempotent).
- **T1.6** `bandEvidenceFromRegister` skips self-reported records entirely; both band surfaces
  state their basis ("timed contest practice only…").
- **T1.7** `FilteredContestProblem.contestRating: number | null`; ContestPage renders absence.
- **T1.8** the sheet as `?view=sheet` on `/contest-practice` (D4: no 17th nav destination):
  `SheetView` topic disclosures, Mark solved on non-curriculum rows only, curriculum rows are
  references (`View in curriculum`), timed sub-topic sets (`distinctPatterns: false` — a
  sub-topic IS one theme; the negative-id rule extended to sheet-only entries).
- **T1.9** fifth **Sheet** mode on `/revision`: topic Select + roadmap toggle, frozen due list
  keyed `date|sheet|topic|toggle`, curriculum grades via `reviseQuestion`, deep links
  `?mode=sheet&topic=` (one-way at mount).
- **T1.10** ContestDue → **"Practice reviews"**, resolving due slugs against both datasets;
  sheet rows honestly unrated. (The gating setting keeps its `contestOnToday` key/label — a
  recorded naming seam.)
- **T1.11** report: 7-state partition of all 1,210 rows (script-throws if it stops summing),
  compact Contest column, Data model / Validation / Known limitations / Next steps sections.
- **T1.12** docs (CLAUDE.md sheet section; design record §8; this file) + full gates.
- **T1.13** `scripts/data/external-links.json` (ships EMPTY): hand-verified https links for
  external rows; fabricated entries fail generator AND validator (both proven live); unlisted
  rows stay unlinked; `SheetRowItem` unit-tests the linked/unlinked branches.

### Open items for the user (unchanged decisions, awaiting confirmation)

1. **OQ-2 / D1 (XP for sheet ticks)** — shipped the default: ordinary SOLVE_XP once per slug.
   Alternative (half/zero XP for `selfReported`) is one constant in one thunk, no migration.
2. **D3 / OQ-1 ("Beautiful Numbers")** — still AMBIGUOUS; say which problem and it becomes a
   one-line alias in `resolve-revision-sheet.mjs`.
3. **OQ-3 (mastery thresholds)** — needed before Phase 2 lands copy; recommendation is the
   codebase's own precedents (MIN_SAMPLES 5, MIN_BAND_EVIDENCE 4, weakness MIN_OBSERVATIONS).
4. **D8 naming seam** — the Settings toggle still reads "Contest reviews on Today" while the
   block it gates is now "Practice reviews".

## Rules that bit during V13/V14 — do not relearn these

- **⛔ Never join the two universes on a number** (slug only; ids differ 2561/2561). Library
  rows in a sitting carry NEGATIVE ids; positive id = curriculum question N. SheetView extends
  this: a sheet-only entry gets a negative ordinal too.
- **The register means "non-curriculum problems on the one ladder" now**, not "contest
  problems" — and `selfReported` is what keeps untimed ticks out of the band/mastery evidence.
  Absent = sitting-made (historically exact; no direct-solve path existed before V15).
- **Any surface grading a due item freezes its own list** — Sheet mode froze membership AND
  order from day one (`date|sheet|topic|toggle`).
- **A validator stricter than its own write path is a data-loss bug** — `selfReported: false`
  is dropped, not quarantined; a non-boolean rejects.
- **Bundle law**: `store/selectors.ts` / `store/actions.ts` never import `@/data/revisionSheet`
  or `@/data/contestLibrary`. After `npm run build`:
  `grep -l 'from"./contestLibrary-' dist/assets/*.js` → exactly three files, and
  `grep -l 'from"./data-sheet-' dist/assets/*.js` → the shared `contestLibrary-*.js` decoder
  chunk alone, whose own importers are those same three (a `__vite__mapDeps` mention in the app
  chunk is a preload list, not an import).
- **Testing Library only detects Jest's fake timers** — `vi.useFakeTimers({ shouldAdvanceTime:
  true })` for anything awaiting a lazy boundary; `findBy*` across `lazy()` gets
  `{ timeout: 5000 }`.
- **The suite is load-sensitive**: confirm any failure with `--no-file-parallelism` and a
  re-run before believing it (Phase 0 hit exactly one such flake).
- Never edit source via PowerShell text replacement (mojibake); Edit tool only. Commit via
  `git commit -F <file>`. PowerShell chains with `;`.
- **Pushing needs the credential override** (global gh config routes github.com to the
  professional account, which only has read here):
  ```powershell
  git -c "credential.https://github.com.helper=" -c "credential.helper=" -c "credential.helper=manager" push origin <branch>
  ```

## Known limitations carried forward

- `button.tsx` ships 40/36px controls; the 44px move awaits a design call.
- **No CI and no linter** — all four gates are manual.
- App-chunk headroom is ~4.3 kB. Re-check `npm run build` whenever `actions.ts`/`selectors.ts`
  grows (Phase 2 adds `selectPatternCapability` there — watch it).
- V13 slice 7 browser QA never ran; Phase 11 covers it.
- The sheet's Due list in Sheet mode has no fold (the contest modes fold at 8) — fine at
  current volumes, revisit if all-topics due counts grow.

## The law books

`CLAUDE.md` (architecture law — now including the revision-sheet section), `PRODUCT.md`,
`DESIGN.md`, `report.md`, and under `docs/superpowers/`: the **master plan**
(`plans/2026-08-20-master-plan-v15.md`, THE governing document, ledger §B16), the V14 step
record (`plans/2026-08-20-revision-sheet-integration.md`), and the design records in `specs/`
(`2026-08-20-revision-sheet-design.md` §8 is Phase 1's log;
`2026-08-19-contest-intelligence-design.md` is V13's).
