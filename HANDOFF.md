# HANDOFF — GOD MODE V5.1, updated 2026-08-13 (session 2)

Read this first when resuming. `CLAUDE.md` (architecture + invariants), `DESIGN.md` (§ Composition
is mandatory) and `PRODUCT.md` (product truth) are the real reference — this file records **where
the work stopped and what is left**.

## State: GREEN, and pushed

```
npx tsc --noEmit        clean
npm run validate:data   OK — 539 questions, 17 companies
npx vitest run          761 passed (66 files)      ← 747 at session-2 start
npm run build           succeeds — main chunk 256.94 kB
```

`origin/main` is at `6851662`. Working tree clean. Push uses the credential override recorded in
project memory (plain `git push` authenticates as the wrong account).

## What session 2 closed

**1. The bundle regression is beaten, not just recovered.** Main chunk 339.83 kB → 256.94 kB,
~45 kB *below* the 301 kB the directive asked to preserve, with contest mode added on top. Found
by per-module chunk attribution (a temporary Rollup reporter, since deleted):

- `SearchDialog` is `lazy()` behind an AppShell latch — it dragged the Radix select + filter-row
  stack into main for a dialog that only opens on demand. Its Ctrl/Cmd+K hotkey moved to the
  eager `useSearchHotkey` hook, because a lazy component cannot own the shortcut that summons it.
- `date-fns` left the eager graph: `utils/dates.ts` hand-rolls its day-level ISO math and
  `engine/insights.ts` hand-rolls its one display date. Reviewer-verified equivalent, including
  DST behaviour.
- `canvas-confetti` dynamic-imports on the first celebration.

**2. Contest mode is shipped and wired** — `ContestPage`, `/contest` route, nav entry beside
Drills and Interview, two selectors, 7 page tests. PRODUCT.md carries the contest truth now.

**3. Browser QA finally happened.** The in-app Browser pane works where the Chrome extension's
OAuth mismatch blocked two prior sessions: `preview_start` with the `dsa-roadmap-dev` config.
Verified all 15 routes at 375px and desktop — zero horizontal overflow anywhere, every `h1`
present, mobile nav/sidebar swapping correctly, both themes painting from tokens, the pomodoro
clearing the shell's bottom padding, the full contest lifecycle, the lazy palette loading on
Ctrl+K, and the type-to-confirm reset actually clearing state.

**4. Adversarial pass 1 ran and found real defects** — including a **P0 data-loss bug**: tapping
the "15m" capacity chip persisted a value `validatePersisted` rejected, so the next load
quarantined the learner's entire state and booted the app empty. Also a double-graded revision
ladder (Undo → re-grade moved the ladder twice and paid XP twice), a Settings toggle the Revision
page ignored, a session that could defer due work while pulling forward not-due work, and four
surfaces stating things the data did not support. All fixed in `6851662` with regression tests.

**5. A load-time defect nobody had reported:** the Suspense boundary sat *above* `AppShell`, so
every cold load replaced the whole application — sidebar, nav, brand — with one pulsing plate
until the first route chunk resolved. Moved inside the shell; a synchronous test pins it.

## What is NOT done — pick up here

1. **Adversarial pass 2 was running when this was written.** Its findings are the next work item.
   Check whether its report was acted on before doing anything else.

2. **`engine/weakness.ts` test coverage** — an agent was writing
   `src/utils/engine/__tests__/weakness.test.ts` when session 2 was wrapping up. Verify whether
   that file exists and is green; the module is the most arithmetic-dense one shipped and every
   UI weakness claim rests on it.

3. **Contest results still evaporate.** `analyzeContest` returns `patternGaps` so a contest can
   feed the shared weakness signal, but nothing consumes them and the contest slice is not
   persisted — a stall informs the post-contest screen and then vanishes. The module header now
   says so honestly instead of claiming the wiring exists. Wiring it means persisting stalls
   somewhere `patternWeakness` can read.

4. **Smaller items, deliberately not actioned:**
   - `engine/nextAction.ts` could expose `nextAfterSolve(questionId, byId)` — that recommendation
     is business logic living inside `PostSolvePanel`.
   - `data/curriculum.ts` should own `FAMILY_ROLE_MEANING` (it sits locally in `FamilyPanel.tsx`).
   - `hints.ts` could derive an orientation rung for the 101 family-less questions, but that
     renumbers the rungs `hintLevelUsed` is persisted against — a migration decision.
   - `selectors.ts` gives a solved-but-never-reviewed question `daysSinceSeen: 0`, suppressing its
     staleness tiebreak; the field's own doc says "days since the learner last touched it".

## Rules that bit — do not relearn them the hard way

- **Commit messages go through a file** (`git commit -F <path>`), not a PowerShell here-string:
  long messages containing quotes get tokenized and the commit fails messily.
- UI copy is asserted in tests. Changing a user-facing string is a behaviour change: update the
  owning test deliberately, **never weaken an assertion to make a change pass.**
- Tests must pin the clock (`vi.useFakeTimers()` + `vi.setSystemTime(...)`).
- `progress.byId`, `course.byWeekId` and `tasks.byId` are sparse — every read needs a fallback.
- Never hand-edit `src/data/*.json`; run `node scripts/generate-questions.mjs`.
- PowerShell here: `;` not `&&`.
- **A validator stricter than the UI is a data-loss bug.** Any persisted field with a range check
  must admit every value the product's own controls can write, and a test must round-trip them.
- When a suite goes faster, old timeouts start failing: that is contention arriving all at once,
  not flakiness to paper over. `vitest.testTimeout` must sit above every per-query `findBy`
  window, or the kill ceiling silently truncates the wait the query asked for.
