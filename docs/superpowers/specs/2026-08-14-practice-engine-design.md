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
| Implementation intentions: "I will [BEHAVIOR] at [TIME] in [LOCATION]" | SOURCE + RESEARCH (Gollwitzer & Sheeran 2006, d=0.65 lab; d≈0.14–0.31 field) | The builder ships the *stacking* formula, not this one — see the next row; the book itself bridges them ("Habit stacking is a special form of an implementation intention", ch. 5), so the research inheritance is legitimate but the formula citation belongs to stacking (corrected in §6 after the full-book audit) |
| Habit stacking: "After [CURRENT HABIT], I will [NEW HABIT]"; cue must match frequency and be specific | SOURCE; RESEARCH prefers routine cues over clock cues (Keller 2021 RCT); method provenance BJ Fogg ("anchoring", Tiny Habits), term S.J. Scott (book's own credits) | Builder anchors on routines, not times — this formula is the one the intentions feature implements |
| Two-minute rule: gateway habit; "a habit must be established before it can be improved" (book's own sentence, ch. 13) | SOURCE. **Corrected by the full-book audit (§6):** the mandatory stop is the book's *conditional* variant ("If the Two-Minute Rule feels forced, try this: do it for two minutes and then stop"), not its baseline, which expects continuation ("Make it easy to start and the rest will follow") and later scales the ritual up ("habit shaping") | Small start counts as practice; stopping is honored, never nagged — grounded in the book's "It's better to do less than you hoped than to do nothing at all" and identity-votes-at-small-scale, and a *deliberate divergence* from habit shaping's graduation arc (the habit contract forbids nagging the entry upward) |
| Never miss twice; "missing once is an accident"; recovery = **reduce scope, keep schedule** | SOURCE | The re-entry ritual shrinks the unit of work, never the cadence |
| Identity = accumulated votes; "every action is a vote"; proving identity to yourself beats results early on | SOURCE | Identity surfaces only as *evidence of process* (e.g. return-after-miss record), never as labels |
| Tracking is opt-in scaffolding; "better to consistently track one habit than sporadically track ten" | SOURCE | No per-intention completion tracking — the work ledgers already track the practice itself |
| Goldilocks rule; the "4%" figure | SOURCE; the 4% is **unverified attribution** | Never encode a difficulty delta constant |
| Plateau: "Valley of Disappointment" | book-only term, **UNSUPPORTED as research** | Show process evidence when flat; never claim "research shows a valley" |
| Mastery needs habits + deliberate practice; mindless reps reinforce, not improve | SOURCE (Ericsson cited) | The weakness/insight layer is the deliberate half; contest wiring feeds it |

### The Teaching of Buddha (BDK, fetched PDF; "Any part of this book may be quoted without permission")

| Teaching | Where | Product consequence |
|---|---|---|
| Four right efforts — the book's own term is "The Four Right Procedures": prevent / remove / induce / encourage-continuance | Way of Practice II.5, p.168 (verified exact, 2019 printing) | A taxonomy of effort, not a quantity |
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

## 5. Directive coverage audit (2026-08-14, on the directive's re-issue after the merge)

The V6 directive was re-issued against the merged tree, together with the two source books as
PDFs. This section maps every directive section to what answers it. Three kinds of answer:
**SHIPPED** (a mechanism exists and is tested), **RECORDED** (deliberately not built, reasons in
§3's not-built list or §1's evidence boundaries — re-litigating needs new evidence, not a re-read
of the same directive), and **OPEN** (neither). The full-book audit — the one thing the original
pass could not do, since Atomic Habits was extracted from the author's articles rather than the
book — was run against the actual PDFs; its findings are §6.

| Directive section | Answer |
|---|---|
| Habit loop / personal habit builder / habit stacking | SHIPPED — intentions (≤3, routine-anchored cue → registry action, untracked) |
| Identity-based learning | SHIPPED — identity only as evidence of process (`returnAfterFailure`'s strength tone); no labels anywhere |
| Law 1 obvious | SHIPPED — one hero with a reason, intentions rail, visible next action everywhere |
| Law 2 attractive | SHIPPED — what-this-tests before the attempt, families/transfer, topic-level company evidence, visible ladder state |
| Law 3 easy | SHIPPED — time-chooses-depth sessions, small start, deep links, "Not this one", one-click paths |
| Law 4 satisfying | SHIPPED — recall counts read back, next-review dates stated, post-grade reveal; XP stays informational |
| Two-minute entry | SHIPPED — hero small start; stopping honored as complete (copy rule 3) |
| Environment design / friction audit | SHIPPED — the V5→V6 arc (one recommendation, finishable day, frozen sessions, capacity chips) is that audit's output |
| Bad habits / reverse laws | SHIPPED where applicable — ≤1 notification/day, no feeds to hide; the app has no dark corners to make invisible |
| Never miss twice / five-minute recovery | SHIPPED — ReturnNotice + `/focus?entry=small` re-entry |
| No streak obsession | SHIPPED — locked spec, never headlined, break never punished |
| Plateau | SHIPPED — process evidence via insights; `n-flat` note; no valley-as-research (§1 boundary) |
| Goldilocks | SHIPPED within the fixed curriculum — weakness-weighted selection, hint ladder, drills; no difficulty-delta constant (§1: the 4% figure is unverified) |
| DSA habit engine (5m–2h) | SHIPPED for 15m+; sub-15m presets RECORDED (an entry is not a budget) |
| ML habit engine | SHIPPED for recall (Got it / Not yet, first-attempt-per-date); implement/experiment ladders as tracked state RECORDED |
| DSA×ML interleaving | RECORDED — evidence supports interleaving confusable material only (§1); drills/transfer already implement the real thing |
| Deep work / ONE THING mode | SHIPPED — `/focus` is it (RECORDED: no second mode) |
| Mindful practice | SHIPPED as tiny moments — "name the pattern first", "what tripped it?", stuck-point copy; no meditation surface |
| Buddhist faithfulness / Middle Way / non-attachment / impermanence / compassion | SHIPPED as corpus + §1 source map + copy rules 1–2; mechanisms never cite scripture |
| Ryōkan layer + daily teaching + no quote spam | SHIPPED — corpus with attestation metadata (the directive's poem/translator/source/confidence schema is `ReflectionSource`); one epigraph, one line |
| Habit diagnostic / habit failure loop | SHIPPED as the insights' recommendations (shrink the session, change the cue, smaller re-entry) — never "lack of discipline"; no interrogative wizard (anti-trap 3) |
| Habit formation analytics | SHIPPED internal-complex/user-simple — sittings ledger internal, two floored insights user-facing; time-to-start RECORDED (clock-time dimension) |
| Behavioral experiments | RECORDED — n=1 product; the directive's own rule ("never pretend causality from tiny samples") forbids the causal reading, so no experiment harness is built |
| Learner-specific habit system | SHIPPED within evidence — pace ratio, weakness decay, drill weighting; time-of-day learning RECORDED |
| Time as first-class resource | SHIPPED — one capacity, plan cut to fit, load caps and spacing |
| Daily practice plan | SHIPPED — Today is purpose/time/why/start/practice/transfer/reflection in that shape |
| Weekly review | RECORDED via §6 — the book's actual prescription at this cadence is "review your automated measurement each week or each month", which the sitting ledger + Analytics already are; its *deep* reflection cadence is twice a year, out of scope for a one-quarter product run. A weekly ritual page would be anti-traps 3/4 with no book basis |
| Monthly review | RECORDED via §6 — same basis; the directive's monthly cadence is its own invention, not the book's |
| Habit × mastery model | SHIPPED — habit layer gets the learner to sit; ladder/weakness/insights/contest decide whether it worked |
| Anti-traps 1–20 | SHIPPED as law — PRODUCT.md habit contract + copy rules + adversarial sweeps (§7 of HANDOFF history) |
| Source attribution metadata | SHIPPED — `ReflectionSource` per line; evidence labels per principle in §1 |
| Habit library | RECORDED — anti-trap 4 (tracking replacing work); intentions + two insights are the whole user-facing habit model |
| Adversarial tests | SHIPPED — run on 2026-08-14; found and fixed the recall-feedback ternary and the adjunct-counting sitting bug |

## 6. Full-book audit (2026-08-14) — the actual PDFs, read cover to cover

The original pass extracted Atomic Habits from the author's first-party articles. On the
directive's re-issue the user supplied both books as PDFs; four parallel readers then read them
completely — Atomic Habits in three ranges (front matter–ch. 7; ch. 8–14; ch. 15–end matter
including every endnote and asterisked footnote) and the BDK book end to end. Load-bearing agent
claims were re-verified against the raw extractions before anything below was acted on.

### 6.1 The BDK corpus verification — clean

Every shipped quotation checked out: three verbatim, two trimmed exactly as their declared trims
state. The quotation grant is verbatim on the copyright page. Both verified-absence claims hold:
the famous last words appear nowhere (the book's own last words open "Make of yourself a light";
its closest impermanence passages carry no "strive on" exhortation), and compassion is never
self-directed — the book in fact censures indulging one's own discouragement (p. 98-99, 2019
printing), which *strengthens* the rule that compassionate failure copy is modern psychology and
must never be attributed to this text. All section locators were exact; three page numbers drift
in the 2019 printing vs the cited 2005 one (harp 172-173 vs 170; archery 175 vs 174; the
bear-watching sentence on 122 within §I.7 starting at 121) — the corpus locators now record both.
Two new verified quotations entered the corpus: `b-steps` (Way of Purification §II.9, theme
*beginning*) and `b-errors` (§III.6, theme *effort*, first sentence only — the "foolish man"
contrast half is deliberately left behind).

### 6.2 Atomic Habits — corrections to §1 (both applied in place)

1. **The intentions formula.** The builder implements the habit-stacking formula ("After
   [CURRENT HABIT], I will [NEW HABIT]"), not "I will [BEHAVIOR] at [TIME] in [LOCATION]". The
   book bridges them itself — "Habit stacking is a special form of an implementation intention"
   — so the Gollwitzer research inheritance stands, but the formula citation now points at
   stacking, with the book's own provenance credits (BJ Fogg's anchoring; the term from
   S.J. Scott).
2. **The two-minute stop.** "Actually stopping is what makes the ritual honest" overstated the
   book: the mandatory stop is the *conditional* variant offered when the rule feels like a
   trick; the baseline framing expects continuation, and ch. 13's "habit shaping" scales the
   ritual upward through five phases. The product's permissive stop stands on better passages
   than the record had cited — "It's better to do less than you hoped than to do nothing at
   all", the five-days-of-two-minutes identity-votes passage, and the Hemingway/McKeown
   stop-while-going material — and the refusal to nag the entry upward is now recorded as a
   deliberate divergence from habit shaping, required by the habit contract.

### 6.3 Atomic Habits — claims confirmed with book locators

"Never miss twice" and "Missing once is an accident. Missing twice is the start of a new habit"
are verbatim (ch. 16); "reduce scope, keep schedule" is our faithful synthesis, not book wording
— the book's own recovery mechanics are "show up when you don't feel like it—even if you do less
than you hope" and "Don't put up a zero". Two provenance notes worth keeping: Clear himself
reports the never-miss-twice aphorism unsourced ("all of my searches for a source are coming up
empty"), and the research-grade support for lenient recovery is the Lally et al. endnote —
missing a habit once has virtually no impact on long-term formation. The tracking sentence
("better to consistently track one habit than to sporadically track ten") is verbatim, and the
chapter's Goodhart material (named as such, with the endnote crediting the famous wording to
Strathern) is the book-side twin of the product's metrics-as-feedback rule. The Goldilocks "4%"
is now triple-condemned: hedged in-text, third-hand in provenance (Kotler ← a Chip Conley
personal communication ← a purported Csikszentmihalyi calculation), and contradicted by its own
endnote ("the real ratio … is 1:96"); the citable substitute is "just manageable difficulty"
(Hobbs 1959; Brim; Csikszentmihalyi). Mastery = habits + deliberate practice confirmed, with the
Ericsson citation attaching specifically to the slight-decline-after-mastery claim — which sits
in acknowledged, unactioned tension with the locked stage-5 = mastered spec.

### 6.4 Embodied but previously unclaimed — book passages the product already implements

| Book claim (locator, PDFDrive pages) | Where the product embodies it |
|---|---|
| "Many people think they lack motivation when what they really lack is clarity" (ch. 5) | The one hero with a stated reason; the plan derived from the same ranking |
| Decisive moments — "you can only order an item if it is on the menu" (ch. 13) | The hero + "Not this one" ranked chain constrain the option menu |
| Motion vs action — "When preparation becomes a form of procrastination…" (ch. 11) | One next action; the finishable day; no planning surfaces to hide in |
| Anticipation drives action (ch. 8, dopamine hedge intact) | `tests` shown before the attempt; the preselected next problem |
| Positive Diderot chaining (ch. 5) | The session arc: open on something achievable, momentum carries into heavier bands |
| Endings are remembered — "You want the ending of your habit to be satisfying" (ch. 15) | Recall counts read back at completion; the session-close journal line |
| "Incentives can start a habit. Identity sustains a habit" (ch. 15) | XP informational and locked; evidence read-backs are the identity votes |
| Asymmetric loss — "Lost days hurt you more than successful days help you" (ch. 16) | returnAfterFailure notices the return, never punishes the break |
| Negative identity labels calcify (ch. 2) + "keep your identity small" (ch. 20) | Present-tense weakness, absence-not-"strong", no learner labels anywhere |
| Feedback dosage — the mirror-distance passage (ch. 20) | Insights suppress below evidence floors rather than pad |
| Satisfaction = Liking − Wanting (appendix) | Recommendations only ever shrink the commitment — moving the expectation term |
| "The greatest threat to success is not failure but boredom" (ch. 19) | One prioritizer; no strategy-hopping surfaces; the roadmap holds |

Deliberately still forgone, now with the book in hand: temptation bundling (the one large Law-2
lever unbuilt — nothing in the product bundles a want with a need, and nothing should, given the
no-manipulation contract), ch. 9's social layer (the book offers no non-social substitute;
a single-user product simply forgoes it), self-administered punishment (ch. 17's own limiting
condition — punishment must be reliably enforced — is impossible single-user), and variable-
reward scheduling (the book itself: variable rewards amplify existing cravings and do not belong
everywhere).

### 6.5 The weekly/monthly review resolution

The book's prescribed deep-reflection cadence is **twice a year** — the December Annual Review
("What went well? What didn't? What did I learn?") and the summer Integrity Report — explicitly
"just a few hours per year". Weekly/monthly appears once, as the ch. 16 note to *review automated
measurement* "each week or each month" rather than re-recording it daily. The product already is
that prescription: the sitting ledger and recall log are the automated measurement, and the
Analytics page is the review surface — available at any cadence, evidence-floored, answering the
directive's own weekly questions where the data can ("what became easier" = retention trend,
"what did I avoid" = unfinished signal, "what helped" = follow-through) and staying silent where
it cannot. A dedicated weekly/monthly ritual page would therefore rest on a cadence the source
does not prescribe, duplicate an existing surface, and walk into anti-traps 3 and 4. Not built.

### 6.6 Hedge register (the book's own flags, binding on any future copy that cites it)

- "This book is not an academic research paper; it's an operating manual" — the framework is a
  synthesis, and Clear calls claiming exhaustiveness "irresponsible" himself (ch. 3).
- The 1%/37x arithmetic is illustrative, not empirical. The British Cycling story carries the
  author's own going-to-print caveat. The Jung epigraph is a probable paraphrase *by the book's
  own endnote* — the exact famous-name failure mode the reflections tests ban; never lift it.
- "Dopamine is not the only chemical…anyone who claims 'habits are all about dopamine' is
  skipping over major portions of the process" (the book's own footnote).
- Clear's Two-Minute Rule is a downscaling rule; David Allen's identically named rule is a
  do-it-now triage rule. Citations must not conflate them.
- The motivation-ritual chapter self-labels lightweight ("These little mind-set shifts aren't
  magic"); its evidence is largely anecdote.
