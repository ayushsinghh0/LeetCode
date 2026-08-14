# The Adaptive Mastery Engine — V7 design record (2026-08-14)

V7's directive ("make each practice session increasingly intelligent") arrived hours after V6
merged. The inspection pass found what the V6 gap analysis found before it: **most of the
directive is already this product's shipped spec** — the single prioritizer with stated reasons
IS the orchestrator, the weakness model IS the learner model's core, families/subpatterns ARE the
concept graph, and the evidence-floored insights ARE the humble analytics. V7 is therefore three
narrow slices closing the genuine gaps, not an intelligence layer built beside the product.

## 0. Architecture map (what the learner model already is)

One pure engine, one store, one persistence boundary — V7 adds no new architecture:

- **Knowledge state**: the 1/3/7/15/30 ladder (locked spec; the documented simplest-useful
  scheduler — the directive's "don't blindly copy SM-2" was settled in V1 and the choice is
  recorded); six named mastery states (`mastery.ts`: unseen→attempted→solved→reviewing→retained→
  mastered) with `isUnaidedMastery` reported beside, never folded in.
- **Evidence channels**: revision events (per-question dated pass/fail), drills
  (first-attempt-per-date recognition), transfer record (families), contest stalls, hint rungs
  (`hintLevelUsed`, monotonic), confidence self-ratings, course recall checks, the sitting
  ledger, DayLogs.
- **The one weakness model** (`weakness.ts`): 8 decayed signals, 0.24 weight cap,
  suppression-not-reweighting, `MIN_LIVE_EVIDENCE`.
- **Selection**: `nextAction.rankWork` (the day's one ordering; hero = [0]; plan = greedy pack) and
  `session.buildRevisionSession` (time-chooses-depth composition; deepest-band-first selection,
  lightest-first playback; every activity carries a `why` that must survive being read).
- **Reflection loop**: post-grade reveal, miss notes, journal, read-back.
- **Analytics**: eleven insight builders, each with its own floor, `null` below it.

## 1. Directive coverage — the 52 principles

SHIPPED (exists and is tested): P1 (mastery states + unaided quality), P2 (all dimensions except
error kinds — see slice 1 — and clock-time ones), P3 (patterns→subpatterns→families; family role
order canonical→warm-up→standard→variant→stretch is the honest within-family prerequisite path),
P5 (five-stage ladder — one correct answer never masters), P6/P7 (ladder + session score reading
overdue/failures/confidence/weakness/staleness; assumptions documented), P8 (fail → stage 0 due
tomorrow, history preserved, no loss copy), P12 (session transfer band + transfer record +
insight), P13 (families/drills variation), P14 (weakness-weighted selection; no difficulty-delta
constant — the 4% figure was demolished in the V6 record §6.3), P15 (`confidenceCalibration`
measurement + `calibration` builder — over- and under-confident verdicts, hard floors), P16
(sparse reflection loop), P20/P21 (adaptive plan, reasons everywhere), P25/P26 (states + decay via
`MIN_LIVE_EVIDENCE` and the predictor), P27 (labels, never percentages), P30 (drills + hint rung 1
+ subpattern data), P35–P37 (autonomy, fresh-start recovery, plan recalculated from present state
— anti-backlog by construction), P38 (XP gates, first-attempt-per-date, committed-work sittings),
P39/P40 (evidence floors), P42 (local-first, no network, no clock-time behavioral data), P44–P46
(quiet surfaces; rankWork is the explainable next-best-action), P49–P50, P52 (quiet endings).

RECORDED (deliberately not built, reasons standing): cross-pattern prerequisite graph and
backward debugging chains (P28/P29 beyond families — would be a hand-authored taxonomy with no
evidence base; the directive's own "do not create a fake taxonomy" bars it), a second ML concept
graph (P4 — weeks/recall/tracks/projects already structure the course; duplication), time-to-start
and energy inference (P10/P18 — clock-time dimensions in a date-only product, V6 record §3),
habit/product experiments (P24/P41 — n=1 causality, V6 §5), goal multiplexing (P48 — PRODUCT.md
fixes the product's job; fake multi-goal would be fake personalization), session-shape menagerie
(P19 — shapes are budget-derived; naming more of them is UI, not intelligence), ML
implement/experiment tracked ladders (P31/P33 — V6 record §3), forced DSA↔AI concept links (P34).

V7 BUILDS (the genuine gaps):

| # | Slice | Principle | Evidence label |
|---|---|---|---|
| 1 | **Classified miss evidence**: optional one-tap kind on the fail flow (recognition / implementation / edge-case / recall), stored on the day's fail event, aggregated into a floored insight | P9 error taxonomy | PRODUCT HEURISTIC (the taxonomy maps to the product's own evidence vocabulary — drills/recall/implementation — not to a research claim) |
| 2 | **Reconstruction scheduling**: `hintReliant` (solved at rung ≥2, no passed review since) enters the session priority score with its own spoken reason, so deepest-band-first placement gives those items the re-implement treatment | P11 hint debt, P32 reconstruction | SOURCE (retrieval > restudy, V6 §1) + PRODUCT HEURISTIC (the routing) |
| 3 | **The quiet stop**: when a sitting's own grades ran failed > passed (≥2 fails), the completion state adds one sentence — evidence banked, ladder already rescheduled, stopping is a good stop | P51/P52 | PRODUCT HEURISTIC; copy rules 4–5 binding |

## 2. Invariant analysis (what the slices must not touch)

- The ladder is locked. Slice 2 changes *composition depth priority*, never a date, never a
  stage. A hint-heavy solve is repaired by session treatment, not by rescheduling.
- Hints are a signal, never a penalty. `hintReliant` may only *add* priority (earlier, deeper
  attention), exactly as `low-confidence` already does — it can never reduce XP, block mastery,
  or read as judgment. Its spoken reason states the fact ("solved with the ladder's help, not yet
  re-derived unaided") and the treatment, nothing else.
- Weakness stays claimed in one place. Miss kinds do NOT become a ninth weakness signal — they
  are per-question evidence (session reasons) and a corpus-level insight, never a pattern-level
  weakness claim. The insight's sentences describe misses, not patterns.
- Uncertainty is allowed (P9): the classification is optional, defaults to untagged, is one tap,
  and is reversible same-day. An untagged fail carries exactly the evidence it did in V6.
- Validator parity: `missKind` is optional-with-boundary-default; the validator admits any
  string (a removed kind must never quarantine an old payload); the thunk normalizes to the
  registry or null.
- One reflection surface, no Buddhist/Zen mechanism language, no streak/guilt registers — all
  V6 copy rules bind V7 copy.

## 3. Data changes

`RevisionEvent` gains optional `missKind?: string` (registry: `engine/miss.ts` —
recognition / implementation / edge-case / recall). Written by `classifyMiss` thunk →
`missClassified` reducer, which attaches the kind to the day's own fail event only (same-date,
failed, last event), last-write-wins, clearable. `RevisionCandidate` gains `hintReliant:
boolean`, assembled in the selector from `hintLevelUsed >= 2 && !revisionHistory.some(passed)`.
No new slices, no schema version bump, quarantine philosophy unchanged.
