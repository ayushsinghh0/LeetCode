# HANDOFF — GOD MODE V5.2, updated 2026-08-14 (session 3)

Read this first when resuming. `CLAUDE.md` (architecture + invariants), `DESIGN.md` (§ Composition
is mandatory) and `PRODUCT.md` (product truth) are the real reference — this file records **where
the work stopped and what is left**.

## State: GREEN

```
npx tsc --noEmit        clean
npm run validate:data   OK — 539 questions, 17 companies
npx vitest run          934 passed (68 files)     ← 788 (66) at session-3 start
npm run build           succeeds — main chunk 265.15 kB
npm run audit:companies 9 verified · 4 compression warnings · 8 unverifiable · 0 failures
```

**Bundle note, stated honestly:** the main chunk went 257.61 → 265.15 kB (+7.5 kB). That is real
new engine surface — two insight builders, the company-topic helper, the shared `Eyebrow`, and
Focus's session budget — not drift. It remains ~36 kB below the 301 kB the directive asked to
preserve. `AnalyticsPage` (411 kB, Recharts) is still the largest route chunk and is lazy.

## What session 3 did

The directive asked for a great deal that turned out to be **already built** — a scoped gap
analysis put it at roughly 85%. Interview mode's ten stages, the revision session's depth model,
cognitive-load balancing, the session arc, overflow-as-waiting, analytics suppression, the habit
contract and missed-day recovery are all shipped and tested. **The real gaps were wiring between
features that already existed, and composition.** Work was done by eight scoped agents with
disjoint file ownership, then integrated and verified here.

### 1. Composition — the directive's stated #1 priority

The visual identity was never the problem; the *arrangement* was. Verified before/after on the
running app, not from jsdom:

- `/patterns/:id` went from **~30 bordered cards in a 3-column grid (plus ~60 chip outlines) to 1
  plate and 34 ruled rows**, zero nested plates, zero horizontal overflow, and a real H1→H2→H3
  outline. `BookmarksPage` got the same treatment. `QuestionCard`'s `browse` variant is retired.
- **Chips inside a `Meta` line are now borderless** (`variant="bare"`): difficulty as the word in
  its difficulty ink, a pattern as an ink dot plus its name. A `Meta` line whose own items are
  plates was saying "four things" again. This one change improved nine surfaces at once.
- **The nav is no longer a solid blue pill.** `bg-primary` on the active sidebar/bottom-nav item
  was the loudest object on all eighteen screens and spent the ink budget twice per viewport. It
  is now a 2px ink margin mark + ink icon + weight step, with the state carried by three
  independent signals (`aria-current`, stroke presence, weight) so it never rests on colour alone.
- **The idle pomodoro stopped being a plate** — it was a `.glass` surface reading "25:00 / Ready"
  on every page for a timer that is usually not running, with `pb-36` of dead page foot reserved
  beneath it. Idle is now a lone ghost icon button; `pb-28`.
- `/focus` and `/aiml` were the two pages that had opted out of the vocabulary (own measure, own
  gutter, a fourth vertical step, and `/aiml` the only page dropping its masthead rule). Both are
  back inside `Page`/`PageHeader`/`Lead`.
- `NotFoundPage` was a 1152px-wide plate holding one heading. `SearchDialog` ran two different row
  designs in one listbox, one of them a plate nested in a plate. Analytics went 7 ledgers/25
  figures → 5/14. Calendar's 150×64px cells are square at the `default` measure. `CompanyDetail`
  is at the `reading` measure. `StatCard` and `EmptyState`'s `plated` are deleted — both were dead
  and both were re-entry points for the box problem.
- **`Eyebrow` is now a component** in `Page.tsx`. The register was re-declared inline on eight
  surfaces, half omitting `.figures`, so the same eyebrow rendered in two different typefaces
  across the product — invisible in any one file.

### 2. Correctness and honesty defects found by adversarial pass 3

Pass 3 was told to assume passes 1–2 were too easy on it. It confirmed a long list genuinely clean
(persistence exhaustively, sparse maps, NaN/divide-by-zero, day rollover/DST, XP/bonus/ladder
double-counting, session boundaries, contest clock, `useDueReminder`) and found these:

- **Two weakness models were still live — as *copy*, not as a second selector.** Today's drill
  reason read "where your recent answers have been shakiest", resolved from `selectMostMissedPatterns`
  (a raw cumulative drill tally, no decay), while Revision emitted the byte-identical sentence from
  `selectPatternWeakness`. The two name different patterns the moment an old drill miss outweighs a
  fresh failure. "Recent" was false as well. The field is now `missedMostPatternName` and its
  sentence describes only the drill's own basis.
- **Grade buttons the thunk silently refuses.** `reviseQuestion` returns early when
  `lastReviewed === date`, but the Revision page dispatched `completeSessionActivity` regardless —
  so grading a pulled-forward item (second sitting, or an item graded from Today that morning)
  showed "Recalled" while the ladder, XP and day log all ignored it.
- **The completion screen was day-scoped, not sitting-scoped** — it listed every review graded
  anywhere that day under a heading saying "Session complete".
- **Interview mode billed old hints to the current sitting** and let a ladder opened weeks ago
  render already-expanded, defeating the per-stage reveal that is the mode's whole mechanism. Now
  snapshotted at `interviewStarted` and reported as `taken − atStart`.
- **The interview clock lost every minute since the last stage transition on remount** (lazy route,
  ref-based start), then told the learner they had beaten the recommendation. Moved to a wall-clock
  `startedAtMs` in the slice, mirroring `contestSlice`, plus the same `visibilitychange` settle.
- **Analytics printed an unfloored "0%" recall rate** three rows above a ledger correctly refusing
  to report the same single observation.
- **Contest overstated its seeding guarantee** ("reloading rebuilds the same set" is true only
  until you solve one, which removes it from the pool).
- The interview hint button encoded "no mapped family" in its disabled state; Revision's length
  chips were six `aria-pressed` toggles for one choice; a raw ISO date reached learner-facing prose.

### 3. `engine/weakness.ts` is no longer untested — and it was hiding things

It was the largest untested surface in the repo and every UI weakness claim rests on it. **59 tests
added**, which surfaced six findings. Three were fixed:

- **"Missed in 2 recognition drills" when the learner sat one.** `missedPatterns` holds one entry
  per wrongly answered *prompt*, duplicates allowed. Now counts prompts.
- **Rate signals never decayed.** The ratio divides two quantities that decay together, so it is
  invariant to age, and `MIN_OBSERVATIONS` gates on the unweighted count — two failed recalls from
  last year read bit-identical to two from this week, directly against the module's own first rule.
  New `MIN_LIVE_EVIDENCE` floor: suppression, not re-weighting; live evidence is scored exactly as
  before, and because the floor is on evidence *mass*, repeated evidence outlives sparse evidence.
- **A NaN path that `score <= 0` does not catch** (`NaN <= 0` is false), so a NaN-scored pattern
  would have shipped and destabilised the sort. Unreachable today; guarded anyway.

### 4. Wiring that closed the "orphaned rooms" problem

- **`accuracyTrend` had no insight builder**, so "am I improving?" — one of the six questions
  Analytics exists to answer — could never surface. Same for `transferRecord` ("can I transfer?").
  Both are now registered builders with headline/evidence/recommendation/action and their own
  suppression floors.
- **Interview and Contest were reachable only by remembering to click a nav item** — no insight
  action pointed at either. They are now the action on the insights where rehearsal genuinely *is*
  the recommendation (improving recall → the untested dimension is the clock; strong transfer →
  rehearsal now buys more than volume).
- **Focus mode ignored the time budget.** It read `selectRankedWork` but never `buildSession`, so
  at a 15-minute capacity Today said "nothing fits" while Focus opened a 25-minute item. It now
  reuses `SessionPlan`'s exact path — and reports which empty state it is rather than claiming
  "all caught up" while an hour of work sits behind a short window.
- **The question sheet gained its last two rungs** — interview follow-ups (via the existing
  `followUpsFor`) and company context. The company line is gated to `evidence === 'topics'` and
  worded so the grammatical subject is the *pattern*, never the problem; a test runs the same six
  forbidden-attribution regexes the companies suite uses.

### 5. Data safety

- **`logDrillResult` now guarantees a persistable payload.** `validatePersisted` hard-rejects
  `total < 1`, `correct > total`, blank pattern ids, and more missed patterns than misses — and
  that invariant was held only by `DrillsPage`'s render flow, a property of one caller. One guard
  away from being the same P0 the capacity chip was.
- **The rule finally has a test.** `persistence.test.ts` round-trips every value the UI can write
  (`SESSION_PRESETS`, `CAPACITY_OPTIONS`, `PER_DAY_OPTIONS`, `CAPACITY_MIN`/`MAX`) and asserts every
  capacity chip is offered by the Settings control that states the budget.
- Dead code that could resurrect a third weakness model deleted: `HeuristicRecommender` and its
  `Recommender`/`RecommendArgs` seam (obsolete — `rankWork` is the one prioritizer),
  `selectEstimatedFinish` (`DashboardPage` reads `finishProjection`, which can express its basis).

## What is left — pick up here

1. **Contest results still evaporate.** `analyzeContest` returns `patternGaps`, computed and
   suppressed-when-inconclusive, and **read by exactly one line — its own module**. The contest
   slice is deliberately not persisted (a restored stopped clock would lie), so a stall informs the
   post-contest screen and vanishes. Wiring it means an 8th weakness signal fed by a persisted
   stall record. The gap analysis produced a verified 8-file sketch, every file mirroring the
   existing `drills` channel; `actions.ts` `finishContest` is the single line that closes the loop.
   **`weakness.ts` now has tests, so the prerequisite that blocked this is gone.**
2. **`InterviewPage`'s stage-outcome and self-assessment rows still use `aria-pressed`** for
   single-choice controls — the same defect class as the Revision chips, not in the finding list,
   and two tests currently pin `aria-pressed="true"` on them.
3. **`usedSurplus` in `session.ts` is computed twice, carefully, and consumed by nothing** — same
   class as the two dead selectors deleted this session.
4. **Weakness findings deliberately NOT actioned** (documented, tested-as-flagged, not endorsed):
   the score is a weighted mean above `MIN_EVIDENCE_WEIGHT` and therefore **non-monotone in
   evidence** — extra negative evidence reading below the current average can *lower* the score,
   so a ranked list can place a strictly-worse record lower. `unfinished` carries no dates at all,
   so its weights cancel and it is an undecayed lifetime ratio. Both are modelling decisions, not
   bugs to patch quietly.
5. **8 company sources remain UNVERIFIABLE** (bot-blocked or client-rendered). This is the audit's
   honest three-valued design working, not a gap. They cannot be closed from the in-app browser
   either — see below.
6. Smaller, unchanged from session 2: `nextAfterSolve` is business logic living in
   `PostSolvePanel`; `FAMILY_ROLE_MEANING` should live in `data/curriculum.ts`; `hints.ts` could
   derive an orientation rung for the 101 family-less questions, but that renumbers the rungs
   `hintLevelUsed` is persisted against — a migration decision.

## Rules that bit — do not relearn them the hard way

- **The in-app Browser pane's screenshots are dimensionally unreliable above ~487px.** A column
  correctly filling 95% of a 1280px viewport renders in the capture at ~30%, which reads as a
  broken layout that does not exist. Judge desktop composition with `getBoundingClientRect()` and
  `read_page`; use screenshots only at native width. `zoom` with a `region` is not supported, and
  client-rendered external pages do not hydrate while the pane is hidden.
- **Grep for a symbol will match prose.** `StatCard` and `plated` looked live because comments and
  a test *mentioned* them; both had zero imports. Check `import`/JSX, not the bare word — the first
  pass at this nearly kept two dead re-entry points on the strength of a docblock.
- **Verify reviewer findings before acting.** Pass 3's report was strong and still needed tracing;
  agents are not oracles, and an unverified finding costs more than a missed one.
- **Commit messages go through a file** (`git commit -F <path>`), not a PowerShell here-string.
- **Never edit source through PowerShell text replacement** — `Get-Content -Raw` decodes with the
  ANSI codepage and turns every em dash into mojibake. Use the Edit tool.
- **Don't run the dev server while running the suite** (roughly triples wall time and manufactures
  timeouts), and don't let parallel agents run the full suite — scope them to their own files.
- UI copy is asserted in tests. Changing a user-facing string is a behaviour change: update the
  owning test deliberately, **never weaken an assertion to make a change pass.**
- Tests must pin the clock (`vi.useFakeTimers()` + `vi.setSystemTime(...)`).
- `progress.byId`, `course.byWeekId` and `tasks.byId` are sparse — every read needs a fallback.
- Never hand-edit `src/data/*.json`; run `node scripts/generate-questions.mjs`.
- PowerShell here: `;` not `&&`.
