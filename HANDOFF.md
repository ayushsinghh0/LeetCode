# HANDOFF — V13 Contest Intelligence, slices 0–4 shipped (2026-08-20)

## Read this first, then start

**Branch: `v13-contest-intelligence`** (`main` is at `43eecf4`, untouched).
**State: the foundation AND the first user-facing surface exist. `/contest-practice` ships; the
§63 journey (CTA → filtered contest → evidence) does not yet.**

If you are resuming and just want to keep building, the whole instruction is:

> Continue V13 at slice 5. The plan is `docs/superpowers/specs/2026-08-19-contest-intelligence-design.md`
> §7 (surfaces) and §9 (sequence); the implementation logs are §14 (slices 1–3) and §15 (slice 4).
> The slice-5 groundwork notes below were verified against the code this session — start from them.

```powershell
git checkout v13-contest-intelligence   # if not already on it
npm test                                # expect 87 files / 1,252 tests green
npx tsc --noEmit                        # expect clean
npm run build                           # expect app chunk ~290.23 kB (budget 301); data-contests 343.72 kB
```

---

## Where things stand

| | |
|---|---|
| Tests | **87 files / 1,252 passing** (V13 so far: +76 over the 1,176 baseline) |
| Type-check | clean |
| Build | clean; app chunk **290.23 kB** against the 301 kB budget; **`data-contests` now fills at 343.72 kB** (it was the empty-chunk status line of the last handoff; slice 4 retired it) |
| `validate:data` | OK — `2561 rated problems, 2153 with a filterable AICM pattern, 207 bridged` |
| Design review | slice 4 went through a fresh-context finish review: fix-then-ship (1 material, 6 minor) → all fixed → **ship** |

### Done

| Slice | What landed |
|---|---|
| **0 Measurement** | ZeroTrac format, catalog coverage, curriculum overlap, encoding size. Design record §13. |
| **1 Pipeline** | Fetchers + `generate-contest-library.mjs`, `data-contests` chunk, `validate:data` extension. |
| **2 Mapping table** | `scripts/data/contest-pattern-map.json` — containers, ordered combinations, direct rules, `_unmappableTags`. |
| **3 Engine + store** | `engine/contestLibrary.ts`, generalized `selectContestSet`, slug-keyed `contestLibrarySlice`, serializer. |
| **4 The Library surface** | `/contest-practice`: simple mode (pattern Select + band chips), advanced filters behind one Disclosure, always-visible count, verified widening hint on empty, 50-row fold, `<details>` rows with full §7.4 detail + rating tooltip + canonical links, `?pattern=` two-way sync, both progress registers read through one lookup. Read-only on purpose — no thunks, no Start, no XP. Log: design record §15. |

### Not started

| Slice | Work | Est. |
|---|---|---|
| **5** | The §63 journey end to end: pattern CTA → preselected filter → **Start contest** → filtered sitting on ContestPage → results → evidence banked | 1 d |
| **6** | Revision mode selector + Contest Revision pool + band recommendation | 1 d |
| **7** | Mixed-pattern contest, "Recreate contest", progression polish | 0.5–1 d |

---

## Slice 5 — groundwork verified this session (do not re-derive)

The contest machinery was read end to end (`contestSlice.ts`, `ContestPage.tsx`,
`engine/contest.ts`, the contest thunks in `actions.ts`, `contestsSlice.ts`, `serialize.ts`).
These are the load-bearing facts:

1. **The live slice snapshots by curriculum id** (`questionIds: number[]`, `attempts` keyed by
   id). Library problems are slug-identified and are NOT Questions, so slice 5 must widen the
   unpersisted `contestSlice` with a discriminated per-problem identity
   (`{kind:'curriculum', id} | {kind:'library', slug}`) — **never** stuff a frontendId into the
   numeric channel: `solveContestProblem` dispatches `solveQuestion(questionId)`, and a library
   frontendId ≤539 would silently write some other question's `progress.byId` row. The ID trap,
   third appearance.
2. **Snapshot display rows into the slice at start.** `ContestPage` must never import
   `@/data/contestLibrary` (336 kB into the /contest chunk for Full-Contest users). The lazy
   library page has the dataset in hand at Start time — snapshot title/url/difficulty/target/
   mapped-patterns per problem into the `contestStarted` payload and let ContestPage render from
   the slice. The slice is unpersisted, so widening costs no migration.
3. **A bridged problem in a filtered contest keeps its curriculum identity** — solve routes to
   `solveQuestion(curriculumQuestionId)` (ordinary XP/ledger/ladder); only contest-only problems
   route to the (new) library solve thunk. One problem, one record.
4. **The 62 contest tests must pass UNMODIFIED.** `analyzeContest`'s input can widen structurally
   (a minimal `ContestQuestion` supertype that real `Question`s satisfy), but its behaviour,
   `ContestProblem`'s shape as tests construct it, and Full Contest's thunk path may not move.
5. **Library sittings bank pattern-level records only.** `ContestStallRecord.problems[].questionId`
   is validated as a positive integer and read back by curriculum surfaces
   (`stalledIdsFromRecord` → question ids) — a frontendId there would be misread as a curriculum
   id. Omit `problems` for library sittings (the schema allows absence; readers yield nothing) and
   let `stalledPatterns` carry the evidence, exact/strong mappings only, resolved at the lazy
   page's call site before the thunk (CLAUDE.md's stated channel).
6. **One sitting record per calendar date, first-write-wins** (`contestsSlice`). A library sitting
   after a Full Contest the same day records nothing. Existing policy; do not fight it in slice 5.
7. **The CTA** goes in `PatternDetailPage`'s `PageHeader` `action` slot (it is currently empty;
   "At most one control"): outline Button asChild → `/contest-practice?pattern=${patternId}` —
   the preselect side already works and is test-pinned.
8. **XP decision (§10.2) becomes real the moment slice 5 records a library solve.** The design
   record recommends ordinary XP; decide it consciously in slice 5, then check the level curve.

## Decisions still open (yours, none blocking)

1. **`leetcodeId` correction** (design record §10.1) — untouched.
2. **XP for contest-library solves** (§10.2) — see groundwork note 8.
3. **Contest-due items on Today** (§10.3) — recommendation stands: no, not initially.

---

## Rules that bit during V13 — do not relearn these

- **⛔ Never join ZeroTrac to this repo on a number.** Slug only; a test guards it. And the trap
  generalizes: any numeric field crossing between the universes (`solveQuestion`, stall-record
  `questionId`s) is a silent-corruption channel — see groundwork notes 1 and 5.
- **The catalog has no topic tags**; tags come from the GraphQL snapshot, which also supplies the
  frontend id as a second agreeing source.
- **A Q5 exists** (Weekly Contest 68 ran five problems) — the library page's Position chips are
  data-driven off the index for exactly this reason.
- **Dictionary encoding is not optional** — 1,232.9 kB naive vs 336.5 kB encoded.
- **`contestSlice` is unpersisted** (widening is free); `contestsSlice` is persisted and takes
  the optional-with-boundary-default treatment.
- **A 16th nav destination broke "the rail never scrolls."** V12.4's guarantee was calibrated to
  15 rows; slice 4 compressed `short:` nav rows 28px → 26px (`Sidebar.tsx`), landing the rail at
  ~570px against the 590px reference viewport. Verified by arithmetic only — see QA note below.
- Generator warnings about renamed titles (#144, #276, #358, #454) are **expected** — alias
  system handles them; warnings, not errors.
- `npm run fetch:contest-data` hits the network; engineering-time only, never tests or runtime.

## QA debt from this session

- **Browser QA did not run** — the Claude-in-Chrome extension was disconnected (OAuth token
  belongs to a different claude.ai account; fix is `/logout` + `/login` with matching accounts,
  or unset a stale `CLAUDE_CODE_OAUTH_TOKEN`). Next session with a browser: verify
  `/contest-practice` at 1280×590 in both themes (row breakpoints at 375/768/1280, the fold, the
  Disclosure), and confirm the 26px `short:` rail holds all sixteen destinations without
  scrolling at 590px.

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
- Never edit source through PowerShell text replacement (mojibake); Edit tool only (a Node `fs`
  utf8 script is acceptable for mechanical whitespace shifts). Commit messages via
  `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
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
  `open` attribute (`familyPanel.test.tsx` is the worked example; `contestPractice.test.tsx` now
  follows it too). But `fireEvent.click` on a summary DOES toggle `open` in jsdom.
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

`CLAUDE.md` (architecture law — carries the contest-library section and its invariants),
`PRODUCT.md` (locked product truth), `DESIGN.md` (visual system + the mandatory composition
contract + § The scroll contract), `report.md` (a measured audit of the whole repo), and the
design records under `docs/superpowers/specs/` — V6 practice engine, V7 adaptive mastery, V8
performance engine, V9 composed interface, V10 zero-scroll (superseded by) V11 flowing
application, and **V13 contest intelligence, which is the active plan** (§14–§15 are its
implementation logs).
