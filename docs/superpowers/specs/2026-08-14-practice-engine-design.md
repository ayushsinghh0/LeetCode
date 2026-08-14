# The Practice Engine — V6 design record (2026-08-14)

This is the permanent record behind every V6 copy and mechanism decision. Research was done
against the actual sources: the BDK "Teaching of Buddha" PDF was fetched and read (its copyright
page grants quotation with credit), the Atomic Habits framework was extracted from the author's
own first-party articles (jamesclear.com), each behavioral-science claim was verified against the
published literature with effect sizes, and Ryōkan scholarship/licensing was investigated
separately. Nothing below is quoted from memory.

## 0. What the gap analysis found

Most of the V6 directive is already this product's shipped spec. The habit contract (no streak
pressure, no guilt, fresh-start return, honest analytics) is PRODUCT.md law; time-chooses-depth
sessions, the finishable day, evidence-floored insights, anti-farming XP, factual register — all
built and tested. The genuine gaps:

1. **No positive habit machinery** — zero cue/intention/scheduling surface of any kind.
2. **No entry below 15 minutes** — the two-minute start and five-minute re-entry have no mechanism;
   the ReturnNotice is a paragraph that changes nothing.
3. **Reflection is the largest orphaned surface** — written in one panel, read by nothing; the
   session-close "name one idea" prompt captures nothing; no prompt after failure.
4. **No behavioral measurement** — no sitting ledger, no completion/abandonment signal
   (return-after-failure IS computable from existing DayLogs).
5. **The 130-prompt ML recall corpus is disconnected** — reveal-only, records nothing.
6. **The Dashboard epigraph is a misattributed-quotes corpus** (`quotes.ts`: "We are what we
   repeatedly do" is Will Durant paraphrasing Aristotle; the Lincoln discipline quote has no
   primary source) — precisely what V6 bans.
7. **Contest results still evaporate** (HANDOFF #1) — the mastery half of the habit×mastery model.

## 1. Source map (distilled; full extraction reports lived in the session transcript)

Evidence labels: **SOURCE** (the tradition's own claim), **RESEARCH** (verified peer-reviewed
finding, effect size noted), **HEURISTIC** (useful, honestly labeled as unproven), **INFERENCE**
(our own extrapolation, labeled).

### Atomic Habits (first-party, jamesclear.com)

| Principle | Status | Product consequence |
|---|---|---|
| Habit loop cue→craving→response→reward; failure at any stage kills the habit | SOURCE (book-framework) | Diagnostic checklist, not a menu |
| Implementation intentions: "I will [BEHAVIOR] at [TIME] in [LOCATION]" | SOURCE + RESEARCH (Gollwitzer & Sheeran 2006, d=0.65 lab; d≈0.14–0.31 field) | The intention builder's sentence structure |
| Habit stacking: "After [CURRENT HABIT], I will [NEW HABIT]"; cue must match frequency and be specific | SOURCE; RESEARCH prefers routine cues over clock cues (Keller 2021 RCT) | Builder anchors on routines, not times |
| Two-minute rule: gateway habit; "a habit must be established before it can be improved"; the two minutes must be the genuine whole commitment — actually stopping is what makes the ritual honest | SOURCE | Small start counts as practice; stopping is honored, never nagged |
| Never miss twice; "missing once is an accident"; recovery = **reduce scope, keep schedule** | SOURCE | The re-entry ritual shrinks the unit of work, never the cadence |
| Identity = accumulated votes; "every action is a vote"; proving identity to yourself beats results early on | SOURCE | Identity surfaces only as *evidence of process* (e.g. return-after-miss record), never as labels |
| Tracking is opt-in scaffolding; "better to consistently track one habit than sporadically track ten" | SOURCE | No per-intention completion tracking — the work ledgers already track the practice itself |
| Goldilocks rule; the "4%" figure | SOURCE; the 4% is **unverified attribution** | Never encode a difficulty delta constant |
| Plateau: "Valley of Disappointment" | book-only term, **UNSUPPORTED as research** | Show process evidence when flat; never claim "research shows a valley" |
| Mastery needs habits + deliberate practice; mindless reps reinforce, not improve | SOURCE (Ericsson cited) | The weakness/insight layer is the deliberate half; contest wiring feeds it |

### The Teaching of Buddha (BDK, fetched PDF; "Any part of this book may be quoted without permission")

| Teaching | Where | Product consequence |
|---|---|---|
| Four right efforts: prevent / remove / cultivate / sustain | Way of Practice II.5, p.168 | A taxonomy of effort, not a quantity |
| Srona and the harp strings — effort is tuning, "too tight" fails like "too loose" | Way of Practice II.10, p.170 | Anti-burnout copy has a citable source; the "too tight" half applies to our own users |
| Gradual training: farmer/archer/river imagery; setbacks normalized | Way of Practice II.1, II.13 | Plateau copy without fake science |
| Mind is trainable, craftsmanlike (arrow-maker, carpenter); "the mind will bear watching" even at its best | Sacred Sayings pp.184-189 | Maintenance-over-arrival framing; honest fit with spaced repetition |
| Middle Way = the Eightfold Path between two named extremes — **not** "moderation" | Dharma II.IV.1, p.57 | Never flatten to lifestyle balance advice |
| Impermanence: suffering comes from expecting the impermanent to be permanent | Dharma II.I | Skills decay; distress about decay comes from expecting them not to. Never a memento-mori urgency engine |
| Non-grasping retains diligence; "neither elated by success nor depressed by failure" | Dharma II.IV.2-5 | Process-over-outcome framing is legitimate; selling achievement-desire as Buddhist is not |
| Appamāda (heedfulness): "to be idle is a short road to death…"; the dust on the unread scripture | Sacred Sayings pp.184-190 | The most product-compatible theme; explains *why* daily care, never fuels a streak counter |
| Compassion is toward others; **self-compassion is not in this text** | verified absence | Compassionate failure copy is modern psychology (own that), never "the Buddha's teaching" |
| The famous last words are NOT in the BDK book | DN 16 §63 (tr. Vajira & Story): "All compounded things are subject to vanish. Strive with earnestness." | Cite DN 16 directly if used |

### Behavioral science (verified, with the honest boundaries)

- Retrieval > restudy for retention: **STRONG** (g≈0.51 vs restudy, Adesope 2017) — but worked
  examples legitimately beat testing for *novice procedural acquisition* (van Gog & Kester 2012;
  Yeo & Fazio 2019). Consequence: never shame solution-reading early; hint-no-penalty stays.
- Interleaving: **STRONG only for confusable neighbors** (Rohrer 2020 d=0.83 math; Brunmair &
  Richter 2019: benefit tracks similarity, ≈null for dissimilar material). Consequence: NO
  cross-track DSA/ML interleaving model — that prescription is an extrapolation, and building it
  would be fake science. Same-pattern drills and family transfer already implement the real thing.
- Broken streaks: highlighting them measurably reduces continuation (Silverman & Barasch 2022);
  repairability/reserves soften (Sharif & Shu 2019). Product already never headlines streaks.
- Gamification: informational progress feedback neutral-to-positive; contingent/controlling
  framing risks undermining (Deci 1999 d≈−0.3..−0.4; Hanus & Fox 2015). Existing XP is
  informational and locked spec — leave it.
- Self-explanation: **g≈0.55** (Bisra 2018) — backs reflection capture. The Wipro "reflection"
  field study is Gino-coauthored — never cite it.
- One missed day does not materially hurt habit formation (Lally 2010, genuinely in the data);
  "66 days" is **not usable** (median of 39 curve-fitted volunteers, range 18–254).
- Self-compassion after failure: **MODERATE**, small lab studies — basis for compassionate copy,
  never for a performance claim.
- Fresh-start effect: **MODERATE**, works for *initiation* — the returning-learner surface is the
  right (and only) place to lean on it.
- "85% optimal error rate": a gradient-descent theorem, not a human finding. Never encode it.

### Ryōkan

See §5 of the licensing report (pending at time of writing; the corpus rule below stands
regardless): **no English translation is quoted unless verified public-domain or freshly
translated from a public-domain Japanese original and labeled as this project's own translation.
No verse is attributed to Ryōkan without attestation. Original reflections inspired by documented
themes carry no attribution line at all** — an unattributed plain sentence makes no false claim.

## 2. Convergence map

Where the traditions agree, and where merging them would lie:

- **Agree — begin small, return easily.** Clear's two-minute rule; BDK's gradual-training imagery;
  Ryōkan's non-forcing. Safe to build one mechanism serving all three, described in plain words.
- **Agree — practice over outcome.** Systems-not-goals; non-grasping-with-diligence; ordinary
  life as practice. The product's existing factual register is already this voice.
- **Tension — effort.** Clear optimizes for automaticity; the BDK's right effort is one factor of
  a path aimed at liberation, and warns against "too tight" as much as "too loose." Resolution:
  the *mechanics* come from habit research; Buddhist material appears only as reflection, never
  as the justification for a mechanism.
- **Tension — measurement.** Atomic Habits endorses tracking (with cautions); Zen practice does
  not measure. Resolution: the internal model may measure (sittings, completion); the reflective
  surface never shows a number.
- **Do-not-merge.** Buddhist teachings are religious texts, not productivity levers: no Buddhist
  language on reward/streak/urgency surfaces, ever. "Right effort" never becomes UI copy for a
  scheduling feature. Reflection quotations are separated from mechanism copy by design: the
  epigraph rail is the only surface that quotes, and it recommends nothing.

## 3. Product map — what V6 builds

| # | Feature | Principle it serves | Evidence label |
|---|---|---|---|
| A | **Reflection corpus** replaces `quotes.ts`: verbatim BDK/DN16/public-domain quotations with full citations + original unattributed practice notes; date-seeded; context-aware (returning → returning theme); Dashboard epigraph rail unchanged in size | No fake quotes; one reflection at a time; Ryōkan daily teaching | SOURCE (quotations), HEURISTIC (selection) |
| B | **Practice intentions**: up to 3 learner-authored "After [my cue], I will [real app action]" sentences; authored in Settings, shown as one quiet rail line on Today; actions deep-link; no tracking, no XP | Implementation intentions + stacking; autonomy ("the system suggests, the learner chooses") | RESEARCH (d≈0.3 field) |
| C | **Small start**: two-minute entry on the hero (open → read → name the pattern → check against hint rung 1; stopping honored as complete); **five-minute re-entry** from ReturnNotice → Focus small mode: one lightest due item, then "continue or stop — both are fine" | Two-minute rule; never-miss-twice recovery (shrink scope, keep schedule); fresh-start initiation | SOURCE + RESEARCH (initiation) |
| D | **Reflection wiring**: stored reflection shown *after* grading a revision (never before — retrieval stays clean); optional one-line "what tripped it?" note on fail (`lastMissNote`, shown at next post-grade); session-close reflect activity captures its one line to a practice journal; Revision preview reads back the last line | Self-explanation g≈0.55; failure→information; closes the orphan | RESEARCH |
| E | **Sitting ledger + habit insights**: durable record of revision sittings (planned/done/completed) written at finish/stop; insight builders `sessionFollowThrough` (completion rate; recommendation is always to shrink the commitment, never to push) and `returnAfterFailure` (from existing DayLogs — the identity-as-evidence surface) | Habit measurement kept internal-simple; identity votes; never-miss-twice | INFERENCE (measurement), SOURCE (framing) |
| F | **ML recall recording**: "Check yourself" gains Got it / Not yet per prompt; first attempt per date is the signal (drills precedent); feeds `courseRetention` insight | Retrieval with feedback (STRONG) | RESEARCH |
| G | **Contest→weakness wiring** (HANDOFF #1): persisted stall records, 8th decayed weakness signal | Mastery = habits + deliberate practice: feedback where reps went mindless | SOURCE + repo design |

**Deliberately not built**, with reasons — this list is part of the record:

- **DSA/ML interleaving model** — the evidence supports interleaving *confusable* material only;
  cross-subject alternation is an extrapolation. Building it would be fake science.
- **Time-of-day analytics / time-to-start measurement** — requires a new clock-time data
  dimension in a deliberately date-only product for a single-user app; the cost (privacy surface,
  invariant break) exceeds the value of an insight the learner can observe themselves.
- **Streak changes** — locked spec, already ornament-only, already never headlined.
- **Habit library page / habit analytics dashboard** — habit tracking replacing actual work is
  anti-trap #4; the intentions rail and two insights are the whole user-facing habit model.
- **ML implement/experiment ladders as tracked state** — mlTracks/mlProjects stay documents this
  pass; recording recall is the evidence-backed increment.
- **A "ONE THING" mode** — /focus already is it; it gains only the small-entry mode.
- **Session presets below 15m** — the small start is an *entry*, not a budget; a 5-minute
  capacity would be false precision in the capacity model the product argues against.

## 4. Copy rules for V6 surfaces (enforced by tests)

1. A quotation renders verbatim with its attribution; an original note renders with none.
2. No Buddhist/Zen language on any mechanism, reward, or scheduling surface.
3. The small start is described as complete in itself ("that counts", "both are fine") — never as
   a foot in the door for more.
4. Failure copy converts to information ("what tripped it?"), never to judgment.
5. Habit-insight recommendations only ever shrink the commitment or change the cue — never
   "try harder", never "don't lose your progress".
6. No claim of the form "research shows" without a specific finding behind it in this document;
   the register of the forbidden claims list (66 days, 85%, valley, focus-breathing) is absolute.
