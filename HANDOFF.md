# HANDOFF — GOD MODE V6 (The Practice Engine), PAUSED 2026-08-14

Read this first when resuming. Then read
**`docs/superpowers/specs/2026-08-14-practice-engine-design.md`** — the V6 design record: source
map with evidence labels, convergence map, the seven-feature product map (A–G), the
deliberately-not-built list, and §4's six binding copy rules. Every remaining wave below is
specified there. `CLAUDE.md` / `DESIGN.md` / `PRODUCT.md` remain the architecture, visual and
product law.

## Where the work sits

```
branch  godmode-v6-practice-engine     ← two commits ahead of main; main untouched at 3ca3e69
        5048cf4  wave 1 — sourced reflections replace quotes.ts; V5.2 leftovers 2+3 closed
        682b4c6  wave 2 — small start (two-minute entry) + contest→weakness 8th signal
state   npx tsc --noEmit  clean
        npx vitest run    965/966 — the 1 failure is questionCard.test.tsx's markdown-preview
                          lazy-load timeout, a pre-existing documented under-load flake; it
                          passes 17/17 solo. Check solo before chasing it.
```

**Session history that explains the shape:** V6 ran as an orchestrated build (research fleet →
design record → implementation agents). The two wave-2 implementation agents were killed by a
session limit mid-*report* — but not mid-work: their trees were complete and suite-green.
Rule learned: an agent's dying words undersell it; inventory `git status` before assuming loss.

## What V6 established before building (do not re-litigate)

- The V6 directive is ~70% already-shipped product spec (PRODUCT.md's habit contract, the
  time-chooses-depth session engine, the finishable day, evidence-floored analytics). The design
  record's §0 lists the seven genuine gaps; features A–G map onto them.
- **Sourcing is settled.** BDK's "Teaching of Buddha" grants quotation with credit (its PDF was
  fetched and read; locators in the corpus are real). The Buddha's famous last words are NOT in
  that book — cited to DN 16. **No public-domain English Ryōkan translation exists** (earliest is
  Fischer 1937); every Ryōkan line is a fresh project translation from the public-domain Japanese
  original and its attribution says so. The "falling cherry blossoms" verse is a documented
  misattribution — never add it. The corpus tests in `src/data/__tests__/reflections.test.ts`
  fence all of this.
- **Science boundaries are settled** (design record §1): no "66 days", no "85% rule", no "valley
  of disappointment" as research, no Gino-coauthored citations, no cross-track DSA/ML
  interleaving model (the evidence only supports interleaving *confusable* material — already
  what drills/transfer do).

## Shipped and verified

1. **Reflection corpus** (`src/data/reflections.ts` + tests, Dashboard epigraph swap,
   `quotes.ts` deleted). Quotations verbatim+attributed; notes unattributed; returning pool only
   on a genuine return (same gate as ReturnNotice, mirrored inline in DashboardPage).
2. **V5.2 leftovers 2+3**: InterviewPage rows are radiogroups (roving tabindex, arrow keys);
   `usedSurplus` deleted.
3. **Small start** (design record feature C) — implementation complete, engine-tested:
   `buildSmallStart()` in nextAction.ts (selects from rankWork's order, never re-ranks);
   `SmallStartFrame` with exported `SMALL_START_COPY` (one constant, both surfaces);
   `ui.smallStartQuestionId` flag (set by the hero's "Begin with two minutes", cleared on sheet
   close); ReturnNotice's "Begin with five minutes" → `/focus?entry=small`; Focus small mode =
   one item then the interstitial ("That was the return." / "Keep going" / "Done for today").
4. **Contest→weakness** (feature G) — implementation complete, 18 store tests + weakness tests:
   `contests` channel (dated stall records; live contest slice still never persists);
   `finishContest` stamps the sitting *first*, then banks `analyzeContest`'s reading with
   logDrillResult-style payload normalization; inconclusive sittings write nothing; weights
   re-normalized (retention .24, recognition .22, transfer .10, unfinished .10, confidence .09,
   pace .09, contest .08, hints .08 — 0.24 cap intact).

## What is left — pick up here, in this order

1. **Close wave 2's test gaps** (the agents died before writing page tests):
   - `today.test.tsx`: ReturnNotice shows "Begin with five minutes" when returning; existing
     no-loss-framing negative assertions stay.
   - Focus tests: `?entry=small` renders exactly one item; new-question small item shows
     `SMALL_START_COPY`; after grading, the interstitial (assert its copy verbatim); "Keep going"
     resumes the normal queue; no counters/plates in small mode.
   - Question-sheet test: entry frame only while `smallStartQuestionId` matches an open unsolved
     question; clears on close.
   - `persistence.test.ts`: round-trip the `contests` channel (the validator-parity rule has its
     own test discipline — see CLAUDE.md invariant); confirm every payload `finishContest` can
     write is admitted.
2. **Wave B — practice slice** (design record §3 B+E data half): persisted `practice` channel
   holding `intentions` (≤3, "After [my cue], I will [real app action]" — routine anchors, per
   the Keller 2021 finding), `journal` (one line per date, last-write-wins), `sittings` ledger
   (appended on `finishRevisionSession` AND on stop-with-partial-work; cap history ~60).
   Optional-with-boundary-default schema evolution; thunks normalize their own payloads.
3. **Wave D — reflection wiring**: stored reflection revealed *after* grading a revision (never
   before — retrieval stays clean); optional "What tripped it?" one-liner on fail →
   `QuestionProgress.lastMissNote` (overwritten per fail, shown at next post-grade); the session
   reflect activity captures its line to the journal; Revision preview reads back the last line.
4. **Wave E — habit insights**: `returnAfterFailure` (DayLogs only — for each date with
   `revisionsFailed`, was there activity within 2 days; count only windows that have fully
   elapsed or already returned; floor ≥4 such miss-days; strength tone = the identity-as-evidence
   surface; low rate is NEVER guilt — recommendation is the five-minute re-entry, action
   `/focus?entry=small`). `sessionFollowThrough` (needs the sittings ledger; completion rate,
   floor ~5 sittings; recommendation only ever shrinks the commitment — copy rule 5). Register
   both in `buildInsights`; mirror `weeklyConsistency`'s end-yesterday discipline against
   guilt-shaped off-by-ones.
5. **Wave F — ML recall recording**: "Check yourself" dialog gains Got it / Not yet per prompt;
   first attempt per calendar date is the signal (drills precedent); persisted in the course
   channel as optional fields; feed `courseRetention`'s `neverReviewed` reading.
6. **Settings/Today UI for intentions** (feature B UI half): authored in Settings (max 3, free-
   text cue + action from a fixed enum of real app actions with hrefs), shown on Today as one
   quiet rail line each, no tracking, no XP. Copy rules §4 binding.
7. **Verification pass**: browser QA at 1280px (getBoundingClientRect, not screenshots; both
   themes) for the hero affordance, sheet frame, ReturnNotice button, Focus small mode; `npm run
   build` bundle check (main chunk was 265.15 kB; budget 301); then the V6 adversarial checklist
   (directive §ADVERSARIAL TESTS) + design record §4 copy-rule sweep. Verify agent findings
   before acting on them.
8. **Docs + merge**: PRODUCT.md (reflection sourcing rule; small start counts as practice;
   intentions autonomy), CLAUDE.md (practice slice + new engine modules when they exist),
   DESIGN.md only if a new idiom emerged; then merge the branch to main.

## Rules that bit — do not relearn them the hard way

- **A "failed" agent is not lost work.** Session-limit kills arrive mid-report; both wave-2
  agents left complete, green trees. `git status` first.
- **questionCard.test.tsx** markdown-preview timeout is an under-load flake with a comment
  saying so; it passes solo. Don't weaken it, don't chase it.
- **The in-app Browser pane's screenshots are dimensionally unreliable above ~487px** — judge
  desktop composition with `getBoundingClientRect()` and `read_page`; screenshots only at native
  width. Client-rendered external pages do not hydrate while the pane is hidden.
- **Grep for a symbol will match prose.** Check `import`/JSX, not the bare word, before
  declaring code dead.
- **Never edit source through PowerShell text replacement** (ANSI mojibake) — Edit tool only.
  Commit messages go through a file (`git commit -F`). PowerShell chaining is `;` not `&&`.
- **Don't run the dev server while running the suite**; don't let parallel agents run the full
  suite — scope them to their own files, and give concurrent agents disjoint file ownership (the
  V6 fleet briefs carried an explicit do-not-touch list; keep doing that).
- UI copy is asserted in tests — change strings deliberately, never weaken assertions. Tests pin
  the clock. `progress.byId` / `course.byWeekId` / `tasks.byId` are sparse. Never hand-edit
  `src/data/*.json` (but note: `src/data/reflections.ts` is source, not generated — edit it
  directly, under its corpus tests).
- **The weakness invariants stand**: one model, no weight above 0.24, suppression not
  re-weighting, and the two deliberately-unactioned modelling decisions (non-monotone weighted
  mean; undecayed `unfinished`) stay unactioned.
