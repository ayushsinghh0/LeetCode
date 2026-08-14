# HANDOFF — nothing in flight

GOD MODE V6 (The Practice Engine) shipped and merged to `main` on 2026-08-14. There is no
paused work. If you are starting something new: `CLAUDE.md` is the architecture law, `DESIGN.md`
the visual system, `PRODUCT.md` the product truth, and
`docs/superpowers/specs/2026-08-14-practice-engine-design.md` the V6 design record (source map
with evidence labels, convergence map, features A–G, the deliberately-not-built list, and §4's
six binding copy rules — that last list is still binding on any new surface).

## What V6 left behind (the short map)

- **Reflection corpus** `src/data/reflections.ts` — sourced, licensed, test-fenced
  (`reflections.test.ts` bans famous-name attributions outright). One quotation surface:
  the Dashboard epigraph. `quotes.ts` is deleted; never resurrect it.
- **Small start** — hero's two-minute entry (`ui.smallStartQuestionId` → sheet frame),
  ReturnNotice's five-minute re-entry (`/focus?entry=small` → one item + interstitial).
  Copy rule: the small start is complete in itself.
- **Practice channel** (`practice` slice): intentions (≤3, untracked, no XP; authored in
  Settings, one quiet rail on Today), journal (line per date), sittings (committed work only
  via `sittingCounts` — reflect/drill are adjuncts; internal evidence for
  `sessionFollowThrough`, never a surfaced number).
- **Reflection loop** — post-grade reveal (never before grading), "What tripped it?" miss
  notes, session-close journal capture, Revision-preview read-back.
- **Habit insights** — `returnAfterFailure` (identity-as-evidence; low rate → five-minute
  re-entry, never guilt), `sessionFollowThrough` (only ever recommends shrinking).
- **ML recall recording** — Got it / Not yet per prompt, first attempt per date is the signal,
  aggregate banked by `logCourseRecall`; feeds `courseRetention`.
- **Contest → weakness** — persisted `contests` stall channel, 8th decayed signal
  (weights re-normalized, 0.24 cap intact); the live `contest` slice still never persists.

## Rules that bit during V6 — keep them

- A "failed" background agent may have finished its work (session-limit kills arrive
  mid-report) — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; it
  passes solo. Don't weaken it, don't chase it.
- The Browser pane's screenshots are dimensionally unreliable above ~487px — judge desktop
  composition with `getBoundingClientRect()`/`read_page`. Synthetic value-setter events do not
  reliably reach React controlled inputs in the pane; real typing does, and the component tests
  are the authority on input plumbing.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit
  messages via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Don't run the dev server while the suite runs; scope parallel agents to disjoint files.
- Hand-built `QuestionProgress` fixtures must carry every required field or
  `validatePersisted` quarantines the whole payload — build from `initialProgress()`.
