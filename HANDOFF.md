# HANDOFF — GOD MODE V5.1, paused 2026-08-13

Read this first when resuming. `CLAUDE.md` (architecture + invariants), `DESIGN.md` (§ Composition
is new and mandatory) and `PRODUCT.md` (product truth) are all up to date and are the real
reference — this file only records **where the work stopped and what is left**.

## State at pause: GREEN

```
npx tsc --noEmit        clean
npm run validate:data   OK — 539 questions, 528 linked, 17 companies (5 enumerating topics)
npx vitest run          747 passed (65 files)      ← 542 at session start
npm run build           succeeds
npm run audit:companies 9 verified · 8 unverifiable (reported, with reasons) · 0 failures
```

Everything is committed. The tree is safe to leave and safe to resume from.

## The two P0s from the directive are done

**1. UI composition.** `src/components/layout/Page.tsx` is the vocabulary (`Page`, `PageHeader`,
`Section`, `Lead`, `Plate`, `Rule`, `RuledList`, `RuledItem`, `Ledger`, `Meta`) and
**DESIGN.md § Composition** is the contract. The rule: a plate must earn itself — one `Lead` per
page, `Plate` only for something genuinely liftable, dialogs; everything else is an open
`Section`. Counted facts go in `Ledger`, not a grid of `StatCard`s. Related facts go on one `Meta`
line. Three vertical steps and no others.

Recomposed: Dashboard (12 plates → 0), Roadmap (70 → 0), Patterns (29 → 0), PatternDetail,
Achievements (60 → 0), Settings (3 → 0), Bookmarks, Calendar (3 → 0), Drills (6 → 1), Companies
(both views → 0), Analytics, AI/ML, Today, the question sheet, and the shell chrome.

**2. Context-aware revision.** `src/utils/engine/session.ts` + the rebuilt `RevisionPage`. Time
chooses *depth*, not count; cognitive load is capped separately from minutes; the session has an
arc; overflow is "waiting", never a headline. The plan is **frozen at start** so it cannot
reshuffle mid-sitting.

## Defects found and fixed (not just features added)

- **`Card` vs `.glass` cascade bug.** `Card` applied Tailwind's `shadow` utility while `.glass`
  set `box-shadow` from `@layer components`, so every `QuestionCard` — the most repeated surface
  in the app — silently rendered the wrong shadow. Fixed at the primitive: `Card` *is* `.glass`.
- **A shipped paraphrase**, caught by `audit:companies` on its first run. Databricks' page says
  "**Know** common data structures…"; the dataset had reworded it to "review…". That is exactly
  what got Atlassian and Shopify deleted.
- **Session scorer explained itself wrongly**: "only at step 0 of the ladder" outranked a
  genuinely-overdue item's reason. Ladder fragility is now score-only, never an explanation.
- **The floating pomodoro covered the last ~18px of every page on phones** (AppShell reserved
  144px; the widget reached 162px). Widget shrunk, shell padding raised, toast restacked.

## The company-evidence result is a negative one, and it is final

The per-problem premise was re-tested across 17 companies. Google's Tech Dev Guide — historically
the one first-party page naming concrete practice problems — **is retired** and 302s to a generic
careers page. Exactly one source names any problem at all (LinkedIn, 2016, one specialist role,
explicitly the phone screen's warm-up tier), recorded verbatim in `namedProblems` and never mapped
to a roadmap question. **The absence of a per-problem field is a finding, not a gap to fill.**

## What is NOT done — pick up here

1. **Contest mode is 70% built and NOT wired up.** `src/utils/engine/contest.ts` (12 tests),
   `src/store/slices/contestSlice.ts` (15 tests) and the thunks in `actions.ts` all exist and pass.
   Missing: `src/pages/ContestPage.tsx`, the lazy route in `src/App.tsx`, and a `mobile: 'more'`
   entry in `src/components/layout/navItems.ts` (there is room for exactly five `primary` tabs —
   do not add a sixth). The engine's design notes are in its header comment; `analyzeContest` is
   deliberately conservative (no score, no rank, and an abandoned contest is declared
   inconclusive rather than mined for weaknesses).

2. **Main bundle regressed 301.65 kB → 339.83 kB (+38 kB).** The directive says preserve ~301 kB,
   so this is a genuine miss. Likely causes: the new engine modules (`session`, `weakness`,
   `contest`, `interview`) reach the main chunk via `selectors.ts` / `store.ts`, which are not
   lazy. Worth an audit before adding anything else. `data-ml` (188 kB) and `data-curriculum`
   (386 kB) are correctly pinned as separate immutable chunks; `AnalyticsPage` (411 kB, recharts)
   is lazy and unchanged.

3. **The two adversarial passes (§58–59) never ran.** This is the biggest outstanding item. The
   plan was: an independent reviewer told "assume the product is still mediocre, prove it", fix
   the legitimate findings, then a second pass asking "what did the first reviewer miss?" Prior
   sessions found real defects this way, so do not skip it.

4. **Browser QA is still unavailable.** The Chrome extension reports an OAuth account mismatch
   with the CLI login, and agents also could not reach the local dev server. **No visual
   verification has happened this session** — everything is verified through jsdom and reasoning
   only. `src/__tests__/routes.test.tsx` proves every `NAV_ITEMS` route mounts through the real
   lazy boundaries; it does not prove anything looks right at 375px.

5. **Smaller items reported by agents, deliberately not actioned:**
   - `engine/nextAction.ts` could expose `nextAfterSolve(questionId, byId)` — the post-solve
     recommendation is currently business logic living inside `PostSolvePanel`.
   - `data/curriculum.ts` should own `FAMILY_ROLE_MEANING` (it sits locally in `FamilyPanel.tsx`).
   - `hints.ts` could derive an orientation rung for the 101 family-less questions, but that
     renumbers the rungs `hintLevelUsed` is persisted against — it needs a migration decision,
     not a UI decision.
   - The `/paraphras/i` guard in `insights.test.ts` is a substring check on prose, so it trips on
     any note that *describes* a paraphrase defect. It cost two rewordings this session. Kept
     deliberately — it is blunt but it works, and loosening it weakens a real safety net.

## Four agents were killed mid-flight by a session limit

Interview mode, analytics + weakness model, the Today surface, and ML shipping all had their
agents terminated by an account usage cap. **Their work was recovered and completed** — the suite
is green and their surfaces are finished. The only thing that needed repair was
`analytics.test.tsx`, whose page had been rebuilt but whose tests had not been updated; those were
rewritten against the new five-question structure rather than loosened.

## Rules that bit this session — do not relearn them the hard way

- UI copy is asserted in tests. Changing a user-facing string is a behaviour change: update the
  owning test deliberately, **never weaken an assertion to make a styling change pass.**
- Tests must pin the clock (`vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T12:00:00'))`).
- `progress.byId`, `course.byWeekId` and `tasks.byId` are sparse — every read needs a fallback.
- Never hand-edit `src/data/*.json`; run `node scripts/generate-questions.mjs`.
- PowerShell here does not support `&&`; use `;`. Multi-line strings need heredocs, not
  here-strings.
