# The Performance Engine — V8 design record (2026-08-15)

**STATUS: SHIPPED — all nine slices, 2026-08-15.** §0–§7 below are the design as written before
implementation and are left unedited so the reasoning can be audited against what was built; §8
is the verification log, and it records every place the shipped work departed from this plan and
why. If you are picking up new work, read §8 first.

V8's directive ("can this learner actually perform independently under realistic constraints?")
was mapped against the shipped tree by six parallel inspection passes (interview, contest, AI/ML
course, question intelligence, companies, ranking/analytics spine). As with V6 and V7, much of
the directive is already this product's shipped spec — the finding, again, is that V8 is a set of
narrow completions, not a system built beside the product. What is genuinely missing has one
common shape: **the performance modes exist but their evidence is thrown away.** Interview
sittings die with the tab. Contest per-problem readings are discarded at `clearContest`. The ML
implementation tracks are 1,295 minutes of verified content with no progress layer. V8 is mostly
the work of making performance evidence *persist, feed back, and change future practice* — which
is precisely the directive's own acceptance criterion.

## 0. Verified baseline (2026-08-15, branch `godmode-v8-performance-engine` = main @ 1d1e580)

- 1068/1068 tests across 78 files (run fresh, exit 0). `npx tsc --noEmit` clean (exit 0).
- Branch has **zero commits** — it sits exactly on main's tip. No code has been written.
- Bundle chunks already include `data-ml` (mlTracks/mlProjects/courseRecall) beside
  `data-curriculum` — the ML work will not bloat the app chunk (vite.config.ts:37-41).

## 1. Locked constraints that shape V8 (do not re-litigate)

- **Interview mode is self-assessment. No automated judge, ever** (PRODUCT.md:45). Enforced by
  test at two layers: no engine export matching `/score|grade|total|verdict|rating$/i`
  (interview.test.ts:324-331) and no score-like copy in the DOM (interview.test.tsx:369-372).
  V8's "dimensions, never one score" is *compatible* — dimension-level self-reported evidence may
  persist; it must never aggregate.
- **Contest reading stays conservative** (PRODUCT.md:46): no score/rank/percentile, barely-touched
  problems produce no claim, mostly-unattempted sittings are inconclusive, the live slice never
  persists. The shape easy/medium/medium/hard with distinct patterns, unsolved only, date-seeded,
  is locked spec.
- **Weakness is claimed in exactly one place** (`selectPatternWeakness`). The V7 rule holds: new
  evidence may enter as a question-level session-priority reason (the `hint-reliant` precedent —
  adds priority, never reschedules, never penalizes) or as a properly weighted signal in
  `weakness.ts` — never as a second model, and a sentence is a weakness claim regardless of
  which selector fed it.
- **No per-problem company data, ever** (CLAUDE.md, PRODUCT.md:43 — settled finding, not a gap).
  Company-named sentences gate on `evidence === 'topics'`. No readiness scores; workload only.
- **V6 copy rules 1–6 bind all new copy** (practice-engine record §4): failure converts to
  information never judgment; recommendations only shrink; no "research shows" without a finding;
  small start complete in itself; no Buddhist/Zen mechanism language; quotes verbatim+attributed.
- **The V7 record marked "ML implement/experiment tracked ladders" (P31/P33) deliberately
  not-built. The V8 directive explicitly overturns that decision** — this record documents the
  reversal rather than silently contradicting the standing record. What changed: V6's reasoning
  ("no researched content to track") no longer holds — the content shipped (mlTracks/mlProjects,
  verified, measured); only the tracking layer is absent.
- Validator-write-path parity; three non-summable time dimensions; suppress-never-pad analytics;
  hints are signal never penalty; `MAX_PLAUSIBLE_RATIO = 6` synchronized in three files
  (timeEstimate.ts:23, weakness.ts:102, insights.ts:831) — a fourth timed-pace consumer inherits
  the obligation.

## 2. Directive coverage — ALREADY EXISTS / PARTIAL / MISSING

### ALREADY EXISTS (do not rebuild — the directive's own non-negotiables)

| V8 ask | Shipped as |
|---|---|
| Staged interview with cognitive structure | 10 stages (understand→clarify→approach→brute-force→optimize→invariant→implement→test→complexity→follow-up), progressive reveals gated per stage (hints@approach, pattern@brute-force, family@invariant, tests@implement, bounds@follow-up), engine/interview.ts (664 lines, heavily test-pinned) |
| Follow-up questions testing understanding | `followUpsFor` — 7 evidence-selected axes, max 4, each with a `because` provenance line; shared verbatim with the question sheet |
| Interview pace without countdown pressure | `paceReading`/`paceNote` — counts up, factual, no urgency |
| Contest set + timed sitting + conservative analysis | `buildContest` (locked shape), live `contest` slice, `analyzeContest` outcomes clean/slow/stalled/untouched, inconclusive gate, `contests` stall channel → weakness 8th signal (fully wired and tested) |
| Question summary ("what is this really testing") | `tests` sentence, 539/539, quality-gated (8–45 words, no prompt restatement, closed-world key set). V8's own example sentence matches its style |
| Question learning-object fields | type taxonomy (6), authored minutes (band-checked, variety-enforced), complexity (508/539), family+role (438), subpattern (489), verified URL identity (528 links green), derived hint ladder, derived follow-ups |
| Transfer chains in data | 103 families with canonical/warmup/standard/variant/stretch roles, exactly one canonical each, cross-pattern allowed, acyclic-by-construction |
| ML from-scratch curriculum content | 11 tracks (math→scratch→library→experiment→failure; measured experiment expectations, version-pinned library rungs, ≥2 failure modes each) + 14 baseline-anchored projects — all validated, all read-only |
| Company evidence layer | 17 first-party sources, 5 with topics-evidence patterns, verbatim quotes, three-valued live audit; `practicePicks` already computes profile × standing × unsolved verified set |
| "Why am I seeing this now" | `WorkItem.why` required on every ranked item; session `reasonText` per activity |
| Confidence calibration | `confidenceCalibration` (solve confidence vs first recall, floors, verdicts) |
| Anti-gamification / anti-cramming / anti-copying | XP gates, first-attempt-per-date, committed-work sittings, hint-use-as-signal, reconstruction via deep band |
| Time-budget intelligence | `shapeFor` budget→shape (quick/standard/focused/deep/extended), time-chooses-depth, arc, HEAVY_LOAD spacing, second offer, pull-forward |

### PARTIAL (the real V8 work)

| Area | What exists | What's missing |
|---|---|---|
| Interview | Full staged sitting | **Nothing persists** — debrief copy (InterviewPage.tsx:511-513) promises cross-sitting comparison storage cannot deliver (live contradiction). No reflect capture, no follow-up response capture, no expectation/calibration, selection is pure seeded shuffle over unsolved (no weakness/mastery/company input), no reconstruction path |
| Contest | Sitting + analysis + stall channel | **The clock cannot run while the learner works** (root cause of the dead patternGaps path, §3). No wrong-attempt or skip/set-aside model, per-problem time/outcomes discarded, no time-management reading, no reconstruction loop (only patterns survive, not question ids) |
| ML build mode | All content | No progress, no evidence, no reconstruction, no planner presence, no activity credit |
| Question intelligence surfaces | Data + modal | No contextual practice-time surface (derivable from shipped constants — zero new authored numbers needed), family ladder collapsed + post-solve only, no "N of M solved" family progress, `openSiblings` filters to untouched only |
| Company preparation | Page + picks | No persisted target company, no memoized selector seam, no interview integration, ungated `companiesNamingPattern` footgun (src/data/companies.ts:68 — safe only by accident) |
| Performance-gap analytics | 12 insight builders; `accuracyDirection`'s improving branch already *recommends* /contest ("the one dimension never tested is the clock") | The measurement itself — blocked on persistence (interview/contest evidence must survive first) |

### MISSING entirely
- `interviews` persisted channel; contest per-problem persisted evidence; ML progress slice;
  target-company setting; timed-vs-untimed measurements and builders.

### RECORDED (deliberately not built, with reasons)
- **Per-question authored trap/edge-case library (539×)**: the directive's own rule — "do not
  invent traps" — bars it. Family-level traps (103, hand-verified), derived follow-up axes, and
  the learner's own `missKind`/`lastMissNote` cover the need with real evidence. A researched
  per-question pass is possible future work; it is not fabricatable now.
- **Role-based interview contexts (Backend/Full-stack/AI-engineer...)**: the dataset is a DSA
  roadmap; role-specific processes would be fabricated content. Honest contexts that ship:
  General (default) + optional verified-company topic scope. Difficulty/time already adapt.
- **A 9th weakness signal from interview evidence**: interview sittings are rare events; a
  pattern-level signal would almost never clear `MIN_OBSERVATIONS` and would dilute the weight
  budget for nothing. Interview evidence routes at question level through session priority
  (hint-reliant precedent) instead.
- **New session presets below 15 minutes**: PRODUCT.md's smallest-real-start contract is the
  two-minute hero entry and the five-minute re-entry — both shipped. A "5-minute session" preset
  would duplicate them and touch the locked capacity validator for no gain.
- **New authored ML tracks (kNN, tokenization/BPE, embeddings, optimizers)**: CONTINGENT.
  The existing tracks' `experiment.expect` values were measured on real runs (numpy 2.5.2,
  scikit-learn 1.9.0, PyTorch 2.13). New tracks meet that bar only if the experiments are
  actually run during authoring. If a resuming session can run Python/numpy locally, this
  becomes a slice; otherwise it stays recorded with this reason. Do not ship unmeasured numbers.
- **Modern-LLM prose curriculum beyond the course**: the 100xDevs weeks + projects already cover
  RAG/fine-tuning/RLVR/evals/agents with dated first-party resources. New prose claims about
  fast-moving topics require fresh primary sources at authoring time; nothing in the V8 slices
  depends on them.

## 3. The contest patternGaps dead path — root cause (V7 handoff's open finding, now traced)

Three blockers, in order:

**(a) PRIMARY — the clock cannot run while the learner works.** ContestPage stops the stopwatch
on `visibilitychange → hidden` (ContestPage.tsx:111-124), and the only sanctioned work surface is
the external LeetCode link (the in-app sheet is deliberately disabled during a contest, comment
at :68-71). Attempting a problem therefore ALWAYS hides the tab; `blurContestProblem` settles ~0
minutes; nothing re-arms on `visible`. Every unsolved problem classifies `untouched`
(< target×0.25), the sitting is `inconclusive`, `patternGaps = []`, and `finishContest` bails at
actions.ts:605. The comment at :105-110 built this to prevent false stalls from walking away; the
side effect is that true stalls are unrecordable for anyone who works in a browser.
**Fix (slice 1): trust the explicit control.** "Put on the clock" is a deliberate commitment;
hidden time counts while armed; Pause is the learner's own honest exit. Copy near the clock says
the clock runs until paused. The pinned test "unmount stops the clock so away-time is never a
stall" (contest.test.tsx:160) changes DELIBERATELY: unmount still settles; hidden no longer blurs.

**(b)** Weakness `MIN_OBSERVATIONS = 2` vs one-stall-per-pattern-per-day (within-sitting dedupe +
first-sitting-per-date wins): a pattern must stall on two separate days' random draws before the
signal exists at all. This is intended conservatism (test-pinned: "a single stall stays silent
everywhere") — keep it; (a) fixing data flow makes it merely strict rather than starved.

**(c)** Contest-only firedWeight 0.08 < MIN_EVIDENCE_WEIGHT 0.5 caps a lone contest signal at
score ≈0.16 — out-ranked and sliced at MAX_WEAK_PATTERNS = 5. Also intended (a lone signal
whispers). Slice 2's widened record gives the verdict surface its own question-level readings so
the learner still sees the finding the pattern-level model rightly refuses to shout.

## 4. Architecture reference (the load-bearing facts a resuming session needs)

### Interview (engine/interview.ts, interviewSlice, InterviewPage.tsx)
- Stages/reveals/outcomes/self-assessment/timer/follow-ups as in §2. Slice is UNPERSISTED by
  design (docblock :13-39); page dispatches slice actions directly, no thunks exist; the only
  durable side effect is `revealHint` raising `hintLevelUsed` (which already feeds the session's
  reconstruction gap: selectors.ts:602, session.ts:211,338).
- Selection today: unsolved pool → `seededShuffle(interview:${today})` → rerolls index. Memos
  short-circuit while running so `revealHint` can't reshuffle mid-sitting.
- Landing leak-fence test: body text must not contain pattern/family/signals/tests/complexity/
  follow-ups pre-commit. Any selection change must preserve this — the *reason* for a draw may
  only be stated post-finish (or without naming the pattern).
- Known defects to fix in slice 3: `startedOn` written never read; `stageOutcomeSet` writable
  post-finish (loose guard); no interviewSlice unit test file; debrief comparison copy
  contradiction (:511-513).

### Contest (engine/contest.ts, contestSlice, contestsSlice, ContestPage.tsx)
- `ContestAttempt = {questionId, solved, minutesSpent}` is the entire attempt model. Outcomes:
  clean / slow(>1.5×target) / stalled / untouched(<0.25×target, no claim). `inconclusive` =
  informative < ceil(total/2). Banked record: `{stalledPatterns, attempted, total}` by date,
  first-write-wins. Everything else discarded on clear.
- `finishContest` (actions.ts:601-619) is the thunk-normalization template (the logDrillResult
  discipline). `solveContestProblem` routes through the real `solveQuestion`.
- `ContestInput.shape` is dead config (only tests pass it); `startContest` hard-codes
  `seed: todayISO()`. Keep shape locked; decide in slice 2 whether shape stays test-only.

### AI/ML (engine/aimlCourse.ts, courseSlice, /aiml, mlTracks/mlProjects data)
- Course: 26 core weeks + 5 extras, 2-day sprints, XP 20/50/10, one ladder shared with DSA,
  recall dialog (130 prompts, first-attempt-per-date), activity derived via
  `courseActivityByDate`, schedule derived-forward ("behind" impossible).
- Tracks: 11, five rungs each (math/scratch/library/experiment/failure), prereq DAG, minutes per
  track (75–240); Projects: 14, baseline-anchored. Both rendered read-only on /aiml sections 7–8
  (MlTrackRow/MlProjectRow, local useState only). Pipeline: scripts/data/ml-implementation-a/b
  .json + ml-projects.json → generate-questions.mjs validates → emits src/data. Never hand-edit
  emitted files.
- New-slice wiring precedents (all verified): store.ts:6,20; serialize.ts:26,40
  (write-when-non-empty); entry validator pattern serialize.ts:171; load normalize
  persistence.ts:103-110; types/index.ts:163-184 + PersistedStateV1:249-278; thunk discipline
  actions.ts:332-408; activity merge selectors.ts:89,161-162,177-184 + CalendarPage.tsx:148;
  forecast predictor.ts:105-119 (`combinedRevisionLoadForecast` already composes two ladders);
  planner constants planner.ts:47-51; achievements.ts:18-33,144-181.

### Question intelligence (generator, curriculum, modal)
- Counts: 539 questions; 103 families / 438 member slots (canonical 103, warmup 62, standard 86,
  variant 109, stretch 78; 101 questions unmapped — honest gaps stated in 4 places); 108
  subpattern groups over 26/28 patterns; 508 with complexity; 528 LC-linked (61 premium), 11
  NOT_ON_LEETCODE. Intelligence schema is EXACTLY `{type, tests, minutes, complexity?}` with
  unknown-field rejection; key set exactly SECTIONS titles both directions.
- SECTIONS in generate-questions.mjs is positional — **reordering renumbers every question id
  and would corrupt all persisted progress. Never reorder.** Abort-before-write barrier exists.
- Modal disclosure contract (QuestionDetailModal.tsx:53-75): complexity, family write-up,
  follow-ups, companies are POST-attempt; hints pre-attempt only while unsolved; derivations
  gated at compute time (:152-153), not JSX.
- `depthMinutes` (session.ts:67-79): recall = clamp(est×0.15, 3–5), deep = clamp(est×0.6, 10–25),
  transfer = clamp(est×0.9, 20–40) — the derived basis for slice 6's practice-time line.
- curriculum.ts exports FAMILIES/SUBPATTERNS/familyById/FAMILY_ROLE_ORDER/FAMILY_ROLE_LABEL; no
  walk/sibling helpers exist (consumers re-derive inline).

### Companies (engine/companies.ts, CompaniesPage.tsx)
- 17 sources; topics tier (usable patterns): google 12, meta 8, microsoft 7, doordash 12,
  roblox 7; netflix avoids-puzzles (never gets practice offers — test-pinned); 11 categories-tier.
  Pattern union 14/28 — half the roadmap has zero company evidence; the mode needs its
  first-class no-mapping state (NoMappingSection/BroadPracticeSection precedents).
- `practicePicks(coverage, all, byId, limit=8)` already sorts gap<developing<unreviewed<strong,
  then difficulty, then id. `standing: strong` requires ≥60% solved AND reportable passRate ≥0.7.
- DOM-level copy fence: body never matches /asked by|asked at|commonly asked|frequently asked|
  top questions|most asked/i (companies.test.tsx:102-120). No %-figures in the practice region.
- FOOTGUN: `companiesNamingPattern` (src/data/companies.ts:68) is ungated by evidence tier —
  fix in slice 7.

### Spine (nextAction, session, weakness, insights)
- rankWork emission order = priority spine: revision (topUp last, overdue desc) → drill →
  course-review → new-question (why = tests verbatim) → course-session → task. `'done'` kind is
  declared but never emitted.
- Session: depths recall/review/deep/transfer; SHAPES quick≤20/standard≤45/focused≤75/deep≤105/
  extended; score() terms overdue/due/failed/low-confidence/weak-pattern(×8, the ONLY weakness
  entry)/hint-reliant(7); deepest-band-first selection, lightest-first playback; enforceSpacing
  never places two HEAVY_LOAD (3.2) items adjacent; REFLECT reserved ≥30 min.
- Weakness: 8 signals, weights sum exactly 1.0, cap 0.24 (retention .24, recognition .22,
  transfer .10, unfinished .10, confidence .09, pace .09, contest .08, hints .08);
  RECENCY_HALF_LIFE 30d; MIN_OBSERVATIONS 2 (unweighted); MIN_LIVE_EVIDENCE 1.0 (rate signals
  only — count signals saturate instead: DRILL_SATURATION 4, CONTEST_SATURATION 3);
  combine() denominator = max(firedWeight, 0.5). Unmeasured = absent, never zero.
- Insights: 12 builders each with own floor returning null; buildInsights sorts
  attention<steady<strength; [0] is the page Lead. `recognitionGap` is the template for any
  cross-denominator gap card (chance-corrected comparison). Measurements live in the file's
  second half. STALE COPY BUG: AnalyticsPage.tsx:361 enumerates 7 of 8 signals (contest
  missing) — fix in slice 8.
- Three non-summable time dimensions: DayLog.focusMinutes (canonical), QuestionProgress
  .timeSpentMin (per-question breakdown, NEW questions only via ui.focusQuestionId), contest
  minutesSpent (ephemeral third). Interview elapsed is a fourth ephemeral one. Never sum across.

## 5. V8 shape — one sentence per mode

An **interview** is a staged sitting that now leaves a conservative dimensional record behind and
draws its problem where the evidence says recognition is shaky; a **contest** is a truthful clock
whose per-problem readings persist and feed both the weakness signal and a calm second look; the
**ML tracks** become practicable — rungs stamp, the scratch rung enters the one ladder as
"rebuild from a blank file", and the day plan surfaces due rebuilds; **analytics** finally
compare practice with performance because the performance evidence survives.

## 6. The slice plan (implementation order; each slice = RED→GREEN→REFACTOR→INTEGRATION→QA)

### Slice 1 — The contest clock tells the truth
Root fix for §3(a). `contestSlice` unchanged; ContestPage stops dispatching
`blurContestProblem` on `visibilitychange` (unmount still settles); copy near the clock states
"the clock runs until you pause it — pause if you step away"; the away-time page test is
rewritten to pin the NEW contract (armed+hidden accrues; pause stops; unmount settles).
Engine untouched. Tests: contest.test.tsx updates + a new armed-while-hidden case.

### Slice 2 — The contest records what happened
- Live slice: `attempts[id]` gains `wrongSubmits: number` (a "Submitted — didn't pass" tap) and
  `setAside: boolean` (an explicit "Set it aside" control — the skip-with-intent V8 asks for);
  new actions with guards; page controls in the problem row.
- engine/contest.ts: `ContestAttempt` widened; new outcome `'set-aside'` (a deliberate skip is
  never read as a stall); `analyzeContest` readings mention wrong submits factually; new
  `timeReading(contest, attempts): string | null` — factual time-allocation sentences with a
  floor (≥2 problems with meaningful time, else null), e.g. naming where the minutes went. No
  judgment registers ("worse under pressure" is banned copy).
- Persistence: `ContestStallRecord` gains optional `stalledQuestionIds?: number[]` and
  `problems?: Array<{questionId, minutesSpent, targetMinutes, outcome}>` — optional-with-
  boundary-default, validator lenient (bare strings/int ranges), `finishContest` normalizes
  (widen, never break old payloads; persistence round-trip tests).
- Verdict: stalled problems each offer "Take a calm second look" (opens the question sheet);
  patternGaps beyond [0] render as a quiet ruled list.
- Decision recorded: `ContestInput.shape` stays test-only config; the shape is locked spec.

### Slice 3 — The interview banks a record
- New persisted `interviews` slice: `{ sittings: InterviewSittingRecord[] }` capped at 40
  (practice.sittings precedent). Record: `{date, questionId, stageReached: number,
  outcomes: Record<string, string>, assessment: Record<string, number>, minutes: number,
  hintsTaken: number, hintsAvailable: number, expectation: number | null,
  followUpsAsked: number, followUpsHeld: number | null, reflection?: string}` — stage ids and
  outcome values validated as bare strings (a removed stage never quarantines), numbers clamped.
- `finishInterview` thunk (contest discipline): settles the live slice, derives the record,
  normalizes, banks, then `interviewFinished`. Live slice stays unpersisted — the record is
  derived, the sitting is a performance.
- Debrief gains "Last sitting" marginal-note comparison once ≥2 sittings exist — resolving the
  shipped copy contradiction honestly.
- Fix the found defects: use `startedOn` in the record; tighten `stageOutcomeSet` guard; add the
  missing `interviewSlice` unit test file; persistence round-trip tests for the new channel.

### Slice 4 — The interview asks better
- Optional pre-start expectation ("How do you expect this to go?" 1..5) on the landing after
  title+difficulty only; stored on the record; feeds slice 8's calibration extension.
- Selection: weighted seeded draw over the unsolved pool — weight up questions whose id appears
  in recent `stalledQuestionIds` (contest reconstruction: the interview IS the re-serve
  instrument, staged and hint-gated), then questions in `selectPatternWeakness` patterns, then
  hint-reliant family siblings. The landing stays leak-fenced (no pattern named); the *basis* is
  stated only in the debrief ("drawn from an area your recent evidence marked shaky" /
  "you stalled on this in Thursday's contest"). Reroll walks the same weighted order.
- Reflect: one optional line at debrief close (stored on the record; information register).
- Follow-up capture: per shown follow-up, a 3-way chip (held / partly / couldn't) in the
  debrief; counts stored.

### Slice 5 — ML build mode gets a memory
- Types: `MlTrackProgress {rungs: Partial<Record<RungId, string>>, revisionStage, nextRevision,
  lastReviewed, revisionHistory}` (ladder entered when the scratch rung is first stamped);
  `MlProjectProgress {startedOn: string | null, shippedOn: string | null}`.
  `PersistedStateV1.ml?` optional channel.
- New `mlSlice {tracksById, projectsById}` (sparse; NOT courseSlice — separate id space, weekId
  frequently null); serialize/validate/normalize per the course precedents; thunks
  `completeMlRung` (stamp-once, XP double-entry), `reviseMlTrack` ("rebuild the core loop from a
  blank file, then grade yourself" — one grade per track per day), `startMlProject`/
  `shipMlProject`.
- engine/mlTrack.ts (pure, parallel to aimlCourse.ts): own XP register (rung 15 / track clear
  bonus 50 / rebuild review 10 — proportionate to the course's 20/50/10 given track weight),
  `mlTrackActivityByDate`, `dueMlTrackIds`, ladder items for the forecast.
- rankWork: new `ml-review` kind ranked beside course-review (retention outranks acquisition);
  rung *progression* stays page-initiated on /aiml (recorded reason: the course carries the paced
  sprint contract; tracks are self-paced electives — no treadmill).
- /aiml: MlTrackRow gains rung stamps + progress; "Review due" section includes track rebuilds;
  activity/streak/calendar merge; forecast merge.

### Slice 6 — Question intelligence surfaces
- PostSolvePanel gains one derived practice-time line ("Quick recall ~4 min · Re-implement
  ~15 min · Transfer ~25 min") computed from `depthMinutes` — zero new authored numbers,
  post-attempt placement (pre-attempt it's noise).
- FamilyPanel header gains "N of M solved" progress; `openSiblings` includes partially-walked
  families (solved members render struck-through, as the ladder already does).
- Traps per question: recorded-not-built (§2). `tests`-as-summary: shipped, recorded.

### Slice 7 — Company preparation, verified only
- `settings.targetCompanyId?: string` (optional, bare-string validated, clearable; validator
  admits anything the UI can write). Set/clear from the company detail page.
- Memoized `selectCompanyCoverage` / `selectCompanyPracticeSet` selectors (engine wrappers only).
- Today: when a topics-evidence target is set, one quiet pointer line to /companies/:id using the
  existing standing vocabulary (coverage language, not weakness language). Categories-tier
  targets get the honest no-mapping state; avoids-puzzles refuses targeting.
- Interview landing: "Draw from {name}'s named topics" toggle (gated on topics evidence; scope
  filters the draw pool by mapped patterns; leak-fence preserved — the pattern itself stays
  unnamed pre-commit).
- Fix the ungated `companiesNamingPattern` footgun (gate by evidence tier + test).
- Extend the companies copy-fence test loop over every new sentence.

### Slice 8 — Performance-gap analytics
- Measurements (insights.ts second half): `timedRecord(contests)` reading the slice-2 widened
  records (solve/slow/stall shares, floors stated); `interviewLog(sittings)` (hints-per-sitting,
  stage-reached, expectation-vs-outcome). Floors: suppress below ~2 sittings / ~6 informative
  problems — exact values set at implementation with the resolution argument written down
  (the MIN_CALIBRATION_SAMPLES=8 precedent).
- Builders: `timedGap` (untimed recall pass rate vs contest performance — chance/denominator
  discipline from `recognitionGap`; tone attention/steady; never "worse under pressure"
  framing), `interviewIndependence` (hints trend across sittings; strength/steady),
  `interviewCalibration` (expectation vs outcome verdicts).
- AnalyticsPage: rows with the "needs N — you have M" suppression pattern; fix the stale
  :361 signal enumeration (add contest).
- InterviewPage debrief: cross-sitting read-back (slice 3 shipped the storage).

### Slice 9 — Coherence audit + the final pass
- Session/time audit across 15/30/60/90/120 budgets (V8's per-budget coherence table maps to
  shipped SHAPES; verify each budget's arc, fix only genuine incoherence).
- Full QA: suite green, tsc clean, bundle ≤ 301 kB (lazy-load any heavy new surface), browser QA
  at 375/768/1024/1280 both themes, keyboard/a11y on new controls (radiogroup/aria pins),
  adversarial sweep (gaming: XP-free records everywhere; farming: stamp-once + caps; migration:
  old payloads round-trip), docs (CLAUDE.md invariants, PRODUCT.md if product truth changed,
  HANDOFF.md), merge to main, push.

## 7. Invariant analysis (what the slices must not touch)

- The revision ladder is locked. Nothing in V8 reschedules anything: contest stalls, interview
  records and ML evidence may only add session priority or inform selection.
- All new records are XP-free except the ML rung/clear/review register (a real work register,
  stamp-once, double-entry). Classifying, reflecting, expecting, setting aside: no XP, ever.
- The live interview and contest slices stay unpersisted (a restored stopped clock lies). Only
  thunk-normalized derived records persist. Every new persisted field is optional-with-boundary-
  default, admitted leniently, normalized at the write path, round-tripped in persistence tests.
- One weakness claimant. New sentences about patterns name their own basis. The interview draw
  reason must never leak the pattern pre-commit (the leak-fence test is the gate).
- Suppression, not padding, for every new measurement; floors stated in copy.
- No score, grade, rank, verdict, or aggregate anywhere in interview/contest surfaces (the
  anti-score export test and DOM tests stay green and extend to new copy).

## 8. Verification log

- 2026-08-15: baseline re-verified on the branch (1068/1068, tsc clean); six inspection passes
  complete; this record written. **No implementation yet. Next action: slice 1.**
- 2026-08-15 (same session, resumed): **all nine slices shipped.** 1160/1160 tests across 81
  files, tsc clean, app chunk 276.92 kB against the 301 kB budget. Browser QA at 375/768/1024
  with both themes' tokens confirmed flipping.

### What changed against the plan, and why

- **Slice 2, persisted record shape.** The plan specified both `stalledQuestionIds` and
  `problems` on `ContestStallRecord`. Shipped with `problems` only: two persisted fields carrying
  the same truth can drift, and the stalled ids derive from the rows (`stalledIdsFromRecord`).
- **Slice 2, write gate.** The plan kept `finishContest`'s "only bank when there are stalls" rule.
  Changed deliberately: EVERY conclusive sitting now banks, with `stalledPatterns: []` when
  nothing stalled. A channel that only keeps the bad afternoons is a sample selected for failure,
  and slice 8's practice-vs-performance comparison would have inherited that bias wholesale. The
  validator was widened to admit the empty array (widening never quarantines).
- **Slice 6, `openSiblings`.** Recorded, not built. It feeds the pre-solve Explore/Practice groups
  and the single `next` recommendation, both of which must stay untouched-only or the sheet starts
  recommending problems already solved. The family ladder already renders solved members struck
  through; the "N of M solved" count above it was the real gap.
- **Slice 8, the comparison itself.** The directive's "untimed accuracy vs timed accuracy" was
  rejected as a category error: untimed practice has no failure state (everything is eventually
  marked solved), and revisiting a solved problem is not the same task as meeting a new one cold.
  Shipped instead: untimed pace ratio vs timed pace ratio, both over problems the learner solved,
  both against the authored estimate — populations differing only in the clock.
  `MAX_PLAUSIBLE_RATIO` gained its fourth consumer and applies to both halves.
- **Slice 9 found two bundle regressions the plan did not anticipate**, both "work for one lazy
  route landed on every page's boot": `data-ml` (275 kB) became a static import of the app chunk
  via `actions.ts`/`selectors.ts`, fixed with `src/data/mlTrackIndex.ts` (three tiny facts,
  test-pinned against the dataset); and `insights.ts` sat in the app chunk for /analytics alone,
  fixed by `store/analyticsSelectors.ts`. Net: 300.58 kB → 276.92 kB, below the V7 baseline.
- **Slice 9 found one live layout defect**: the contest problem row's control cluster was
  `shrink-0`, which survived three controls (352 px) and overflowed the viewport at four. Fixed to
  `w-full … sm:w-auto`; verified no horizontal overflow at 375/768/1024.

### Known trade-offs, recorded rather than fixed

- **An armed contest problem left overnight banks a large stall.** The slice-1 contract is that
  the clock runs until the learner pauses it, so arming a problem and returning the next day
  before pressing Finish records those minutes. It requires not reloading (the live slice is
  unpersisted, so a reload ends the sitting), and the learner sees the figure on screen before
  finishing. The one reader that could be misled by it — `timedPace` — already discards ratios
  above `MAX_PLAUSIBLE_RATIO`. Capping the recorded minutes was rejected: it would silently bank
  a different number from the one the learner was shown.
- **Contest row controls are 36 px tall**, below the 44 px guidance. That is the app-wide
  `size="sm"` button, shared with the course review list and every question row; changing it on
  one page would make that page inconsistent with the rest of the product. The new chip controls
  (expectation, follow-up outcomes) DO meet 44 px, because they use the existing `CHIP_CLASS`
  idiom which already specifies it.
