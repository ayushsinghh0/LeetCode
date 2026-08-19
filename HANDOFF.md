# HANDOFF — V13 Contest Intelligence, PAUSED after slices 0–5 (2026-08-20)

## Read this first, then start

**Branch: `v13-contest-intelligence`** (pushed to origin; `main` is at `43eecf4`, untouched).
**State: the §63 acceptance journey WORKS end to end** — pattern CTA → preselected library filter
→ Start contest → filtered sitting on ContestPage's clock → verdict → evidence banked. Work was
deliberately paused here; slices 6–7 remain.

If you are resuming and just want to keep building, the whole instruction is:

> Continue V13 at slice 6 (Contest Revision). The plan is
> `docs/superpowers/specs/2026-08-19-contest-intelligence-design.md` §7.3 (surface) and §9
> (sequence); the implementation logs are §14 (slices 1–3), §15 (slice 4), §16 (slice 5).
> Everything slice 6 needs already exists as tested pure functions — see "Slice 6 groundwork".

```powershell
git checkout v13-contest-intelligence   # if not already on it
npm test                                # expect 90 files / 1,267 tests green
npx tsc --noEmit                        # expect clean
npm run build                           # expect app chunk ~292.62 kB (budget 301); data-contests 343.72 kB
```

---

## Where things stand

| | |
|---|---|
| Tests | **90 files / 1,267 passing** (V13 so far: +91 over the 1,176 baseline) |
| Type-check | clean |
| Build | clean; app chunk **292.62 kB** / 301 kB budget (8.4 kB headroom); `data-contests` 343.72 kB; ContestPage chunk dataset-free (grep-verified) |
| `validate:data` | OK — `2561 rated problems, 2153 with a filterable AICM pattern, 207 bridged` |
| Design review | slices 4 AND 5 each went through a fresh-context finish review → fix-then-ship → all findings applied |
| Full Contest | locked spec intact: pre-existing contest suites pass unmodified; reviewer diff-verified behavioural identity |

### Done (design record §14–§16 hold the detail)

| Slice | What landed |
|---|---|
| **0–3** | Pipeline, mapping table, engine (`engine/contestLibrary.ts`), generalized `selectContestSet`, slug-keyed `contestLibrarySlice`. |
| **4** | `/contest-practice` (nav: Contest Library): simple mode (pattern + rating band), advanced filters behind one Disclosure, always-visible count, pool-verified widening hint, 50-row fold, `<details>` rows with full detail + rating tooltip + canonical links, `?pattern=` two-way sync, both progress registers behind one lookup. Sidebar `short:` rows 28→26px so 16 destinations fit 590px. |
| **5** | **The §63 journey.** Pattern-page CTA → preselected filter → Start contest (seeded `date\|filters`, count 4, distinct patterns/contests, unsolved-only pool) → filtered sitting runs on ContestPage via snapshot rows (`contestSlice.libraryProblems`) → verdict with library-aware second look → evidence banked pattern-level through `contestSittingRecorded` (no `problems` rows). Library solves: slug register + ordinary `SOLVE_XP` once, **no day log** (§10.2 decided). Bridged rows keep their ONE curriculum record end to end. |

### Remaining

| Slice | Work | Est. | Where to look |
|---|---|---|---|
| **6** | Revision page gains a mode selector (Standard · Contest · Weak areas · Pattern); Contest Revision composes from `scoreRevisionCandidates` + `dueContestSlugs`; conservative `recommendBand` shown with its sample size; grading a library review = new thunk over `contestProblemReviewed`. **Standard mode must stay byte-identical** — the 30 revision.test.tsx tests are the proof. | 1 d | design record §7.3, §6.1–6.2; engine exports are ALL already written and tested |
| **7** | Mixed-pattern contest (weak-areas draw via `selectPatternWeakness` at the page call site), "Recreate contest" (`distinctContests: false`, one contest's own Q1–Q4 — `index.byContest` already exists), progression polish (maybe: band recommendation on the library page; the day-active question below). | 0.5–1 d | design record §7.4, §14.3 note 5 |

### Open decisions (none blocking; all recorded)

1. **`leetcodeId` correction** (§10.1) — every stored `Question.leetcodeId` is LeetCode's INTERNAL
   id. Untouched, unchanged recommendation: fix in the catalog fetcher as its own commit.
2. **XP for library solves — DECIDED in slice 5** (§16.1): ordinary `SOLVE_XP` once, no day log,
   no daily-goal interaction. Follow-up: check the level curve after real usage.
3. **Contest work on Today** (§10.3) — still no. Revisit after usage.
4. **Do library solves mark the day active?** (new, §16.3) Currently they don't (no streak/
   heatmap). `mlActivityByDate`'s derived-merge is the pattern if the product wants it. Product
   call for slice 7 or later.

---

## Slice 6 groundwork (verified against the code — do not re-derive)

- **The engine is done.** `scoreRevisionCandidates({pool, progress, today, filter?, weakPatterns?})`
  returns ranked `{problem, score, reasons}` with render-ready reasons; `dueContestSlugs(bySlug,
  today)` needs no dataset; `recommendBand(evidence, current?)` returns `null` below
  `MIN_BAND_EVIDENCE` (4) and never advances more than one band. All tested.
- **Band evidence source:** `contestLibrary.bySlug` holds solved/attempted + ratings come from the
  dataset at the lazy page (solvedRatings/missedRatings composed at the call site — the store
  never touches the dataset).
- **Grading:** `contestLibrarySlice.contestProblemReviewed({slug, date, passed})` exists and is
  guarded (only solved problems review). Wrap it in a thunk in `store/actions.ts` (repo law); pay
  half-XP like question revisions? — PRODUCT's revision XP rule is for curriculum questions;
  DECIDE deliberately and record it (recommend: `revisionXp(difficulty)` for symmetry with §10.2's
  "ordinary path" ruling; no day-log write, same reasoning as solves).
- **The mode selector is additive.** RevisionPage's Standard flow (preview → frozen run →
  complete), `sessionSlice`, and every copy assertion stay untouched — put Contest mode behind a
  separate top-level state, not inside `buildRevisionSession`.
- **`selectionReason(problem, state, today, patternName?)`** is the "why this" line for revision
  candidates too (it was built for both).
- **The `interview` evidence-first draw reads `stalledIdsFromRecord`** — curriculum-only by
  construction (library sittings write no `problems` rows). Nothing to do; just don't "fix" it.

## Rules that bit during V13 — do not relearn these

- **⛔ Never join the two universes on a number.** ZeroTrac↔catalog: slug only (ids differ
  2561/2561). Live sitting: library rows carry sitting-local NEGATIVE ids; a positive id in
  `contestSlice` MEANS "curriculum question N" and routes real progress (`startFilteredContest`
  refuses anything else; store tests pin it). Persisted `ContestStallRecord.problems[].questionId`
  is curriculum-only — library sittings must keep omitting `problems`.
- **`ContestPage` must never import `@/data/contestLibrary`** (336 kB onto /contest). Everything a
  filtered sitting renders travels in `contestSlice.libraryProblems` snapshot rows — extend the
  row type, not the imports. Same rule as ever for `store/selectors.ts`/`actions.ts`.
- **`CONTEST_RATING_NOTE` lives in `engine/contestLibrary.ts`** (dataset-free) precisely so run
  surfaces can carry the basis tooltip; `@/data/contestLibrary` re-exports it.
- **A live sitting is a commitment**: `startFilteredContest` refuses while one runs; keep that
  refusal in any new start path (slice 7's Recreate contest included).
- **`attempted` is computed first; the stalled-pattern list trims to it** — a stored count must
  never overstate the sitting.
- **One sitting record per calendar date, first-write-wins** (`contestsSlice`) — existing policy,
  applies to filtered sittings too; do not fight it.
- The catalog has no topic tags; tags come from the GraphQL snapshot. A Q5 exists (Weekly 68).
  Dictionary encoding is mandatory. Generator title warnings (#144 #276 #358 #454) are expected.
  `npm run fetch:contest-data` is engineering-time only.
- **16 nav rows @ `short:` = 26px each** (`Sidebar.tsx`); a 17th destination breaks 590px again —
  re-do the arithmetic before adding one.

## QA debt (carry to next session)

- **Browser QA never ran for slices 4–5** — the Claude-in-Chrome extension was disconnected all
  session (OAuth token belongs to a different claude.ai account; fix: `/logout` + `/login` with
  matching accounts, or unset a stale `CLAUDE_CODE_OAUTH_TOKEN`). Both finish reviews were
  code-level (disclosed). Next browser session, verify at 1280×590 in BOTH themes:
  `/contest-practice` (row breakpoints 375/768/1280, the fold, the Disclosure, Start-disabled
  states), the pattern-page CTA, a filtered sitting on `/contest` (rating tooltip, Why-this-problem
  latch, premium marker, library second-look link), and that the 26px `short:` rail holds all
  sixteen destinations without scrolling.

## Rules that bit during V6–V12 — still standing

- Verify layouts at ~590px effective height (150%-scaled 1080p), not just 720/800.
- `overflow-y: auto` computes `overflow-x` to `auto` — prefer removing inner scroll regions.
- Git Bash mangles `/route` args — `MSYS_NO_PATHCONV=1` for node CLIs.
- **Pushing needs the credential override** (global gh config routes github.com to the
  professional account, which only has read here):
  ```powershell
  git -c "credential.https://github.com.helper=" -c "credential.helper=" -c "credential.helper=manager" push origin <branch>
  ```
- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx` markdown-preview timeout is a documented under-load flake; passes solo.
- Never edit source via PowerShell text replacement (mojibake); Edit tool only (a Node `fs` utf8
  script is fine for mechanical whitespace). Commit messages via `git commit -F <file>`.
  PowerShell chains with `;`, not `&&`.
- Hand-built progress fixtures must carry every required field (build from `initialProgress()`),
  and hand-built `ContestState` fixtures now need `libraryProblems: null`.
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

## The law books

`CLAUDE.md` (architecture law — the contest-library section reflects slices 0–5), `PRODUCT.md`
(locked product truth), `DESIGN.md` (visual system + mandatory composition contract),
`report.md` (repo audit), and the design records under `docs/superpowers/specs/` — with
**2026-08-19-contest-intelligence-design.md the active plan; §14/§15/§16 are its implementation
logs for slices 1–3 / 4 / 5.**
