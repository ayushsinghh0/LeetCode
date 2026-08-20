# MASTER IMPLEMENTATION PLAN — Deep DSA Mastery System (V14 → V15)
## The definitive, pause/resume-safe contractual specification

> **Status: PLANNING DOCUMENT ONLY. Nothing in this file has been implemented beyond what
> Part A explicitly records as already landed.** No branch is to be created, no code modified,
> and no commit made on the strength of this document until the user approves it.

---

## CONTEXT — why this plan exists

The product is a local-first DSA training system (React 18 + TS strict + RTK + Vitest; pure
deterministic engines; two question universes: the 539-question roadmap curriculum and the
2,561-problem contest library; V13 shipped contest intelligence end-to-end). The user supplied
a 1,210-row topic-wise revision sheet and a master specification whose actual objective is not
"more questions" but **interview-grade, transferable DSA reasoning**: recognition under
novelty, reconstruction after delay, correct tool selection under ambiguity, and performance
under pressure — with the roadmap kept pure and revision kept contextual, economic, and
explainable.

A V14 execution plan (`docs/superpowers/plans/2026-08-20-revision-sheet-integration.md`)
already exists and is partially executed (Tasks 0–1 of 12 landed on branch
`v14-revision-sheet`). The user has now issued a **planning-only master specification** that
demands: audit V14 against the deeper goal, preserve what is right, specify what is missing
(mastery model, contextual revision, failure→practice routing, transfer/interleaving,
pattern discrimination, blind/cold-start modes, browser QA, migration/rollback), and produce
one contractual master plan another engineer could implement task-by-task with pause/resume
safety.

This document is that plan. It contains: **Part A** — the master audit report (what exists,
what V14 got right, what it missed, and one genuine defect found in V14's design);
**Part B** — the master implementation plan (architecture, models, invariants, phases, tasks,
gates); **Part C** — open questions; **Part D** — handoff/resume.

---

# PART A — MASTER AUDIT REPORT

## A1. Current repository state (verified, not assumed)

- Branch `main` at `7240a10` (V13 complete: slices 0–7, 1,306 tests green, 91 files).
- Branch `v14-revision-sheet` exists with exactly two commits **already landed before this
  planning phase began** (they are recorded here as current state, not as work this plan
  performs):
  - `5f36816` — shared tag→pattern mapper (`scripts/lib/pattern-map.mjs`, extracted verbatim
    from the contest generator; contest library regeneration proven byte-identical except
    `generatedAt`), plus the V14 execution plan document.
  - `66ad94c` — V14 Task 1: `scripts/generate-revision-sheet.mjs` emitting
    `src/data/revisionSheet.json` (53.5 kB dictionary-encoded; 1,210 rows = 315 curriculum-ref
    / 587 library-ref / 173 sheet-only rows (159 unique) / 134 external / 1 ambiguous; the 159
    map 140 exact · 17 strong · 1 heuristic · 1 unmapped via the one shared mapper; roadmap
    exclusion enforced by construction and re-checked as a build gate).
- Working tree clean. V14 Tasks 2–12 are **not** implemented.
- The audit deliverable exists: `revision-sheet-report.md` (closed-world resolution of all
  1,210 rows; 0 unresolved; 1 ambiguous; per-topic tables; appendices for the 159 additions,
  the 134 externals, 27 difficulty disagreements). `REPORT.md` cannot exist by that name on
  this case-insensitive filesystem beside the repo audit `report.md`; the report above is the
  audit of record.

## A2. The existing architecture this plan builds on (subsystem audit)

*(Summarized from direct code reading; exact signal registries, thresholds and copy quoted in
the model sections of Part B where they become load-bearing.)*

- **One scheduler.** `engine/spacedRepetition.ts` — the 1/3/7/15/30 ladder
  (`ladderEntry`/`ladderAfterReview`/`isLadderDue`, stage 5 = mastered-off-ladder). Registers
  on it: `progress.byId` (curriculum), `course.byWeekId`, `ml.tracksById`,
  `contestLibrary.bySlug` (slug-keyed, sparse, boundary-normalized).
- **One prioritizer.** `engine/nextAction.ts` `rankWork` (retention over acquisition; hero =
  `[0]`; plan = greedy pack). **One session composer.** `engine/session.ts`
  `buildRevisionSession` (time chooses depth, not count; heavy-load caps + spacing; arc =
  deepest-band-first selection, lightest-first playback; overflow deferred, never a headline).
- **One weakness model.** `selectPatternWeakness` blending eight decayed signals (drills,
  revision pass rates, contest stalls at weight 0.08, etc.), `MIN_LIVE_EVIDENCE` suppression;
  absent-not-strong for no-evidence patterns; every weakness sentence sources from it.
- **Failure evidence exists but is event-level.** `engine/miss.ts` one-tap miss kinds attach
  to the day's fail event (`RevisionEvent.missKind`); aggregation describes the learner's tags
  only. `engine/hints.ts` — derived 3-rung ladder from family `signals/idea/trap`;
  `hintLevelUsed` monotonic, XP-free; `isHintReliant` (rung ≥2, no passed review since) may
  only ADD priority. `engine/mastery.ts` reports ladder state and hint use side by side.
- **Recognition evidence.** `engine/drills.ts` date-seeded same-pattern drills; first attempt
  per date is the recorded signal; past misses weight future drills.
- **Performance evidence.** `engine/contest.ts` (`selectContestSet` with diversity relax
  rungs; `analyzeContest` sole owner of conclusive/inconclusive; `hasRealTime` gate;
  conclusive sittings banked to `contests` incl. clean ones) and `engine/interview.ts`
  (V8: staged sitting, self-assessment amending the banked record, measured-never-farmed).
- **The contest library** (V13): slug-joined, dictionary-encoded, `data-contests` chunk with
  exactly three permitted static importers; rating = ZeroTrac estimate, never "official";
  band reading via `bandEvidenceFromRegister` + `recommendBand` (≥ `MIN_BAND_EVIDENCE` = 4,
  advance ≤ 1 band); Contest Revision with frozen due lists; weak-areas + Recreate draws.
- **Persistence.** `PersistedStateV1`, optional-with-boundary-default evolution, two read
  paths (boot `loadInitialState` + import `stateImported`) both wired, quarantine on invalid,
  validator-never-stricter-than-write-path rule with round-trip tests.
- **Locked product rules** (PRODUCT.md): ladder numbers, XP 10/20/30 (half for revision),
  bonus gates, finishable daily plan, two-universes rule, XP ≠ mastery.

## A3. What V14 already solved correctly (PRESERVE — carried into Part B verbatim)

| Area | V14's answer | Verdict |
|---|---|---|
| No third universe | Lens dataset referencing owning universe per row; only the 159 carry metadata | **Correct — keep** |
| Identity & joins | Slug-only joins; closed world; frontendId from the topic snapshot; shared tag mapper | **Correct — keep** |
| Roadmap exclusion | By construction in the generator, structurally in `selectSheetRevision` (default `includeRoadmap: false`), UI toggle visible/reversible, tests at dataset+engine+UI levels | **Correct — keep** |
| No invented metadata | Externals named-never-linked (amended in B: verified links via an authored table); ambiguous stays ambiguous; sheet-only problems carry **no rating field at all** | **Correct — keep (one amendment)** |
| One scorer | `scoreRevisionFacts` extraction plan (core of `scoreRevisionCandidates`), reused by sheet draws | **Correct — keep** |
| Progress register | Non-curriculum rows in existing `contestLibrary.bySlug`; zero schema change for solves/reviews; boot path already wired | **Correct — keep (one amendment: provenance flag, see A5)** |
| Nav discipline | No 17th destination; sheet folds into `/contest-practice` as `?view=sheet` | **Correct — keep** |
| Frozen due lists | Sheet revision mode freezes membership+order per `date|mode|topic|toggle` | **Correct — keep** |
| Bundle law | `data-sheet` chunk; dataset-free decoder; permitted importers pinned | **Correct — keep** |
| Pause/resume | Ledger + step checkboxes + per-task commits + resume procedure | **Correct — keep** |

## A4. What V14 missed (the gap between "sheet integration" and "mastery system")

V14 was scoped to the sheet as a lens. The master goal needs seven capabilities V14 never
claimed to deliver — all **new design surface**, specified in Part B:

1. **No mastery model** (§12–§13): nothing aggregates evidence per pattern into
   recognition / recall / reconstruction / implementation / transfer / timed / independence
   readings; nothing says INSUFFICIENT_EVIDENCE; nothing gates blind-mode graduation.
2. **Contextual revision exists for the curriculum but not for the second universe** (§11):
   `buildRevisionSession` is already deeply contextual (weakness, hint-reliance, fragility,
   staleness, depth bands, load arc, a transfer band with family candidates, per-shape
   purpose blurbs) — but the sheet/library scorer ranks only by due/recency/attempts/
   weakness/confidence: no capability-emphasis term, no novelty, no redundancy guard beyond
   identity dedupe, and no session-purpose framing on the contest/sheet revision surfaces.
3. **Failure does not route practice** (§17–§18): miss kinds are recorded and described
   (`MISS_SHAPE_COPY` even holds per-kind intervention copy), but an implementation-miss and
   a recognition-miss produce identical future selection — only `hintReliant` routes, and
   only into the deep band's priority.
4. **Transfer exists (family-based, curriculum-side); variation and role-awareness do not**
   (§15, §21, §23): `selectTransferCandidates` feeds the session's transfer band, but
   selection ignores `FamilyRole` (canonical/warmup/variant/stretch), never draws transfer
   material from the sheet/library universes, and nothing frames variation ("same idea +
   changed constraint") anywhere outside the interview's derived follow-ups.
5. **Pattern discrimination is half-built** (§16): recognition drills already quiz across
   families with cross-pattern distractors (discrimination-lite), but nothing records which
   patterns were *prompted* (no denominators), distractors are not weighted toward
   confusable pairs (Sliding Window vs Prefix Sum), and no practice surface ever asks
   "which family would you investigate first?" before an attempt.
6. **No blind modes** (§19–§20, §24): targeted surfaces correctly reveal pattern (that is
   what targeted means), Full Contest is blind by construction — but there is no
   hidden-pattern practice rung between them, and the sheet/library rows always reveal
   pattern/topic/rating. Cold-start interview semantics need an explicit audit + spec.
7. **No browser-QA task** (§29): V14's gates were unit/build only. Four of V13's five defects
   were browser-found; omitting a browser pass repeats a known failure mode.
   Also missing: explicit migration/rollback statements (§27, trivial but must be stated).

## A5. Defects and contradictions found in V14 (must be fixed by this plan)

1. **⚠️ DEFECT — direct solves would pollute band evidence.** V14 D9 adds "Mark solved" on
   sheet rows writing into the slug register. But `bandEvidenceFromRegister` reads that same
   register and is documented as *"contest problems practised as contest practice… under
   contest conditions"*. An untimed self-reported tick on a 2200-rated library problem would
   enter the band reading as a solved rated outcome and inflate the recommendation. **Fix
   (B: Phase 1 amendment):** direct solves stamp an optional provenance flag
   (`selfReported?: true`) on the register record; band evidence ignores self-reported solves.
   Optional-with-boundary-default; validator lenient; round-trip tested.
2. **Direct-solve XP is farmable by clicking** (bounded — once per slug — but ~721 clickable
   problems × solve XP). Not a defect per the product's own "XP ≠ mastery" rule, but the
   mastery model must give self-reported solves **zero evidential weight**, and the open
   question on XP semantics (Part C, OQ-2) is surfaced rather than silently assumed.
3. **External rows** (§10): V14 D2 ("never link") is stricter than the master spec, which
   permits **verified** external URLs. Amended in B via a hand-authored, closed-world
   `external-links` table; unlisted externals stay unlinked. Never guessed.
4. **Naming drift risk:** V14 widens `contestLibrary.bySlug` meaning to "non-curriculum
   problems on the one ladder" — correctly documented, but Part B adds the tripwire: the
   *band* surfaces and *weak-areas* draws must state their basis ("contest practice") now
   that the register holds sheet work too.
5. **V14's ContestDue rename ("Practice reviews")** is kept, but the block must never grade
   (already specified) and its link should route to the owning revision mode.

## A5b. Pre-existing debt surfaced by this audit (small, folded into phases)

1. **The reconstruction-gap predicate is duplicated**: `isHintReliant(hintLevelUsed) &&
   !revisionHistory.some(e => e.passed)` is hand-written at `selectors.ts:610` and
   `selectors.ts:799–801`; `engine/hints.ts` holds only the rung half. → extract one named
   predicate (Phase 3).
2. **Duplicated calibration constants**: `MAX_PLAUSIBLE_RATIO = 6` appears in four modules
   (`timeEstimate`, `weakness`, twice in `insights`); `LOW_CONFIDENCE = 2` twice. Comments
   demand agreement; nothing enforces it. → one shared constant home (Phase 3, mechanical).
3. **`MASTERY_ORDER` / `isUnaidedMastery` are exported but production-unused** (test-only);
   `solveCoverage` re-derives unaided inline. → the capability reader becomes their consumer
   (Phase 2), not a new parallel notion.
4. **Drills record no per-pattern denominator** (`missedPatterns` is a bag of misses), which
   is why the recognition signal saturates against a constant. → optional `promptedPatterns`
   field lands with discrimination drills (Phase 6) to give future denominators; historical
   data stays denominator-less and reads as insufficient for positive claims.
5. **`missKind` cannot be back-filled** (write path accepts only today's own last fail) —
   correct by design; recorded so nobody "fixes" it.
6. **Course/ML fails carry no pattern attribution or miss taxonomy** — out of scope; the
   capability reader is DSA-pattern-scoped and says so.

## A6. What is intentionally NOT changing

- The roadmap, `rankWork`, `currentDay`, `DayLog`, daily caps, XP table, bonus gates, the
  1/3/7/15/30 ladder, Full Contest's locked spec (62 tests), standard revision's session
  composer contract, the weakness model's signal set and weights (extended only by reading
  its *existing* inputs more finely — never a ninth signal), the persistence architecture,
  the design system, and every V13 invariant. No new nav destination. No new store slice.
- No AI-generated problem variations (unreliable; the family graph + the two universes supply
  authored variation surface instead).
- No numeric "mastery percentage", no universal readiness score, no company-outcome claims.

---

# PART B — MASTER IMPLEMENTATION PLAN

*(Sections B1–B10: architecture and models. B11: phases and tasks. B12: dependency graph.
B13: verification gates. Slots marked ⟨integration⟩ are completed after the three subsystem
reports below — they are being filled in this same planning pass.)*

## B1. Objective, scope, non-goals

**Objective.** Make the system optimize for internalized reasoning: every practice item
selected for a stated capability reason; mastery read from evidence (never from counts);
failure shaping future practice; the learner progressively weaned off labels (targeted →
mixed → blind); the roadmap untouched.

**Scope.** (1) Finish the V14 sheet integration with the A5 amendments. (2) Add the pattern
capability (mastery) reading layer. (3) Route failure evidence into selection emphasis.
(4) Extend the one scorer with transfer/novelty/redundancy terms and session purposes.
(5) Contest deltas: rating-staircase targeted draws, an explicit mixed draw, blind-practice
rung. (6) Cold-start interview audit + spec. (7) Discrimination drills. (8) Verified external
links via an authored table. (9) Browser QA, migration/rollback statements, final gates.

**Non-goals.** Everything in A6. Additionally: no server, no accounts, no scraping, no
LLM-generated content at runtime, no gamification expansion, no new chart/analytics surfaces
beyond the capability reading, no rewrite of any working V13 surface.

## B2. Invariants (the complete carried + new set; every one has a named test home)

**Carried (V13/V14 — restated as binding):**
1. Two universes never merge; the sheet is a lens; nothing non-curriculum enters `rankWork`,
   `currentDay`, `DayLog`, daily caps, or weekly-clear bonuses. *(tests: existing rankWork/
   planner suites + V14 T5/T8 exclusion tests)*
2. Every join is on the slug; frontend vs internal id never crosses; no numeric key ever
   bridges universes; sitting-local library ids are negative. *(contestLibrary.test, sheet
   dataset tests)*
3. Closed-world identity: exact match / hand-verified alias / declared-not-on-platform;
   ambiguous stays ambiguous; unresolved fails the build. *(generators hard-fail; validator)*
4. No invented metadata: no guessed URL/slug/contest/rating/platform/topic; sheet-only
   problems have no rating **field**; externals link only through the authored verified
   table. *(dataset tests; validator)*
5. Roadmap problems are structurally excluded from revision-only draws; inclusion is an
   explicit, visible, reversible opt-in enforced in the engine (`includeRoadmap` default
   false). *(V14 T5.1 critical test + UI-level draw test)*
6. One scheduler (the ladder), one prioritizer (`rankWork`), one session composer, one
   weakness model, one revision scorer core (`scoreRevisionFacts`), one tag→pattern mapper.
   New capability readings are *readers*, never second models. *(grep-level review gates +
   the parity rule: existing scorer tests pass unmodified)*
7. A weakness sentence is a weakness claim wherever it renders; every such sentence sources
   from `selectPatternWeakness`; capability sentences source from the one capability reader.
8. Any surface grading a due item freezes membership AND order per sitting.
9. Live sittings are never persisted; derived records are; every performance channel banks
   conclusive sittings including clean ones; nothing performance-derived pays XP.
10. Persisted-schema evolution is optional-with-boundary-default; both read paths (boot +
    import) wired; validator never stricter than the write path; round-trip tests for every
    new field. *(persistence.test additions per phase)*
11. Bundle law: `data-sheet` beside `data-contests`; store modules never import datasets;
    permitted static importers enumerated in CLAUDE.md and checked by the dist grep.
12. Determinism: engines are pure, clockless (ISO strings in), seeded where random;
    every recommendation carries reasons the selector itself produced.
13. Ratings are ZeroTrac estimates, shown beside official difficulty, never called official,
    never claimed for the learner; band reads state their sample size and basis.
14. Suppression over fake precision: below stated evidence minimums, surfaces say
    "not enough evidence yet" — never a percentage. *(mastery reader tests)*

**New (this plan):**
15. **Solved ≠ mastered, structurally:** capability readings never consume XP, ladder stage
    alone, or solve counts alone; a self-reported solve contributes zero capability evidence
    and zero band evidence. *(capability reader tests + amended band test)*
16. **Provenance of a solve is recorded** (`selfReported` flag) so timed/untimed evidence can
    never blur. *(register round-trip + band-evidence test)*
17. **Blind surfaces must not leak:** a blind presentation renders no pattern, topic, rating,
    contest label, family hint, or pattern-colored ink before the reveal; reveal happens only
    after the attempt is graded/finished. *(component tests asserting absence + browser QA)*
18. **Targeted surfaces must say what they train** (the capability line), and mixed/blind
    surfaces must say what they withhold and why. *(copy tests)*
19. **Economy:** a single draw never contains two members of the same family (curriculum/
    bridged rows) or two rows of the same sub-topic (sheet rows) unless the pool cannot
    otherwise fill; when a cap or fallback loosens diversity, the UI states it. *(selector
    tests)*
20. **Failure routes practice:** each recorded miss kind maps to a defined selection emphasis
    (B6); the mapping is data, exercised by tests, and every emphasis-driven pick carries the
    reason. *(routing tests)*

## B3. Data & identity model (exact, regeneration-safe)

**Datasets and their owners (all committed, all offline):**

| Dataset | Generator | Sources | Identity key | Chunk |
|---|---|---|---|---|
| `src/data/questions.json` (539) | `generate-questions.mjs` | curriculum SECTIONS + catalog + topics snapshot + aliases | title→slug (closed world), id 1–539 internal | `data-curriculum` |
| `src/data/contestLibrary.json` (2,561) | `generate-contest-library.mjs` | zerotrac + topics snapshot + catalog + pattern map + questions | **slug** | `data-contests` |
| `src/data/revisionSheet.json` (1,210 rows) | `generate-revision-sheet.mjs` | resolved sheet + questions + contestLibrary + topics snapshot + catalog + pattern map | **slug** (LC rows); rows reference owner (questionId / slug / inline for the 159) | `data-sheet` |
| `scripts/data/external-links.json` (NEW, authored) | hand-authored, validated | maintainer-verified URLs | `(platform, normalized title)` | consumed at sheet generation |

**Resolution hierarchy (per field, strongest source wins, never overwritten):** identity =
catalog/topics snapshot; official difficulty = LeetCode snapshot; topics = LeetCode snapshot;
contest + rating = ZeroTrac; AICM pattern/sub-pattern = repository classification (curriculum
hand-verified > shared tag mapper with per-pattern confidence; heuristic = inert); source
topic/sub-topic = the sheet itself (provenance, preserved verbatim, never flattened).

**Duplicate rules:** a slug arrives at exactly one kind everywhere it appears (generator
fails otherwise); rows may repeat across sub-topics by design (the lens preserves teaching
order); draws dedupe by identity (`q<id>` / slug) keeping first occurrence; family/sub-topic
redundancy guarded per invariant 19.

**Exclusion rules:** roadmap membership decided at generation (kind `curriculum`), re-checked
by the validator (a kind-2 slug in either universe is a build failure), re-enforced in the
engine (`includeRoadmap: false` default), re-tested at UI level (a default draw contains no
curriculum row).

**External handling:** kind-3 rows carry `(title, sheetDifficulty|theory|null, platform)`.
With a verified entry in `external-links.json` they gain `url` + `urlVerifiedAt`; without one
they render platform-named and unlinked. Participation: **reference-only** — no progress, no
revision, no contest eligibility (OQ-4 records the alternative). Ambiguous rows (kind 4)
render the note verbatim and participate in nothing.

**URL rules:** LC URLs derived from resolved slugs only; external URLs only from the authored
table; no URL is ever constructed from a title.

**Regeneration procedure (documented in CLAUDE.md at Phase 12):**
`npm run report:revision-sheet` (resolver + report) → `npm run generate:revision-sheet`
(resolver + generator) → `npm run validate:data` → full suite. Snapshots refresh only via the
existing engineering-time fetch scripts. Reproducibility gate: two consecutive generator runs
differ only in `provenance.generatedAt`.

**Validation procedure:** `validate:data` gains the sheet section (V14 T3) + external-links
section (table shape, absolute-https URLs, platform enum drawn from the sheet's own platform
list, no entry for a non-existent sheet row, no entry for an LC row). Hard-fail on: identity
conflicts, kind conflicts, malformed slugs, missing refs, sheet-only slugs found in a
universe, fabricated URL fields, rating fields on sheet-only problems, stale counts vs the
resolver summary. Warn on: missing topic tags, unmapped patterns, difficulty disagreements.

## B4. The learning progression, mapped to surfaces (what exists → what is added)

| Stage | Existing surface (verified) | Added by this plan |
|---|---|---|
| LEARN | Roadmap day slices; question sheet with authored `type`/`tests`/`complexity` | — |
| UNDERSTAND | Post-solve reflection (`reflection`), family pages (`signals`/`idea`/`trap`) | capability line surfaced on practice rows (P8) |
| RECOGNIZE | Recognition drills (date-seeded, first-attempt-recorded, miss-weighted) | discrimination drills across patterns (P6) |
| RECONSTRUCT | The unnamed reconstruction gap (rung ≥2 + no passed review) boosting session priority; deep-band re-implement treatment | named predicate + `RevisionEvent.depth` so a re-implement pass is distinguishable evidence (P3) |
| IMPLEMENT | Miss kinds `implementation`/`edge-case`; pace signal | routing: implementation misses bias deep-band + timed sets (P3/P4) |
| TRANSFER | `transferRecord`, `selectTransferCandidates` (family-based, fed into the session composer), `transfer` weakness signal | transfer draws over the sheet/library (same pattern, different surface) + purpose-framed sessions (P4/P6) |
| COMBINE | Multi-pattern library problems; weak-areas mixed draw | explicit mixed-pattern targeted sets (P5) |
| VARY | Family members as authored variations; interview follow-up axes (derived, never invented) | variation framing in draw reasons; no new content system (P6) |
| INTERLEAVE | Drills round-robin distinct families; contest `distinctPatterns` | interleaved mixed sets + discrimination prompts (P5/P6) |
| TIMED | Full Contest + filtered sittings; `hasRealTime`; outcomes; band reading | rating-staircase targeted sets (P5) |
| BLIND | Full Contest (cold by design — no rating/label/reasons on rows) | the blind-practice rung for library/sheet sittings (P5) |
| INTERVIEW | Ten-stage progressive-reveal interview mode (gates modeled as data, leak = failing test; five self-dimensions; no aggregates) | cold-start toggle (gate difficulty+estimate); optional library-pool draw (P7) |

## B5. The capability (pattern-mastery) model — a READER, never a second model

**Module:** `src/utils/engine/capability.ts` (new; pure; same input discipline as
`weakness.ts` — `{ today, all, byId, drills, contests, families, librarySlug register,
interview sittings }` passed in; composed in a selector beside `selectPatternWeakness`).

**The one-model guarantee, stated as design:** weakness remains the sole authority on
"what is not holding" and the sole selection driver. Capability answers a different
question — "where does the evidence support a positive claim, and where is there simply not
enough evidence" — and **defers to weakness on negatives**: any pattern currently named by
`selectPatternWeakness` caps at `developing`. The two can therefore never disagree in the
direction that matters, and no selection path consumes capability directly (selection
consumes weakness + the P3 emphasis map).

**Output shape (exact):**

```ts
export type CapabilityLevel = 'strong' | 'developing' | 'insufficient-evidence';
export interface DimensionReading {
  level: CapabilityLevel;
  evidence: number;        // observation count the level rests on — always shown beside it
  basis: string;           // plain-English sentence naming the evidence source
}
export type CapabilityDimensionId =
  | 'recognition'      // drills: misses vs (future) prompted denominators; discrimination results
  | 'recall'           // graded revision events on the pattern's questions
  | 'reconstruction'   // reconstruction-gap clearances + depth-tagged re-implement passes
  | 'implementation'   // implementation/edge-case share of tagged misses (inverse)
  | 'transfer'         // family met→carried on the pattern's families
  | 'timed'            // contest outcomes + non-self-reported register solves in-pattern
  | 'independence';    // unaided share of solves (hintUse distribution)
export interface PatternCapability {
  id: PatternId; name: string;
  dimensions: Record<CapabilityDimensionId, DimensionReading>;
}
export function patternCapability(input: CapabilityInput): PatternCapability[];
```

**Evidence sources per dimension (all existing, verified):** recall = `revisionHistory`
pass/fail per pattern; reconstruction = the extracted `isReconstructionGap` predicate's
clearances (`hintLevelUsed ≥ 2` then a later passed review) plus, once P3 lands,
`RevisionEvent.depth === 'reimplement'` passes; implementation = `missKind` shares
(`missAnatomy` mechanics scoped per pattern, same 90-day window); transfer = the
`transferRecord` computation scoped to the pattern's families; timed = `stalledPatterns`
misses vs in-pattern conclusive-sitting solves + register solves where `selfReported` is not
set; independence = `hintUse` distribution over solved in-pattern; recognition = drill
misses (negative only — a positive recognition claim requires denominators, which exist only
after P6's `promptedPatterns`/discrimination records; until then recognition can read
`developing` or `insufficient`, never `strong`, and its basis sentence says why).

**Scoring philosophy:** no percentages, no composite, no stored state. Per dimension:
`insufficient-evidence` below its floor (constants per OQ-3, seeded from the codebase's own
precedents: 5 observations for rate-like dimensions, `MIN_BAND_EVIDENCE = 4` for timed);
`strong` requires the floor AND a clean recent read AND the weakness cap not applying;
otherwise `developing`. Recency uses the same 30-day half-life discipline as weakness so a
capability regresses automatically as evidence ages — **transitions and regression are
recomputation, not state machinery**. There is deliberately no `overall` field: the
dimensions ARE the reading (an overall would be the fake single number twice banned in the
interview engine).

**Consumers:** the pattern page panel + capability lines (P8); blind-mode suggestion
predicate (P7, per OQ-5); nothing in selection.

**Tests (P2):** deference-to-weakness cap; per-dimension floors (below → insufficient,
never a level); self-reported solves contribute zero; decay regression (same evidence, later
`today`, level drops); determinism; a fresh profile reads insufficient on every dimension of
every pattern.

## B6. Failure taxonomy and routing (uses the existing channels; adds one registry entry)

**The taxonomy already exists across four channels — the plan maps the spec's categories
onto them rather than building a parallel taxonomy:**

| Spec failure category | Existing evidence channel |
|---|---|
| Problem understanding / constraint reading | Interview stages `understand`/`clarify` outcomes (solid/shaky/stuck) |
| Brute-force formulation | Interview stage `brute-force` outcome |
| Pattern recognition | `missKind: 'recognition'`; drill misses |
| Derivation / approach recall | `missKind: 'recall'`; interview `approach`/`optimize` outcomes |
| Data-structure / tool selection | Discrimination drills (P6 — new evidence) |
| Implementation | `missKind: 'implementation'` |
| Complexity analysis | **`missKind: 'complexity'` — the one registry addition** ("Idea right — complexity wrong"); interview `complexity` stage + self-dimension |
| Edge cases | `missKind: 'edge-case'`; interview `edge-cases` dimension |
| Hint dependence | hint ladder (`hintLevelUsed`, `isHintReliant`) |
| Time management | contest outcomes `slow`/`set-aside`; `pace` signal; `timeReading` |
| Transfer failure | `transfer` signal (family-based) |
| Variation failure | family-member fails after a sibling solve (same channel as transfer); interview follow-ups held/missed |
| Communication | interview `clarity` self-dimension |

Registry note: `missKind` is validated as a bare string end-to-end, so the addition cannot
quarantine any payload; `MISS_SHAPE_COPY` gains the matching intervention copy. The one-tap
row stays five options — small enough to stay one-tap.

**The routing map (new, P3): `src/utils/engine/practiceRouting.ts`** — pure data + one
selector-shaped function:

```ts
export type PracticeEmphasisId =
  | 'disguised-recognition'   // recognition misses → same pattern, unfamiliar surface (library/sheet rows outside met families), drills
  | 're-implement'            // implementation/edge-case misses → deep-band placement, timed set suggestion
  | 'delayed-reconstruction'  // recall misses + reconstruction gap → deep-band re-implement of the missed item at its next due date
  | 'constraint-analysis'     // complexity misses → capability line prompts the bound question post-solve; interview follow-ups
  | 'timed-repair'            // slow/set-aside history → rating-staircase targeted set in-pattern
  | 'transfer-next';          // transfer misses → family transfer candidates (existing selector)
export interface PatternEmphasis { pattern: PatternId; emphasis: PracticeEmphasisId; reason: string; evidence: number }
export function practiceEmphases(input: EmphasisInput): PatternEmphasis[];  // deterministic, floors per emphasis, empty when no evidence
```

**Where the routing lands (each with named tests):**
1. `buildRevisionSession` treatment bias — the existing `hint-reliant: 7` precedent extended:
   an emphasis on a candidate's pattern adjusts band placement (re-implement emphases push
   toward the deep band), never the ladder, never the schedule.
2. The one scorer — P4 adds an additive emphasis term (+reason string verbatim from
   `PatternEmphasis.reason`) to `scoreRevisionFacts` inputs.
3. Drill weighting — recognition emphases already flow (miss-weighted drills exist); the
   discrimination drill (P6) consumes the same weights.
4. Surfaces echo the emphasis as the capability line ("Training: recognition under
   disguise"), sourced from one `EMPHASIS_COPY` table.

**Invariant:** routing adds selection *emphasis and reasons* only — it never reschedules,
never penalizes, never writes state. Failure evidence in, ranked practice out.

## B8. Contest model (targeted · mixed · blind · full)

| Mode | Pool & composition | Reveals during sitting | Purpose |
|---|---|---|---|
| **Targeted** (exists: pattern/rating filters, weak-areas, sub-topic timed sets) | filtered pool → `selectContestSet` | rating, contest label, latched "Why this problem?" (may name pattern + weakness sentence) — **intended**: targeted = learning | strengthen a named capability |
| **Mixed** (new, P5) | 2–4 chosen patterns or the emphasis map's top patterns; `distinctPatterns: true` | pattern names withheld on rows; rating shown; reasons latched until finish ("chosen from a mix — naming which is which would answer the question") | tool selection under mild ambiguity |
| **Blind rung** (new, P5) | any filtered/sheet pool via a `blind` sitting flag | title, difficulty, target minutes, premium, link ONLY; rating/label/reasons/pattern withheld until the verdict | recognition under novelty, pre-interview |
| **Full Contest** (locked) | curriculum unsolved, `CONTEST_SHAPE`, distinct patterns | already cold: no rating, no label, no reasons | performance under pressure |

**Selection rules stay `selectContestSet`'s** (verified rungs: fresh-pattern+fresh-contest →
fresh-pattern → any-at-difficulty; one PRNG draw per filled slot; short set over duplicate).
**Difficulty progression (P5):** targeted draws gain an optional rating staircase — compose
the 4-slot set from ascending band windows around the learner's band reading (e.g. b−1, b,
b, b+1) *when the pool supports it, reporting the actual composition when it does not*
(never fabricate the shape; the §28 rule). Implemented as a plan-builder helper over
`selectContestSet` calls per slot — the engine itself is not modified.

**Timed behavior, analysis, evidence flow:** unchanged and reused — the clock-until-paused
rule, `hasRealTime`, `analyzeContest` as sole verdict owner, conclusive sittings banked
(clean ones included), `stalledPatterns` → the 0.08 contest signal, `stalledIdsFromRecord`
→ interview draws, first-sitting-per-date wins. Blind sittings bank identically —
blindness changes presentation, never evidence.

**Leak fixes (from the audit):** (a) the blind flag machinery gives mixed/blind rungs the
same "gate, don't latch" discipline interview mode has — content absent from the DOM until
finish, asserted by tests (the jsdom `<details>` hazard is exactly why latching is not
enough); (b) targeted sittings keep their latched reasons — documented as intended.

## B9. Interview & cold-start model

**Audit verdict: the existing interview mode already implements the spec's core** —
one problem, ten stages, progressive reveals modeled as data (`REVEALS`, leak = failing
test), pattern gated to stage 4, family to 6, capability sentence to 7, bounds to 10, hints
gated to stage 3 and rung-counted, five self-dimensions with a test-enforced ban on
aggregates, expectation-vs-assessment calibration, draw basis deferred to the debrief, pace
stated as fact not verdict. **This plan does not rebuild any of it.**

**Gaps closed (P7):**
1. **Cold-start toggle** (REQUIRED): a landing option "Hide difficulty and pace" that gates
   the two currently-ungated reveals (difficulty badge, `~N min recommended`) behind
   `finished` for that sitting. Local to the sitting; default off; recorded on the banked
   record as `coldStart?: true` (optional, lenient) so calibration insights can segment.
2. **Blind-practice graduation suggestion** (per OQ-5): the landing may *suggest* the
   toggle when the drawn problem's pattern reads `strong` on recognition+recall — worded as
   an invitation, never a gate.
3. **Library-pool interviews** (IMPORTANT, not required for v1): an opt-in draw pool
   extension to unsolved library problems (true novelty). Requires identity work —
   `InterviewSittingRecord` gains optional `slug?: string` (bare string, lenient validator)
   and reveals honestly state absence for unauthored content (no family → "no mapped
   family"; no `tests` sentence → the reveal names its absence). The negative-id rule never
   applies here (no live numeric contest state involved); the record's `questionId` field
   stays curriculum-only, 0 for slug-keyed sittings, and every reader guards on it. If this
   task's validator/record audit finds a reader that cannot tolerate `questionId: 0`, the
   task is descoped to curriculum-only rather than forcing the schema.
4. **Measurement unification:** the interview's stage outcomes and dimensions feed the
   capability reader (B5) as the understanding/derivation/communication evidence — read-only,
   no new writes.

## B7. Contextual revision — extend the two existing composers, build no third

**What already answers "what should I practise now" (verified, kept byte-compatible):**
`buildRevisionSession` (time→depth shapes with per-shape purpose blurbs; priority terms
overdue/due/failed/low-confidence/weak-pattern ×8/hint-reliant 7 + fragility + staleness;
heavy-load caps, spacing that drops rather than reorders, deferred-never-headlined; the
transfer band) and `rankWork` (category-ordered day list; the hero and the plan agree by
construction). PRODUCT.md locks the doctrine: revision answers "the best use of the next 30
minutes", never "what you owe".

**What this plan adds — all additive, each with its reason string:**
1. **Emphasis term in the one scorer.** `scoreRevisionFacts` gains an optional
   `emphases?: PatternEmphasis[]` input; a candidate in an emphasized pattern earns a bounded
   additive term (magnitude at the weak-pattern tier, never above the due tier) and the
   emphasis reason verbatim. Existing callers pass nothing and their tests run unmodified.
2. **Session emphasis bias.** In `session.ts`, a re-implement-flavored emphasis
   (`re-implement`, `delayed-reconstruction`) on a candidate's pattern routes it toward the
   deep band exactly as `hintReliant` already does (a priority-reason term of the same
   magnitude class, value below `hint-reliant`'s 7 so the direct evidence keeps outranking
   the pattern-level inference). Never reschedules; never touches the ladder.
3. **Redundancy guard (economy, §25).** Draw-time dedupe beyond identity: in one draw or one
   "worth practising" list, at most one member per family (curriculum/bridged rows, via
   `familyId`) and at most one row per sheet sub-topic (library/sheet rows, where family is
   unknown — the sub-topic is the honest redundancy proxy). Relaxes only when the pool
   cannot fill, and says so ("pool too small to stay diverse — includes near-neighbours").
4. **Novelty term.** A small additive bonus for a problem whose pattern has recent *learning*
   evidence (curriculum solves) but no *disguised* evidence (no library/sheet solves in
   pattern) — "first unfamiliar ground in a pattern you just learned". Deterministic,
   explainable, bounded below the due tier.
5. **Session purposes on the second universe's surfaces.** Contest/sheet revision modes gain
   a one-line purpose header sourced from a fixed `PURPOSE_COPY` table keyed by mode +
   active emphasis (e.g. "Weak-area repair — Graphs", "Transfer practice — Two Pointers:
   recognizing the invariant where the problem does not announce it"), mirroring the shape
   blurbs the standard session already has.
6. **Smallest-useful-set default.** Practice lists stay capped (the existing
   `PRACTICE_SHOWN = 6` discipline); draws stay at 4; nothing ever surfaces "1,016 problems
   to do". The library remains a pool the selectors dip into — the §6 feeling test.

**Determinism & explainability:** every term additive, bounded, and named; tie-breaks
unchanged (score → difficulty/rating → identity); same inputs → same list; every rendered
row can print the exact reasons the scorer produced.

## B10. Transfer, variation, interleaving, discrimination

**Transfer (§15).** Three rungs, all reusing the family graph and the two universes:
- *Rung 1 (exists):* the session's transfer band — unsolved members of met families.
- *Rung 2 (new):* role-aware ordering — prefer `variant` then `stretch` members once the
  family's `canonical` is solved (`FAMILY_ROLE_ORDER` exists; selection currently ignores
  it); copy keeps the existing "Same idea as X, wearing a different disguise".
- *Rung 3 (new):* cross-universe transfer — library/sheet problems in the same pattern but
  **outside** every met family: "same invariant, unfamiliar surface". This is the honest
  disguise pool (nothing shares the family's story), powered by `familyId` on
  curriculum/bridged rows and pattern membership on the rest.

**Variation (§21).** No generated content. Variation = (a) family `variant`/`stretch`
members, explicitly framed by role; (b) the interview's derived follow-up axes (constraints/
duplicates/memory/scale/streaming/dynamic/queries — already selected from dataset evidence
with a `because`); (c) contest problems of the same pattern at a higher band ("same idea
under a harder constraint"). The plan adds framing and selection preference, never invented
problems.

**Interleaving (§23).** Drills already round-robin distinct families; contest sets already
enforce `distinctPatterns`. Added: the mixed targeted set (B8) arranges its 4 problems to
alternate patterns when composition allows; the sheet's revision draw over "all topics"
interleaves topics by construction (dedupe guard + score ordering); and the capability
reader's recognition dimension makes "always practising one pattern" visible as missing
disguised evidence elsewhere.

**Discrimination (§16).** Three additions on the existing drill machinery:
1. **Confusable-pairs table** — authored data (`scripts/data/confusable-patterns.json`,
   validated like the pattern map): pairs such as sliding-window↔prefix-sum,
   greedy↔dp, bfs↔dijkstra, binary-search↔two-pointers, heap↔monotonic-stack, each with a
   one-line "the discriminating question". Drill distractor sampling weights toward the
   correct answer's confusable partners, turning the existing 4-option drill into targeted
   discrimination without new UI.
2. **Prompt denominators** — `DrillDayResult.promptedPatterns?: string[]` (optional,
   boundary-default absent, lenient validation): the write path records which patterns were
   asked, giving the capability reader true recognition denominators going forward.
3. **The pre-attempt question** (IMPORTANT, not required for v1): on blind-rung sittings, an
   optional one-tap "Which family would you investigate first?" asked before the row's
   reveal, graded against the problem's confident mapping, recorded through the drills
   channel (a dated drill result with `promptedPatterns`), feeding recognition evidence.
   Skippable; never gates the attempt.
   Where it appears, how it is measured, and how it affects revision are thereby all
   existing mechanisms: drills slice → recognition signal → weakness → selection.

## B11. Persistence model (complete accounting)

| Data | Persisted? | Where | New in this plan |
|---|---|---|---|
| Sheet/library solves, attempts, ladder, reviews | yes | `contestLibrary.bySlug` (existing) | `selfReported?: true` on direct solves |
| Review depth (recall vs re-implement) | yes | `RevisionEvent.depth?: 'recall' \| 'reimplement'` (bare-string-lenient) | new optional field, written by graders that know their depth |
| Miss kinds | yes | `RevisionEvent.missKind` (existing) | +`'complexity'` registry entry (string-safe) |
| Drill results | yes | `drills.byDate` (existing) | `promptedPatterns?: string[]` optional |
| Contest/interview sittings | yes (derived records only) | `contests.byDate`, `interviews.sittings` | `coldStart?: true`, `slug?: string` on interview records (P7; lenient) |
| Capability readings | **never** — derived, recomputed | — | — |
| Emphases / routing | **never** — derived | — | — |
| Blind flag on a live sitting | **never** (live slices unpersisted) | `contest` slice | new transient field |
| Frozen revision/sheet sitting lists | never (by design) | component/session state | — |
| Settings | yes | unchanged | none |

Rules: every new field optional-with-boundary-default; validator lenient (bare
strings/booleans, never registry-coupled); both read paths (boot + import) normalized;
round-trip tests per field pinned against a captured pre-V15 fixture; quarantine semantics
untouched. No new slice anywhere in the plan.

## B12. UI plan (understanding, not redesign — Page.tsx vocabulary only)

The four questions every surface must answer, and where:
- **"What am I doing?"** — purpose headers on revision modes and draws (B7.5); the session
  shapes' existing labels/blurbs untouched.
- **"Why am I doing it?"** — the scorer's own reasons verbatim (exists); emphasis reasons
  (B6); draw-basis stays debrief-only in interview mode.
- **"What does this test?"** — the capability line: curriculum rows reuse the authored
  `tests` sentence (never fabricated for unauthored problems — library/sheet rows state
  pattern + emphasis instead, or nothing).
- **"What should I do next?"** — the existing hero/next-action machinery, plus the
  post-contest/post-interview `next` sentences (exist).

Additions, each small: the pattern page gains one capability panel (7 dimension rows,
level + evidence count + basis sentence; "Insufficient evidence" as honest text, never a
bar); practice rows gain the capability/emphasis line; blind rows gain the withheld notice
("Pattern, rating and provenance are hidden until you finish — that is the exercise");
mixed sets say what they withhold. No new metrics dashboards; analytics gains nothing in
v1. Learner is never shown a mastery number, an XP-as-skill claim, or a readiness score.

**Three contractual user journeys (acceptance narratives, tested in unit form and walked in
browser QA):**
1. *The lens journey (P1):* open Library → Revision sheet view → Two Pointers → mark a
   sheet-only classic solved → it enters the one ladder → days later it appears in
   Revision's Sheet mode as due, the list frozen while graded → reload keeps everything →
   the roadmap's day, counts and hero are bit-identical throughout; the default draw never
   contains a roadmap question, and the toggle visibly changes that.
2. *The capability journey (P2–P6):* fail a recall and tag it "Knew the idea — code broke"
   → the pattern's next session routes the item to the deep re-implement band with that
   reason stated → a depth-tagged pass later reads as reconstruction evidence → the pattern
   page's panel moves from insufficient toward developing with the basis named.
3. *The blind journey (P5–P7):* a pattern reads strong on recognition+recall → the library
   suggests a blind set → the sitting shows title/difficulty/target only → the verdict
   reveals pattern, rating and reasons, and banks evidence exactly like any sitting → an
   interview cold-start sitting extends the same discipline to difficulty itself.

## B13. Quality plan (validation · testing · browser QA · performance · a11y · migration · rollback)

**Unit/integration testing rules (all phases):** clock pinned; `renderWithStore`; offline;
engine fixtures spread `QF`; UI copy asserted deliberately; every invariant in B2 names its
test home; suite verified with `--no-file-parallelism` before any commit; never weaken an
assertion to pass.

**Data gates:** `validate:data` per B3; generator reproducibility check (two runs, diff =
`generatedAt` only); the resolver summary is the count oracle for the sheet dataset.

**Build gates:** app chunk ≤ 301 kB budget (headroom recorded per phase); `data-sheet`
chunk present; `grep -l 'from"./contestLibrary-' dist/assets/*.js` names only the permitted
chunks; same grep discipline for `revisionSheet-`; `selectors.ts`/`actions.ts` import review
whenever either file changes.

**Browser QA (Phase 11 — a real pass, not a formality; four of V13's five defects were
browser-found).** Recipe: `preview_start {name:'dsa-roadmap-dev'}` → seed
`localStorage['dsa-roadmap:v1']` with a prepared fixture → drive via accessible-name clicks →
**measure layout with JS, never screenshots** (pane screenshots lie above ~487px width).
Viewports 1280×590, 768×1024, 375×812; both themes. Scripted checks:
1. Roadmap/Today untouched: counts identical before/after sheet activity; hero unchanged.
2. Sheet view: topic expand, row detail, Mark solved flow (reload → still solved — the boot
   path), external row named+unlinked (or verified-linked), ambiguous note, include-roadmap
   toggle changing draws visibly, 375px title survival (V13's crushed-row lesson).
3. Revision: standard flow untouched; Sheet mode due-freeze (grade a row — the row stays,
   list order stable); deep links `?mode=sheet&topic=…`, `?view=sheet` on reload.
4. Contest: targeted draw (reasons state the filtered pattern), mixed draw, Recreate,
   Full Contest reveal-nothing check, null-rating row rendering, verdict → weakness flow.
5. Blind practice rung: pre-reveal leak sweep — no pattern name, no pattern ink, no rating,
   no contest label, no family hint anywhere in DOM (assert via JS text scan), reveal after
   grade.
6. Interview cold-start: same leak sweep; measured record banked; amendment guard.
7. Discrimination drill: keyboard-only completion; recorded-once-per-date rule.
8. Empty states: fresh profile (no evidence anywhere) shows suppression copy, never fake
   readings; capability panel says insufficient evidence.
9. Persistence: quarantine drill (corrupt a field → reload → quarantine key present, app
   boots fresh); export/import round trip with new optional fields.

**Performance:** decode-at-load stays O(rows) single-pass for the sheet (measured at Phase 1
gate); no render scans 1,210 rows without memoized indexes; capability readings memoized per
input identity; no new route-level bundle regressions (route chunks listed per phase).

**Accessibility:** every new control keyboard-reachable with visible focus; chips are
`aria-pressed` toggles or radiogroups per the existing idioms; blind-mode reveal is
announced (status region); color never the sole carrier (status columns keep text); AA
contrast for muted external rows (full-alpha floor per V13's lesson).

**Migration:** none required — every schema addition is optional-with-boundary-default;
absent fields mean the historically-true default (OQ-6). Import of any pre-V15 payload must
validate unchanged (round-trip tests pinned to a captured V13 fixture).

**Rollback:** each phase is additive and lands on its own commits; rolling back = reverting
the phase's commits. Data rollback = regenerating from committed snapshots (generators are
the only writers). The register's new optional fields are ignored by older readers by
construction (they spread over defaults), so a code rollback with new-format storage does
not quarantine: `validatePersisted` accepts unknown-extra fields? — **it does not echo
unknown fields, and optional known fields are lenient; the rollback test in Phase 9 pins
that a V15 payload loads under V14 validation semantics** (drop-not-quarantine for the new
optionals is the acceptance bar; if V14's validator would reject, the flag design moves to
a parallel channel instead — decided at Phase 9 T9.1 with a written test, not assumed).

## B14. Phases (structure; the per-task execution contract is B16)

- **PHASE 0 — AUDIT / BASELINE (this document + re-verified gates).**
- **PHASE 1 — DATA / IDENTITY + THE SHEET LENS** (absorbs V14 Tasks 2–12 with A5
  amendments; adds external-links table; ends with the sheet fully shipped).
- **PHASE 2 — CAPABILITY (MASTERY) READER** (pure reader over existing evidence;
  INSUFFICIENT_EVIDENCE first-class).
- **PHASE 3 — FAILURE → PRACTICE ROUTING** (miss-kind emphasis map; hint-reliance and
  reconstruction depth wired as inputs).
- **PHASE 4 — CONTEXTUAL REVISION** (scorer terms: capability need, transfer, novelty,
  redundancy guard; session purposes; economy caps).
- **PHASE 5 — CONTEST INTELLIGENCE DELTAS** (rating-staircase targeted sets; explicit mixed
  draw; blind-practice rung on library/sheet rows).
- **PHASE 6 — TRANSFER / INTERLEAVING / DISCRIMINATION** (family-transfer draws;
  discrimination drill type; interleaved mixed sets).
- **PHASE 7 — INTERVIEW / COLD-START** (leak audit fixes; library-pool blind interviews;
  measured dimensions unified with capability reader).
- **PHASE 8 — UI COHERENCE** (capability lines, mastery panel on pattern pages, purpose
  headers, next-best-action copy — no redesign).
- **PHASE 9 — PERSISTENCE HARDENING** (round-trips, rollback semantics test, import fixture).
- **PHASE 10 — TESTS / VALIDATION SWEEP** (invariant-to-test audit table executed).
- **PHASE 11 — BROWSER QA** (B13 script).
- **PHASE 12 — FINAL GATES + DOCS** (CLAUDE.md/PRODUCT.md/HANDOFF/design records; ledger
  close-out).

## B15. Dependency graph

```
P0 baseline
 └─ P1 data/identity (sheet shipped)
     └─ P2 capability reader          (reads registers P1 finalizes)
         ├─ P3 failure routing        (emphasis map feeds P4)
         │    └─ P4 contextual revision (one scorer, extended)
         │         ├─ P5 contest deltas     (draw composition reuses P4 terms)
         │         └─ P6 transfer/interleave/discrimination
         │              └─ P7 interview/cold-start (graduation reads P2; pools read P5/P6)
         └────────────┬─ P8 UI (renders P2–P7 outputs; nothing earlier depends on it)
                      └─ P9 persistence hardening (after last schema addition, P6)
P10 test sweep  → after P8/P9
P11 browser QA  → after P10
P12 final gates → last
```
No phase consumes behavior a later phase defines; every cross-phase symbol is named in the
task tables.

## B16. Phase tasks — the execution contract

*(Requirement levels per the audit directive: **[R]** required · **[I]** important ·
**[O]** optional. Every task: one commit, suite green before it, ledger ticked after it.
Verification shorthand `GATES` = `npx tsc --noEmit` + `npx vitest run --no-file-parallelism`
+ `npm run validate:data` + `npm run build` with chunk/import greps.)*

### Phase 0 — baseline
- **T0.1 [R]** Re-verify: checkout `v14-revision-sheet`, run GATES, record counts in the
  ledger. No code. *Accept:* 1,306+ green, build budgets as recorded in Part A.

### Phase 1 — data/identity + the sheet lens (absorbs V14 Tasks 2–12; step detail lives in
`docs/superpowers/plans/2026-08-20-revision-sheet-integration.md`, which remains binding
for these tasks except where amended here)
- **T1.1 [R]** = V14 T2 (types, decoder, `data-sheet` chunk, dataset tests).
- **T1.2 [R]** = V14 T3 (validator rules).
- **T1.3 [R]** = V14 T4 (`scoreRevisionFacts` extraction; parity gate: existing tests
  unmodified).
- **T1.4 [R]** = V14 T5 (`engine/revisionSheet.ts`; the structural-exclusion critical test).
- **T1.5 [R] AMENDED** — provenance flag before the thunk: `ContestProblemProgress.
  selfReported?: true` (types + `normalizeContestProgress` + `serialize.ts` lenient boolean +
  round-trip test incl. pre-V15 fixture) **then** V14 T6's `solveSheetProblem` setting it.
  *Accept:* direct solve stamps the flag; sitting solves never do; both read paths preserve
  it. *Rollback concern:* older validator must drop-not-quarantine — pinned by test (P9
  re-verifies).
- **T1.6 [R] NEW** — band-evidence guard: `bandEvidenceFromRegister` ignores solves with
  `selfReported`; its doc-comment and the two band surfaces' basis copy updated.
  *Accept:* a self-reported 2200 solve moves no band reading; existing band tests
  unmodified plus one new case.
- **T1.7 [R]** = V14 T7 (null-rating widening + run-page guard).
- **T1.8 [R]** = V14 T8 (sheet view on `/contest-practice`, `?view=` sync, timed sub-topic
  sets, mark-solved UI).
- **T1.9 [R]** = V14 T9 (Sheet mode in ContestRevision, frozen lists, `?mode=&topic=`).
- **T1.10 [R]** = V14 T10 (ContestDue → "Practice reviews", both datasets resolved).
- **T1.11 [R]** = V14 T11 (report augmentation: explicit spec states, contest columns).
- **T1.12 [R]** = V14 T12 (docs + gates), extended with this plan's Phase 1 decisions.
- **T1.13 [I]** External verified links: authored `scripts/data/external-links.json`
  (`{platform, title, url, verifiedAt}[]`), validator section (https, platform from the
  sheet's own list, entry must match an external row, never an LC row), generator emits
  `url` on matching kind-3 rows, sheet view links them; unlisted stay unlinked.
  *Accept:* an unlisted external renders unlinked; a listed one links; validator fails on a
  fabricated entry. *(Ship empty-table-first; entries are maintainer work.)*
- **Gate P1:** GATES + the one-line test from the V14 design doc §7 (sheet journey) checked
  in unit form.

### Phase 2 — capability reader
- **T2.1 [R]** `src/utils/engine/capability.ts` per B5 (types, floors as named constants,
  deference cap, decay, basis sentences). Files: new engine + `src/store/selectors.ts`
  (`selectPatternCapability`, memoized beside `selectAllPatternWeakness`; interview sittings
  and the slug register join here). *Tests:* B5's list. *Accept:* fresh profile → all
  insufficient; self-reported contributes zero; weakness-named pattern caps at developing.
- **T2.2 [I]** Wire `isUnaidedMastery`/`MASTERY_ORDER` as reader inputs (independence
  dimension) — retiring their unused-export status.
- **Gate P2:** GATES; no selection path imports capability (grep).

### Phase 3 — failure → practice routing
- **T3.1 [R]** Extract `isReconstructionGap(p)` (rung ≥2 ∧ no passed review) into
  `engine/hints.ts`; replace both inline copies (`selectors.ts:610`, `:799`). Pure refactor;
  existing tests unmodified.
- **T3.2 [I]** Shared calibration constants (`MAX_PLAUSIBLE_RATIO`, `LOW_CONFIDENCE`) in one
  home (`engine/calibration.ts` or `timeEstimate.ts` exports); four call sites import it.
- **T3.3 [R]** `missKind: 'complexity'` registry entry + `MISS_SHAPE_COPY` entry + one-tap
  row renders five options. *Accept:* old payloads validate; the new kind aggregates.
- **T3.4 [R]** `RevisionEvent.depth?` field (types + lenient validator + round-trip);
  `reviseQuestion`/`reviseLibraryProblem` accept optional depth; `completeSessionActivity`
  passes `'reimplement'` for deep-band activities; all other graders omit it.
- **T3.5 [R]** `engine/practiceRouting.ts` per B6 (emphasis ids, floors, reasons,
  `EMPHASIS_COPY`); selector `selectPracticeEmphases`. *Tests:* one per mapping row +
  no-evidence → empty + determinism.
- **Gate P3:** GATES; routing writes nothing (grep for dispatches — reader only).

### Phase 4 — contextual revision
- **T4.1 [R]** `scoreRevisionFacts` optional `emphases` input (bounded additive term +
  verbatim reason); callers updated in sheet + contest revision paths; existing no-emphasis
  tests unmodified.
- **T4.2 [R]** Session emphasis bias in `session.ts` (term below `hint-reliant`'s 7; deep-band
  routing only; `reasonText` entry). *Accept:* ladder/schedule untouched (assert no date
  changes); arc/load rules hold.
- **T4.3 [R]** Redundancy guard (family + sub-topic dedupe with stated relaxation) in
  `selectSheetRevision` and the contest-revision practice list.
- **T4.4 [I]** Novelty term (B7.4). **T4.5 [R]** `PURPOSE_COPY` headers on the two revision
  modes. *Tests:* copy + guard + determinism.
- **Gate P4:** GATES; hero/plan agreement suite unmodified.

### Phase 5 — contest deltas
- **T5.1 [R]** Blind rung: transient `blind` on the live contest slice +
  `startFilteredContest(rows, seed, {blind})`; run page withholds rating/label/reasons (and
  pattern-bearing strings) until finished; verdict reveals all. *Tests:* DOM-absence
  pre-finish (the jsdom-latch hazard means asserting absence, not visibility), presence
  post-finish; banking identical to non-blind.
- **T5.2 [I]** Mixed set entry (2–4 patterns; `distinctPatterns: true`; reasons withheld
  until finish; alternating arrangement).
- **T5.3 [I]** Rating staircase for targeted draws (per-slot band windows around the band
  reading; actual-composition copy when the pool falls short).
- **Gate P5:** GATES + **the 62 pre-existing contest tests and Full Contest suite pass
  unmodified** (locked spec).

### Phase 6 — transfer / interleaving / discrimination
- **T6.1 [R]** Confusable-pairs table + validator + drill distractor weighting.
- **T6.2 [R]** `DrillDayResult.promptedPatterns?` (types/validator/write path/round-trip);
  capability recognition gains denominators for new data.
- **T6.3 [R]** Role-aware transfer ordering + cross-universe transfer rung (B10) in the
  sheet/contest revision draws, with the disguise copy.
- **T6.4 [I]** Pre-attempt discrimination question on blind rows (drills-channel recording).
- **Gate P6:** GATES; drills' first-attempt-per-date rule unmodified.

### Phase 7 — interview / cold start
- **T7.1 [R]** Cold-start toggle (gates difficulty + estimate for the sitting;
  `coldStart?: true` on the record; calibration insight segments on it).
- **T7.2 [I]** Graduation suggestion (OQ-5 predicate; invitation copy; never a gate).
- **T7.3 [I, descope-able]** Library-pool interviews (`slug?` on record; reveals state
  absence honestly; descope trigger defined in B9.3).
- **Gate P7:** GATES + interview leak tests (existing + cold-start additions) green.

### Phase 8 — UI coherence
- **T8.1 [R]** Capability/emphasis lines on practice rows; **T8.2 [R]** pattern-page
  capability panel; **T8.3 [R]** withheld-notices on blind/mixed surfaces; **T8.4 [I]**
  copy audit against the four questions (B12). *Tests:* copy assertions; a11y roles.
- **Gate P8:** GATES + impeccable-hook findings addressed.

### Phase 9 — persistence hardening
- **T9.1 [R]** Rollback-semantics test (V15 payload under pre-V15 validator: drop-not-
  quarantine, else redesign the flags per B13); **T9.2 [R]** captured-fixture round-trips
  for every new field; **T9.3 [R]** quarantine drill test.
- **Gate P9:** GATES.

### Phase 10 — test/validation sweep
- **T10.1 [R]** Execute the invariant→test audit: every B2 invariant row names its passing
  test; add any missing. **T10.2 [R]** Generator reproducibility check in `validate:data`
  docs. *Gate:* GATES.

### Phase 11 — browser QA
- **T11.1 [R]** Execute B13's script end-to-end; file defects as tasks under this phase's
  ledger row; re-run after fixes. *Gate:* all checks pass at all three viewports, both
  themes.

### Phase 12 — final gates + docs
- **T12.1 [R]** CLAUDE.md (sheet section, register meaning, capability/routing law,
  permitted importers, regeneration procedure); PRODUCT.md additions **only** for new
  surfaces (locked rules untouched); HANDOFF rewrite; design records; this plan's ledger
  closed. **T12.2 [R]** Full GATES + bundle report + the A5 defect list re-verified fixed.

### Phase ledger (tick as phases complete)

| Phase | Status | Gate record |
|---|---|---|
| 0 | ⬜ | — |
| 1 (T1.1–T1.13) | ⬜ | — |
| 2 | ⬜ | — |
| 3 | ⬜ | — |
| 4 | ⬜ | — |
| 5 | ⬜ | — |
| 6 | ⬜ | — |
| 7 | ⬜ | — |
| 8 | ⬜ | — |
| 9 | ⬜ | — |
| 10 | ⬜ | — |
| 11 | ⬜ | — |
| 12 | ⬜ | — |

---

# PART C — OPEN QUESTIONS

*(None of these block Phase 0–1; each names the phase it must be answered before. Defaults
are stated only where a phase cannot proceed without one, per the master spec.)*

**OQ-1 — "Beautiful Numbers" (blocks nothing; one line when answered).**
The single ambiguous sheet row. *Why it matters:* closed-world identity. *Recommendation:*
leave AMBIGUOUS until the user says LeetCode 3490 "Count Beautiful Numbers" or the Codeforces
problem. *Alternatives:* pick the Codeforces reading (its sub-topic neighbours are all
Codeforces) — rejected as a guess. *Impact:* one row.

**OQ-2 — XP for direct (self-reported) sheet solves (answer before Phase 1 T6/T8).**
*Why:* a click paying 10–30 XP × ~721 clickable rows is the one place XP and effort can
visibly decouple. *Recommendation (default if unanswered):* keep V14 D1 — ordinary
`SOLVE_XP` once per slug (consistency with the V13 §10.2 ruling; XP is explicitly not skill
in this product; the mastery layer gives these solves zero evidential weight, which is the
real safeguard). *Alternative:* half XP or zero XP for `selfReported` solves. *Impact:* one
constant in one thunk; no data migration either way.

**OQ-3 — mastery thresholds (answer before Phase 2 lands copy).**
*Why:* "Strong / Developing / Insufficient evidence" needs per-dimension minimum-evidence
counts; wrong thresholds make the reading either mute or noisy. *Recommendation:* start at
the codebase's own precedents — `MIN_SAMPLES = 5` (timeEstimate) for per-dimension evidence,
`MIN_BAND_EVIDENCE = 4` for timed evidence, weakness's `MIN_OBSERVATIONS` for rate signals —
and tune only with the user after real use. *Impact:* constants in the capability reader.

**OQ-4 — external problems' participation (answer before Phase 1 T13).**
*Why:* CSES/Codeforces/GfG rows are real practice the system cannot verify. *Recommendation:*
reference-only (display + verified link + provenance; no progress, no revision, no contest) —
an unverifiable register invites fake evidence, and `(platform,title)` is too fragile a key.
*Alternative:* a self-reported "worked through it" tick stored under a `ext:` slug-like key —
deferred unless the user wants it. *Impact:* none on schema today.

**OQ-5 — blind-mode graduation criteria (answer before Phase 7 UI).**
*Why:* when should the system *suggest* hidden-pattern practice for a pattern?
*Recommendation:* suggest (never force) blind practice when the pattern's recognition AND
recall dimensions read Strong, and always allow manual entry — a gate that forces blindness
would punish the wrong learner. *Impact:* one predicate + copy.

**OQ-6 — retro-provenance of pre-V15 register solves (answer before Phase 2).**
*Why:* existing `contestLibrary.bySlug` records (from V13 sittings) carry no `selfReported`
flag; after the flag ships, absent = sitting-made, which is historically true (V13 had no
direct solve path). *Recommendation:* treat absent as timed (correct for all existing data);
document in CLAUDE.md. *Impact:* none; stated for the auditor.

---

# PART D — HANDOFF / RESUME

**Current state (2026-08-20):** branch `v14-revision-sheet` holds commits `5f36816`
(shared mapper + V14 execution plan) and `66ad94c` (sheet dataset generator + dataset).
Working tree clean; 1,306 tests green at baseline; V14 Tasks 2–12 unimplemented. **This
master plan supersedes the V14 plan document** — the V14 doc remains in-repo as the
step-level detail for the tasks Phase 1 absorbs, with the amendments listed in Phase 1
(A5 fixes). Nothing beyond planning happens until the user approves this plan.

**First task to execute (after approval):** Phase 0 T0.1 (re-verify baseline gates on the
branch), then Phase 1 T1.1 (= V14 Task 2: types + decoder + chunk pin + dataset tests).

**Dependency order:** strictly Phase 0 → 1 → 2 → 3 → 4 → (5 ∥ 6 after 4) → 7 → 8 → 9 →
10 → 11 → 12, with the per-phase gates below. No later phase may begin while an earlier
phase's gate is red. Phases 5 and 6 are independent of each other; everything else is
sequential.

**Verification gate after every phase:** `npx tsc --noEmit` clean · `npx vitest run
--no-file-parallelism` green (count recorded in the ledger) · `npm run validate:data` OK ·
`npm run build` (app-chunk budget respected; chunk/import grep for any phase touching data
or store) · the phase's own acceptance criteria checked off · one commit per task, ledger
ticked in this document's Phase table.

**Exact resume procedure (any future session):**
1. `git checkout v14-revision-sheet` (or the successor branch named in the ledger).
2. Read this document's phase ledger (B16) top to bottom; find the first non-done task.
3. Run the full suite once (`npx vitest run --no-file-parallelism`) to confirm the recorded
   state before writing anything.
4. Continue at that task's first unticked step; tick steps as they land; commit per task;
   update the ledger row and, at phase end, the gate record.
5. If a defect interrupts a phase, record it under the phase's row before fixing —
   the ledger is the single source of "where are we".

---

## Final self-review (the §37 gate, executed)

All 24 checklist questions answer YES with a named section: V14 preserved (A3/P1); roadmap
untouched (B2.1/2.5, tests named); duplicate work prevented (B3 dedupe + B7.3 economy);
revision contextual (B7); solved ≠ mastered structural (B2.15/B5); transfer measured
(existing `transferRecord` + B5 dimension); recognition measured (drills + P6 denominators);
variation trained without invented content (B10); discrimination trained (B10); targeted /
mixed / blind contest (B8); blind interview (B9); failure routes practice (B6/P3–P4);
delayed recall influences mastery while the ladder stays pure scheduling (T3.4 + B5
reconstruction; ladder untouched); deterministic and explainable throughout (B2.12, every
term named); no fake precision (B2.14, no overall score anywhere); data integrity (B3);
no duplicate engines (B2.6 + B5's deference cap — the one place two readers could disagree
is closed by construction); complete persistence semantics (B11); browser QA (B13/P11);
rollback/migration (B13/T9.1). Three audit corrections were applied mid-review after the
subsystem reports (A4 items 2/4/5 rewritten: transfer band and cross-family drills already
exist — the plan extends them rather than duplicating them). Remaining decisions the user
owns are exactly the six OQs; every one has a stated default that unblocks execution.
