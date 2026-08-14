# HANDOFF — GOD MODE V8 shipped (2026-08-15)

**State: all nine slices implemented, verified, and merged to `main`.** There is no in-flight work.

## Where things stand

- **1160/1160 tests across 81 files. `npx tsc --noEmit` clean. App chunk 276.92 kB against the
  301 kB budget** — below the V7 baseline (277.43 kB) despite eight slices of new work, because
  slice 9 moved the ML dataset and the analytics engine off the app chunk.
- Browser QA at 375 / 768 / 1024, both themes' tokens confirmed flipping. One live layout defect
  was found and fixed there (the contest row's control cluster overflowed 375 px once an armed row
  carried four controls).
- The design record `docs/superpowers/specs/2026-08-15-performance-engine-design.md` is the
  authority on what was built and why. **§8 is the verification log** — it records every departure
  from the plan, the reasoning, and the trade-offs deliberately left in place. Read §8 first.

## What V8 actually changed, in one paragraph each

- **Contest.** The clock stopped the moment the learner started working (hidden tab = settled),
  so the whole contest→weakness path was structurally dead. It now runs until paused. The sitting
  records wrong submissions, deliberate set-asides, where the minutes went, and a per-problem row
  per finished sitting — and **every conclusive sitting banks**, not only ones with stalls.
- **Interview.** Sittings now persist as derived records, so the debrief's long-standing promise
  ("compare this sitting with your next one") is finally keepable. Selection is evidence-led;
  optional expectation, follow-up calls and a closing line were added. No score, ever.
- **ML tracks.** The eleven verified from-scratch tracks became practicable: rungs stamp, the
  scratch rung enters the shared ladder as a rebuild-from-blank-file, rebuilds are graded, and all
  of it counts as activity and appears in the day plan and the load forecast.
- **Companies.** One target company, topics-tier only, scoping patterns and nothing else.
- **Analytics.** Practice vs performance, via the one comparison the data supports honestly:
  untimed pace ratio against timed pace ratio. Plus interview independence and calibration, both
  floored at three sittings.

## Rules that bit during V6/V7/V8 — still standing

- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; it passes
  solo. Don't weaken it, don't chase it.
- Browser-pane screenshots are unreliable (and unavailable when the pane is not displayed) —
  judge composition with `getBoundingClientRect()`/`read_page`. **Computed `backgroundColor` also
  goes stale in the pane**: to check a theme, read the CSS custom properties
  (`getComputedStyle(document.documentElement).getPropertyValue('--background')`), which do flip.
  Synthetic value-setters don't reach React controlled inputs; component tests are the authority
  on input plumbing. React state changes are not visible in the same synchronous script that
  triggered them — read the DOM in a separate `javascript_tool` call.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit
  messages via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Hand-built `QuestionProgress` fixtures must carry every required field or `validatePersisted`
  quarantines the whole payload — build from `initialProgress()`.
- **New:** adding an import of `@/data/mlTracks`, `@/data/mlProjects` or `@/utils/engine/insights`
  to `store/selectors.ts` or `store/actions.ts` silently puts a large chunk back on the app
  bundle. Run `npm run build` and check the `index-*.js` figure when touching either file.

## The law books

`CLAUDE.md` (architecture law — the V8 invariants are in the "Invariants that bite if forgotten"
list), `PRODUCT.md` (locked product truth), `DESIGN.md` (visual system + mandatory composition
contract), and the design records under `docs/superpowers/specs/` (V6 practice engine, V7 adaptive
mastery, V8 performance engine).
