# HANDOFF — GOD MODE V8 paused after Priority 0 (2026-08-15)

**State: inspection complete, design record written, ZERO implementation.** The user paused the
session intending to resume in ~2 days. Everything needed to resume cold is in the repo.

## Where things stand, exactly

- Branch: `godmode-v8-performance-engine`, sitting on main's tip (`1d1e580`) plus only the two
  documentation commits for this pause. No feature code exists yet.
- Baseline re-verified on this branch on 2026-08-15: **1068/1068 tests (78 files), tsc clean.**
- The V8 directive (the full "GOD MODE V8" prompt) asked for: interview engine completion,
  contest engine completion, ML from-scratch build mode, question content intelligence, verified
  company preparation, performance-gap analytics, time-context sessions — after a mandatory
  full-repo inspection. **The inspection is done.** Six parallel subsystem maps (interview,
  contest, AI/ML course, question intelligence, companies, ranking/analytics spine) were
  distilled into the design record.

## The pick-up order (do these in sequence)

1. Read `docs/superpowers/specs/2026-08-15-performance-engine-design.md` **top to bottom** —
   it is the V8 design record: verified baseline, the ALREADY EXISTS / PARTIAL / MISSING /
   RECORDED classification against the whole directive, the traced root cause of the dead
   contest `patternGaps` path (§3), an architecture reference with file:line anchors (§4), the
   9-slice implementation plan (§6), and the invariant analysis (§7).
2. Re-run the baseline before writing code (`npm test`; `npx tsc --noEmit`) — confirm
   1068/1068 + clean before slice 1.
3. Implement **slice 1** (the contest clock fix — smallest slice, unlocks the dead evidence
   path), then slices 2→9 in the record's order. Each slice: failing test first, green, refactor,
   integrate, browser QA, adversarial pass, commit. Vertical slices — never a giant untested
   branch.
4. Keep the record honest as you go: when a slice ships, note it in the record's §8 verification
   log; when a decision changes, amend the record, don't contradict it silently.

## Findings you must not lose (also in the record, repeated here because they bite)

- **The contest patternGaps path is dead because the clock stops the moment the learner starts
  working** (visibilitychange→hidden blurs the armed problem; the only work surface is an
  external LeetCode tab). Fix = trust the explicit arm/pause control (§3 of the record). The
  page test pinning "away-time is never a stall" changes DELIBERATELY with new copy.
- **Interview evidence does not persist at all** — the debrief copy at InterviewPage.tsx:511-513
  promises a cross-sitting comparison that storage cannot deliver. Slice 3 fixes this with a
  persisted `interviews` channel using the contests-channel discipline (live slice stays
  unpersisted; thunk banks a normalized derived record).
- **The ML from-scratch curriculum already exists** (11 measured tracks + 14 projects,
  src/data/mlTracks.json / mlProjects.json, rendered read-only on /aiml). Slice 5 builds the
  progress/evidence layer, NOT content. Do not author new tracks unless you can actually run
  the experiments (the existing `experiment.expect` values are measured; unmeasured numbers are
  forbidden).
- **`tests` already is the per-question summary** V8 asks for; per-question authored traps are
  recorded-not-built (inventing traps is barred by the directive itself).
- Small found-bug ledger (fix inside the named slices): AnalyticsPage.tsx:361 stale signal copy
  (slice 8); missing interviewSlice unit tests + loose `stageOutcomeSet` guard + dead `startedOn`
  field (slice 3); ungated `companiesNamingPattern` in src/data/companies.ts:68 (slice 7).
- The V7 record marked ML tracked ladders deliberately-not-built; **V8 explicitly overturns
  that** — the reversal is documented in the record §1. Don't re-litigate either way.

## Rules that bit during V6/V7 — still standing

- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; it passes
  solo. Don't weaken it, don't chase it.
- Browser-pane screenshots are dimensionally unreliable above ~487px — judge desktop composition
  with `getBoundingClientRect()`/`read_page`. Synthetic value-setters don't reach React
  controlled inputs in the pane; component tests are the authority on input plumbing.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit
  messages via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Don't run the dev server while the suite runs; scope parallel agents to disjoint files.
- Hand-built `QuestionProgress` fixtures must carry every required field or `validatePersisted`
  quarantines the whole payload — build from `initialProgress()`.

## The law books (read before any code)

`CLAUDE.md` (architecture law), `PRODUCT.md` (locked product truth — interview self-assessment
no-judge and the conservative contest reading are LOCKED), `DESIGN.md` (visual system +
mandatory composition contract), and the design records under `docs/superpowers/specs/`
(V6 2026-08-14-practice-engine-design.md §4 copy rules bind all new copy; V7
2026-08-14-adaptive-mastery-design.md; V8 2026-08-15-performance-engine-design.md is the one
you are executing).
