# DSA Roadmap — Repository Report

**Repository:** `D:\ayuu\Leetcode` · **Branch:** `main` @ `43eecf4` · **Report date:** 2026-08-19
**Verification:** every number in §3 was produced by running the command shown, in this working tree, for this report.

---

## 1. At a glance

| | |
|---|---|
| **What it is** | A local-first, single-user SPA that runs a 539-question DSA interview curriculum with spaced repetition, plus a parallel AI/ML course track, eleven from-scratch ML implementation tracks, recognition drills, interview rehearsal, and timed contests. |
| **Stack** | Vite 6 · React 18 · TypeScript 5.6 (strict + `noUncheckedIndexedAccess`) · Redux Toolkit 2 · React Router 6 · Tailwind 3.4 · Framer Motion 11 · Recharts 2 · Vitest 3 (jsdom) |
| **Backend** | None. No accounts, no network at runtime. State lives in `localStorage` under `dsa-roadmap:v1`. |
| **Source size** | 28,781 lines of non-test TS/TSX across 166 files; 18,058 lines of test code across 83 files |
| **Content size** | ~2.1 MB of generated/authored JSON (539 questions, 103 problem families, 108 sub-patterns, 17 company sources, 11 ML tracks, 14 ML projects, 130 recall prompts, a 645 kB LeetCode catalog snapshot) |
| **Tests** | 1,176 tests / 83 files — **all green** on a clean run |
| **Type-check** | `tsc --noEmit` clean |
| **Build** | Clean; 3,354 modules; app chunk 280.77 kB (91.33 kB gzip) |
| **History** | 115 commits, 2026-07-30 → 2026-08-16, one author (`ayushsinghh0`) |
| **Governance docs** | ~95 kB of committed prose: `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `HANDOFF.md`, `CONTEXT.md`, plus 10 dated design records under `docs/superpowers/` |

The single most distinguishing property of this repository is not its feature count — it is that **its rules are written down, its claims are evidence-gated, and its refusals are documented as findings.** Roughly one line in five of the source is a comment (20.7%), and in the pure-logic engine layer it is nearly one in three (29.9%), almost all of it explaining *why* a rule exists and what defect its absence caused.

---

## 2. What this repository is

A daily study instrument for one software engineer preparing for technical interviews, designed to be opened every day for about ten weeks.

Two learning tracks run side by side and are treated as equal citizens of one activity system (streaks, heatmap, calendar, XP, achievements, revision all count either):

1. **The DSA roadmap** — 539 questions across 28 classic patterns, sliced into fixed daily portions (default 8/day → 68 days), with every solve entering a 1 → 3 → 7 → 15 → 30-day revision ladder.
2. **The AI/ML course** — 26 core week-modules (100xDevs cohort) paced as two-day sprints (52 sessions) plus 5 optional extras; cleared weeks enter the same ladder. Eleven from-scratch implementation tracks and a 14-project ladder hang off it.

Around those sit the rehearsal surfaces — recognition drills, interview mode, contest mode — and the reflection surfaces — practice intentions, session journal, miss taxonomy, analytics.

The product's stated job is narrow and it holds it: **answer "what do I do next?" with exactly one thing, a reason, and a time estimate**, and fit whatever time the learner actually has.

---

## 3. Verified health

Everything in this section was executed for this report, not read from a doc.

| Check | Command | Result |
|---|---|---|
| Full test suite | `npx vitest run` | **83 files / 1,176 tests passed**, exit 0 |
| Type-check | `npx tsc --noEmit` | **Clean**, exit 0 |
| Production build | `npm run build` | **Clean**, 3,354 modules, 25.5 s |
| Dataset validation | `npm run validate:data` | **OK** — "passes all structural and external-identity checks" |
| Lint | — | **No linter configured** (no ESLint/Prettier/Biome config in the repo) |
| CI | — | **No CI** (no `.github/`, no pipeline config) |

### One honest caveat about the test suite

The first full run I made — executed in the background while I was concurrently reading files — reported **3 failed / 1,173 passed**. A second, uncontended run reported **1,176 passed**. The one failure I could identify from the log is `src/components/questions/__tests__/questionCard.test.tsx:212`, a `findByText` on the lazily-loaded markdown preview — which `HANDOFF.md` already documents as "a documented under-load flake; passes solo."

So: **the suite is green, and it is also load-sensitive.** The failures are timeout-shaped, not assertion-shaped. `vite.config.ts` carries a well-reasoned comment about this (`testTimeout: 30_000` is deliberately a kill ceiling above every per-query window), but the underlying fragility — real timers racing lazy-chunk transforms under worker contention — is unresolved. See §16.2.

### Dataset validator output (verbatim figures)

```
questions: 539, leetcode-linked: 528, unresolved: 11
intelligence: 539 capability sentences, 508 with stated complexity
companies: 17 first-party sources, 5 enumerating topics
ml tracks: 11 × 5 stages, 44 failure modes, 4 with no course week (stated, not guessed)
ml projects: 14 across 7 tiers, 12 baselines stated / 2 for the learner to establish
```

---

## 4. Repository map

```
D:\ayuu\Leetcode
├── CLAUDE.md          30 kB  architecture law (agent-facing, but the real architecture doc)
├── DESIGN.md          30 kB  visual system + mandatory composition contract + scroll contract
├── PRODUCT.md         14 kB  locked product truth (rules that may not be changed in design work)
├── HANDOFF.md         12 kB  session state: what shipped, what is verified, what bit
├── CONTEXT.md          9 kB  a portable onboarding digest of the above
├── README.md          10 kB  user/deployer-facing
├── docs/superpowers/
│   ├── plans/         1 file  (1,432-line original implementation plan, 25 tasks)
│   └── specs/        9 files  dated design records, V6 → V12 (2026-07-30 … 2026-08-16)
├── scripts/                   the content pipeline (Node ESM, no deps)
│   ├── generate-questions.mjs 65 kB — the ONLY writer of src/data/*.json
│   ├── validate-questions.mjs 18 kB — offline structural + identity validator
│   ├── audit-links-live.mjs          live LeetCode link audit (network, never in CI)
│   ├── audit-companies-live.mjs      live company-quote re-verification (network)
│   ├── fetch-leetcode-catalog.mjs    refreshes the catalog snapshot
│   └── data/                  hand-authored sources (curriculum, intelligence, companies, ML)
├── src/                       the application (see §5)
├── index.html                 carries the design direction contract as an HTML comment
├── vite.config.ts             manualChunks policy + vitest config
├── tailwind.config.js         tokens, the `short:` height breakpoint, prose overrides
└── vercel.json                one SPA rewrite; that is the entire deploy config
```

### Where the code is

| Area | Files | Non-test lines |
|---|---:|---:|
| `src/utils/engine/` — pure business logic | 26 | 6,794 |
| `src/pages/` — 18 route components | 18 | 7,486 |
| `src/components/` — 60 components (incl. 12 vendored UI primitives) | 60 | 7,524 |
| `src/store/` — 14 slices + thunks + selectors | 20 | 3,606 |
| `src/data/` — typed accessors over generated JSON | 12 | ~1,900 |
| `src/services/storage/` — persistence seam | 4 | ~450 |
| `src/hooks/`, `src/contexts/`, `src/utils/` | 11 | ~700 |
| **Tests** (`__tests__/` everywhere) | **83** | **18,058** |

Test code is **63% of the size of production code** — an unusually high ratio for a solo project, and it is real coverage, not scaffolding (see §12).

---

## 5. Architecture

Four layers, and the dependency arrow only ever points one way:

```
        ┌─────────────────────────────────────────────────────────┐
        │  UI      src/pages (18 lazy routes) + src/components     │
        │          AppShell (sidebar ≥md / bottom nav <md)         │
        │          /focus routed OUTSIDE the shell                 │
        └───────────────┬─────────────────────────────────────────┘
                        │ dispatches ONLY store/actions.ts thunks
                        │ reads ONLY memoized selectors
        ┌───────────────▼─────────────────────────────────────────┐
        │  STORE   14 slices · actions.ts (the sole mutation API)  │
        │          selectors.ts + analyticsSelectors.ts            │
        │          supplies the clock via todayISO()               │
        └───────────────┬─────────────────────────────────────────┘
                        │ calls pure functions
        ┌───────────────▼─────────────────────────────────────────┐
        │  ENGINE  src/utils/engine/* — 26 modules, zero React,    │
        │          zero Redux, zero clock access. ISO strings in.  │
        └─────────────────────────────────────────────────────────┘

        ┌─────────────────────────────────────────────────────────┐
        │  PERSISTENCE  StorageAdapter interface ← debounced       │
        │               middleware. UI never touches localStorage. │
        └─────────────────────────────────────────────────────────┘
```

### The three rules that make this hold

1. **The engine never reads a clock.** Every function takes ISO `yyyy-MM-dd` strings (which compare correctly with `<=`). The single clock read in the whole application is `todayISO()` in `src/utils/dates.ts`, called only from thunks and the `useToday()` hook. This is what makes 1,176 tests deterministic — and it is why every page test can pin `vi.setSystemTime(new Date('2026-07-30T12:00:00'))` and stay honest a year later.

2. **`src/store/actions.ts` is the only public mutation API.** UI components never dispatch slice actions directly (the one documented exception is the `ui` slice). Thunks supply dates, orchestrate cross-slice effects — XP, bonus gates, achievement evaluation, celebration triggers — and normalize their own payloads so a persistable value is guaranteed at the write, not hoped for at the read.

3. **`src/utils/dates.ts` is hand-rolled on purpose.** date-fns stays available to lazy routes, but the eager graph uses ~30 lines of local-midnight arithmetic instead, because importing `format`/`parseISO` here pulled ~40 kB of minified formatting machinery into the main chunk for what is, at day granularity, four functions.

### Adding a route touches exactly three things

`src/App.tsx` (lazy import + `<Route>`), `src/components/layout/navItems.ts` (the one nav registry), and nothing else — because `src/__tests__/routes.test.tsx` is driven off `NAV_ITEMS` via `test.each`, so a new nav entry automatically gains mount coverage through the real lazy boundaries, and a route added *without* a nav entry silently has none. That is a genuinely clever coupling: the registry is both the navigation source of truth and the test manifest.

---

## 6. The engine layer — module catalogue

26 pure modules, 6,794 lines, ~30% comments. This is where the product actually lives.

| Module | Lines | What it owns |
|---|---:|---|
| `insights.ts` | 1,466 | Analytics that *decide something*. Every card carries headline + evidence + recommendation + an action button. ~26 insight kinds; each has a stated minimum sample and returns `null` below it. |
| `interview.ts` | 823 | Interview mode as data: 10 stages (understand → clarify → approach → brute-force → optimize → invariant → implement → test → complexity → follow-up), staged reveals, 5 self-assessment dimensions, up to 4 generated follow-ups, pace readings. |
| `session.ts` | 805 | "I have N minutes — compose me a session." Time chooses **depth** (recall / review / deep / transfer), not count; cognitive load tracked separately from minutes; the session has an arc. Five session shapes (quick / standard / focused / deep / extended). |
| `weakness.ts` | 656 | **The single weakness model.** 8 weighted signals, 30-day half-life decay, minimum-observation floors, and an explicit "unmeasured ≠ zero" rule. |
| `contest.ts` | 385 | Timed 4-problem sets (easy/medium/medium/hard, distinct patterns, date-seeded), and a deliberately conservative post-contest reading. |
| `nextAction.ts` | 316 | **The single prioritizer.** `rankWork()` returns the whole day's work, most valuable first; the Today hero is `[0]`, the session plan is a greedy pack over the same list. |
| `achievements.ts` | 305 | 48 achievements (20 milestones + one per pattern) plus course achievements; pure evaluation against a built context. |
| `aimlCourse.ts` | 252 | Course pacing, stats, activity derivation, week ladder wrappers. |
| `companies.ts` | 231 | Topic-level coverage of a company's *published* patterns. Re-checks the evidence tier itself rather than trusting the generator. |
| `mlTrack.ts` | 229 | The eleven from-scratch tracks as a worked ladder, entered at the SCRATCH rung. |
| `stats.ts` | 204 | Pattern / difficulty / consistency / productivity aggregates. |
| `predictor.ts` | 148 | Forward simulation of both ladders through a shared `ladderForecast` primitive. |
| `roadmap.ts` | 121 | Day slices, `currentDay` (derived from solved count), pace, finish-date estimate with an honest denominator. |
| `timeEstimate.ts` | 107 | Personalized pace — only past `MIN_SAMPLES` (5), as a median *pace ratio*, always reporting what it was measured over. |
| `practice.ts` | 101 | Intentions registry, journal, sitting-ledger normalizers. No scoring anywhere in it. |
| `weeklyRevision.ts` | 87 | Weekly top-up toward 15–20 items, weakest-first, never padding past the floor. |
| `drills.ts` | 84 | Date-seeded recognition drills, same-pattern distractors only. |
| `planner.ts` | 79 | What a piece of work costs. Explicit constants (course session 60 m, review 10 m, ML rebuild 20 m, task 15 m) — the UI writes `~` before every total for exactly this reason. |
| `hints.ts` | 77 | The 3-rung hint ladder (notice → technique → trap), **derived** from family content, never separately authored. |
| `spacedRepetition.ts` | 75 | The one ladder: `ladderEntry` / `ladderAfterReview` / `isLadderDue`. Everything else is a wrapper. |
| `mastery.ts` | 69 | Six named mastery states; reports ladder state and hint use **side by side** rather than folding them. |
| `streak.ts` | 46 | Streaks with an `extraActiveDates` hook so other tracks can count. |
| `recommendations.ts` | 37 | Now a single deterministic picker — the file's header documents the two larger things that were **deleted rather than deprecated**, and why. |
| `miss.ts` | 36 | Four one-tap miss kinds, each mapped to an intervention the product actually has. |
| `prng.ts` | 34 | Deterministic FNV-1a-style seeded PRNG for date-stable picks. |
| `xp.ts` | 21 | 10/20/30 solve, half for revisions, `100 × n` level curve. |

### Two designs worth calling out

**`nextAction.ts` vs `session.ts` is a real distinction, not duplication.** `rankWork` answers "what is the single most valuable thing to do next"; `buildRevisionSession` answers "compose me a session that fits N minutes". The header comment states the trap being avoided: *a session is not a prefix of a to-do list.* Selection runs deepest-band-first (so the most at-risk items get the treatment that repairs them) while playback runs lightest-first (so the session opens on something achievable) — and those two orders differing **is** the design.

**`weakness.ts` is the only place weakness is claimed.** Its four stated rules — recency decay, repeated evidence, no signal above 0.24 weight, unmeasured ≠ zero — are each a defence against a specific failure. The `MIN_LIVE_EVIDENCE` floor exists because a *rate* signal divides two quantities that decay together and is therefore invariant to age: two failed recalls from last year once read bit-identical to two from this week. The fix was suppression, not re-weighting.

Signal weights (they sum to 1.00, and no one signal owns a quarter):

| Signal | Weight | Signal | Weight |
|---|---:|---|---:|
| Recall after a gap | 0.24 | Your own rating | 0.09 |
| Recognition drills | 0.22 | Time against estimate | 0.09 |
| Transfer | 0.10 | Contest stalls | 0.08 |
| Unfinished attempts | 0.10 | Hint ladder | 0.08 |

---

## 7. State & persistence

### Slices (14)

| Slice | Persisted? | Role |
|---|---|---|
| `progress` | ✅ | `byId` (sparse), `dayLogs`, `startDate` — the DSA ledger |
| `settings` | ✅ | perDay, revisionEnabled, theme, notifications, `dailyCapacityMin`, `targetCompanyId` |
| `gamification` | ✅ | xp, unlocked achievements, two bonus-gate markers |
| `course` | ✅ | `byWeekId` (sparse), incl. recall checks |
| `ml` | ✅ | track rungs + ladder, project start/ship stamps |
| `tasks` | ✅ | lightweight daily tasks |
| `drills` | ✅ | one recorded (first) attempt per date |
| `contests` | ✅ | derived stall records from finished sittings |
| `interviews` | ✅ | derived sitting records (capped) |
| `practice` | ✅ | intentions (≤3), journal (one line/date), sitting ledger (capped 60) |
| `contest` | ❌ | the **live** sitting |
| `interview` | ❌ | the **live** sitting |
| `session` | ❌ | the frozen revision plan |
| `ui` | ❌ | modal/search/focus-question state |

**The two-slice split for every performance mode is a deliberate, repeated pattern:** the live sitting is never persisted (a restored stopped clock lies about what happened), while the derived record it leaves behind is. `finishContest` banks *every conclusive* sitting including clean ones — because a channel that kept only the bad afternoons would be a sample selected for failure, and every comparison drawn from it would inherit that bias. That is a statistically literate decision, written into the type definition.

Neither interview nor contest records pay XP: performance evidence is measured, never farmed.

### Persistence

- `StorageAdapter` interface (`load()`/`save()`), one `LocalStorageAdapter` implementation, key `dsa-roadmap:v1`.
- A debounced (500 ms) middleware, with `pagehide` + `visibilitychange→hidden` flushes; `stateImported` and `progressReset` bypass the debounce and flush synchronously.
- **Quarantine before overwrite:** an unreadable-but-present payload is copied to `dsa-roadmap:v1:quarantine` (written once, never clobbered) before the app boots empty. Without this, the first debounced save of the fresh session would destroy the user's only copy.
- Schema evolution is *optional-with-boundary-default*: new `PersistedStateV1` fields are optional, `validatePersisted` echoes them only when present, and both `loadInitialState` and each slice's `stateImported` case normalize defaults in.
- The UI never touches `localStorage` — the single documented exception is `ErrorBoundary`'s backup download, which must work when the store itself has crashed.

**The invariant with teeth:** *a validator stricter than its own write path is a data-loss bug.* A value the UI can write but `validatePersisted` rejects quarantines the learner's entire state on the next load — the "15m" capacity chip did exactly that once. `persistence.test.ts` (61 tests) now round-trips every value the product's own controls can produce (`SESSION_PRESETS`, `CAPACITY_OPTIONS`, `PER_DAY_OPTIONS`, `CAPACITY_MIN`/`MAX`), so a widened control cannot silently outgrow the validator.

---

## 8. Data & content pipeline

This is the part of the repository I would point at first if asked what makes it unusual.

### The closed-world rule

`src/data/questions.json` is generated and must never be hand-edited. `scripts/generate-questions.mjs` (65 kB) resolves every title against a committed LeetCode catalog snapshot (`scripts/data/leetcode-catalog.json`, 645 kB) under a **closed-world rule**: a title must either exact-match the catalog, appear in the hand-verified `LEETCODE_ALIASES`, or be declared in `NOT_ON_LEETCODE` — anything else is a hard build failure. Linked questions carry a `url` built from the catalog's own slug, never guessed.

Result: **528 of 539 questions carry a verified external identity**; the 11 that do not are declared Educative/Grokking originals, listed by name in the validator output.

### Four generated datasets, one gate each

| Dataset | Source | The gate that makes it trustworthy |
|---|---|---|
| Questions | `SECTIONS` in the generator | Closed-world title resolution against the catalog |
| Curriculum (families, sub-patterns) | `scripts/data/curriculum.json` | Every referenced title must be a SECTIONS title or the build fails |
| Question intelligence (`type`, `tests`, `minutes`, `complexity`) | `scripts/data/question-intelligence.json` | Key set must be **exactly** the SECTIONS titles — a renamed question cannot ship without teaching content, a stale key cannot linger. Minutes are band-checked per difficulty (easy 8–20 / medium 20–35 / hard 35–60) **and** rejected if any difficulty collapses to fewer than 4 distinct values — a band with one value is the old flat constant wearing a new name. |
| Companies | `scripts/data/companies.json` | `patterns` may be non-empty **only** when `evidence === 'topics'`. Per-problem keys (`questions`, `questionIds`, `problems`, `leetcodeIds`) hard-fail the validator. |

### Content inventory (verified by reading the JSON)

| | Count | Notes |
|---|---:|---|
| Questions | 539 | 131 easy / 268 medium / 140 hard |
| Patterns | 28 | Largest: Math & Geometry 43, DP 41, Two Pointers 34, Hash Maps 32 |
| Question types | 6 | recognition 144, foundation 143, implementation 86, variant 77, optimization 60, design 29 |
| LeetCode-linked | 528 | 61 flagged premium |
| Complexity stated | 508 | absent where not confidently known |
| Problem families | 103 | 438 member links; families may reach *across* patterns (deliberate transfer links) |
| Sub-pattern groups | 108 | across 26 patterns; pattern-pure by construction |
| Company sources | 17 | 5 `topics` · 11 `categories` · 1 `avoids-puzzles` |
| Course weeks | 26 core + 5 extras | 130 recall prompts |
| ML tracks | 11 × 5 stages | 44 documented failure modes; 21.6 h total |
| ML projects | 14 across 7 tiers | 288 h; 12 with a stated baseline, 2 for the learner to establish |

### The company finding — an absence recorded as a result

The repository ran a 17-company sweep on 2026-08-13 looking for first-party pages naming concrete practice problems. Google's Tech Dev Guide — historically the one such page — is retired and 302s to a generic careers page. Exactly one source (LinkedIn, 2016, one specialist role) names any problem at all, and describes them explicitly as phone-screen warm-ups.

The conclusion is enforced in code rather than noted in a doc: the schema has nowhere to put a per-problem claim, the validator hard-fails if one appears, and `PRODUCT.md` states that **the absence is a finding, not a gap awaiting better data**. Only the 5 companies whose own pages enumerate topics can be set as a target at all.

### Re-verifiability

Two live audits exist so no dated claim can quietly rot:

- `npm run audit:links` — re-checks all 528 mappings against LeetCode (~1 min, network).
- `npm run audit:companies` — re-fetches every company source and re-checks each quote **verbatim**. It is deliberately three-valued (PASS / FAIL / **UNVERIFIABLE**) because a bot block is not evidence a page changed, and a check that cries wolf gets ignored. It caught a shipped paraphrase on its first run.

Both stay out of the test suite. **Tests are offline; live verification lives behind explicit scripts.**

---

## 9. Product rules (locked spec)

These are marked in `PRODUCT.md` as not alterable during design work, and the tests enforce them.

| Rule | Value |
|---|---|
| Revision ladder | 1 → 3 → 7 → 15 → 30 days; stage 5 = mastered (`nextRevision: null`) |
| Any fail | resets to stage 0, due tomorrow — no partial credit for ladder height |
| Solve XP | 10 / 20 / 30 by difficulty; revisions pay half |
| Bonuses | +25 daily goal (≤ once per calendar date), +50 weekly clear (≤ once per roadmap day) |
| Course XP | 20 per session, +50 per cleared week, 10 per review |
| Weekly revision day | roadmap `day % 7 === 0`; tops the queue up toward 15–20, weakest-first |
| `currentDay` | derived from solved count, never stored |
| Day slices | static id ranges |
| Capacity | one number (`settings.dailyCapacityMin`, default 180) written by three different controls |

**The plan must be finishable.** `selectRankedWork` caps new questions at `perDay - solvedToday` and withholds the course session once one is done today. Without both caps, finishing today's slice advances `currentDay`, which exposes the next day's questions, which refills the plan the instant it empties — a treadmill with no completion moment.

**The habit contract** is equally locked: no streak pressure, no guilt framing, no manufactured urgency. Overdue reasons state the schedule ("waiting 3 days past its 7-day step"), never a loss ("you're about to lose this"). Returning after two days away is met with a fresh-start notice and a plan already trimmed to capacity.

---

## 10. Surfaces

18 route components; 15 nav destinations plus two detail routes and a 404. All lazy; all mounted in `routes.test.tsx` through their real lazy boundaries.

| Route | File (lines) | What it is |
|---|---|---|
| `/` Dashboard | `DashboardPage` (421) | Day counter, streak, level ring, completion, heatmap, recommendations, the sourced epigraph |
| `/today` | `TodayPage` (156) | The hero next-action + capacity-cut plan + context rail. Three grid tracks at `xl`. |
| `/roadmap` | `RoadmapPage` (361) | Week-tile master–detail over 68 days |
| `/aiml` | `AimlCoursePage` (409) | Course syllabus (folded), recall checks, ML tracks + projects |
| `/patterns` (+ `/:id`) | 168 / 314 | 28-row multi-column index; per-pattern detail with families and sub-patterns |
| `/companies` (+ `/:id`) | `CompaniesPage` (755) | Three evidence tiers as three columns; quoted first-party sources only |
| `/revision` | `RevisionPage` (871) | The session engine's surface: length chooser → frozen plan → close + journal |
| `/drills` | `DrillsPage` (279) | Date-seeded recognition drills |
| `/interview` | `InterviewPage` (887) | 10-stage rehearsal, self-assessment, debrief against the previous sitting |
| `/contest` | `ContestPage` (518) | 4-problem timed set, honest post-contest reading |
| `/calendar` | 415 | Activity heatmap with per-day detail |
| `/analytics` | 589 | The action-dashboard insight panels + charts |
| `/achievements` | 237 | 48-achievement gallery |
| `/bookmarks` | 142 | Flagged questions |
| `/settings` | 502 | Three-column form; export / import / reset; intentions authoring |
| `/focus` | `FocusPage` (430) | **Routed outside `AppShell`** — no chrome, one item at a time, pomodoro |
| `*` | `NotFoundPage` (32) | In-shell catch-all, deliberately plate-free |

`/focus` living outside the shell is not cosmetic: it keeps the floating `PomodoroWidget` from double-mounting.

---

## 11. Design system

Direction (user-pinned, and written into `index.html` as a comment so it survives builds): **"The Course Reader"** — a warm-editorial world of lamplight near-black and oatmeal paper, deliberately refusing the neon-gradient stat-tile dashboard.

- **One ink.** Fountain blue (`--primary`) is the only accent hue. It never colors body text at midtone.
- **Three voices.** Besley slab-serif for titles and big numerals; Source Sans for all reading text; Spline Sans Mono for tabular figures. Never serif body copy, never mono prose.
- **Two first-class themes.** Dark "lamplight" default, light "reading room" via `.light` on `<html>`. Difficulty inks (sage / ochre / clay) and chart series are re-inked per theme rather than reused.
- **28 pattern inks** on one continuous warm-biased wheel, applied to icons, borders (~35% alpha) and tints (~12%) — **never to label text**.
- **Depth is hairline + warm two-part shadow**, plus one fixed SVG paper-grain layer at 4.5–6% opacity. No blur, no glow.

### The composition contract

`DESIGN.md § Composition` is mandatory for new surfaces and `src/components/layout/Page.tsx` (709 lines, ~30 exported primitives) is its implementation. The short version:

- **A plate must earn itself.** `Lead` (one per page, ever), `Plate` (genuinely liftable things), dialogs. Everything else is an open `Section` with no border and no background.
- **Figures, not stat cards.** `StatCard` was *deleted* once its last call site went, because a dead plate primitive is a re-entry point for the box problem.
- **Related facts look like one fact** — one interpunct-separated `Meta` line, with borderless chip variants inside it.
- **Three vertical steps and no others**: `gap-8 md:gap-10` between sections, `gap-4` heading→content, `gap-2`/hairline between rows.
- **Never nest a plate inside a plate.**

### Fossil classes

`.glass` renders a solid paper plate; `.text-gradient` renders solid serif text; `.bg-accent-gradient` renders a solid ink fill. The names are kept to avoid mass renames — with an explicit standing instruction never to reintroduce actual glass or gradients through them. `Card` **is** `.glass`, unified after the two primitives silently disagreed about `box-shadow` on `QuestionCard`, the most repeated surface in the product.

### The layout contract (hard-won)

`tailwind.config.js` carries a **`short:` screen** (`raw: '(max-height: 700px)'`) because the real deployment target is 1080p at 150% Windows scaling ≈ **1280×590 CSS pixels**. The recorded lesson: *a layout that only works above a height it cannot control is a layout bug.* V10 divided the viewport into fixed-height internally-scrolling panels; that collapsed into clipped scroll boxes with loud scrollbars at 590 px. V11 retired it: **`<main>` is the single scroll container, pages flow at natural height, nothing below `main` owns a scrollbar.** V12.1–12.4 then made pages *fit* by density and by spending width (master–detail, multi-column ruled grids, in-list folds) rather than by clipping.

---

## 12. Testing

**83 files, 1,176 tests.** Largest suites: `weakness` (67), `persistence` (61), `insights` (56), `interview` engine (43), `questionDetail` (39), `session` (35).

Conventions that make the suite trustworthy:

- **The clock is pinned.** `vi.useFakeTimers()` + `vi.setSystemTime('2026-07-30T12:00:00')` in `beforeEach`, real timers in `afterEach`, for any test rendering date-dependent UI. An unpinned suite passes today and fails when the wall clock moves.
- **One shared render helper** (`@/test/renderWithStore`) supplying Provider + Theme + Tooltip + MemoryRouter.
- **UI copy is asserted.** Changing user-facing strings is treated as a behavior change; weakening an assertion to make a styling change pass is explicitly forbidden.
- **`routes.test.tsx` is driven off `NAV_ITEMS`** and is the only thing that catches a broken `lazy()` import or a missing provider.
- **Fixtures spread `QF`** from `@/test/questionFixture`, so a scheduling test does not restate editorial content.
- **Tests stay offline.** Anything needing the network lives behind a script.
- Adversarial passes are kept **as tests rather than as a checklist** (`v8Adversarial.test.ts`, `contestStalls.test.ts`) — findings become permanent regression guards.

What is *not* covered: there is no automated accessibility assertion (no axe/jest-axe), no visual-regression baseline, and no performance budget assertion in CI (the bundle budget is tracked by hand in `HANDOFF.md`).

---

## 13. Build & performance

`npm run build` → 3,354 modules, 25.5 s. Chunking policy is explicit in `vite.config.ts`.

| Chunk | Raw | Gzip | Loaded when |
|---|---:|---:|---|
| `AnalyticsPage` | 435.49 kB | 122.62 kB | `/analytics` only (pulls Recharts) |
| `data-curriculum` | 386.47 kB | 92.76 kB | eagerly (selectors read `questions.json`) |
| `index` (app) | 280.77 kB | 91.33 kB | always |
| `data-ml` | 275.12 kB | 96.28 kB | `/aiml` only |
| `vendor-react` | 191.70 kB | 63.74 kB | always |
| `MarkdownPreview` | 157.26 kB | 47.66 kB | on demand (notes preview) |
| `vendor-motion` | 115.70 kB | 38.40 kB | always |
| CSS | 68.59 kB | 11.94 kB | always |
| Fonts (woff2, Latin subsets) | ~102 kB | — | always |

**First visit to `/` costs roughly 1.06 MB raw / ~270 kB gzip of JS + CSS plus ~100 kB of Latin font subsets.** That is dominated by the immutable curriculum, which is precisely why it is pinned into its own chunk: an app fix no longer invalidates the dataset in anyone's cache, and the browser fetches the two in parallel.

Two performance guards are load-bearing and easy to break:

- `src/data/mlTrackIndex.ts` restates track ids/titles/rung ids so `actions.ts`/`selectors.ts` never import the 275 kB `data-ml` chunk (`mlTracks.test.ts` proves the restatement matches the dataset).
- `src/store/analyticsSelectors.ts` isolates every selector reading `engine/insights.ts`, imported only by the lazy `/analytics` route.

Adding an import of `@/data/mlTracks`, `@/data/mlProjects` or `@/utils/engine/insights` to `selectors.ts` or `actions.ts` silently undoes both — with no error, only a larger bundle.

---

## 14. Documentation & process

115 commits over 18 days of active work, in three bursts: the original build (2026-07-30 → 08-01, 52 commits), the intelligence layer (08-12 → 08-14), and the performance/interface arc (08-14 → 08-16).

The versioned arc is legible from the log alone:

| | |
|---|---|
| v1.0 | Roadmap, ladder, dashboard, analytics, achievements, search, focus, settings |
| AI/ML track | Course as a first-class citizen of one unified activity system |
| Curriculum intelligence | Families, sub-patterns, recognition drills, question intelligence |
| V6 Practice Engine | Intentions, journal, sitting ledger, small starts, sourced reflections |
| V7 Adaptive Mastery | Miss taxonomy, hint-informed deep slot, permission to stop |
| V8 Performance Engine | Contest + interview records, ML track ladder, company preparation, gap analytics |
| V9–V12.4 | The composed interface, then the flowing application, then fit-by-composition |

Notable process traits:

- **Adversarial passes are named and committed** ("adversarial pass 1 — a data-loss bug, a double-graded ladder, and four surfaces that lied"; "V10 adversarial pass — two critical layout bugs my metric could not see"). Self-critique is part of the record.
- **Deletions are documented in place.** `recommendations.ts` keeps a header explaining what used to live there and why it was deleted rather than deprecated — "the history matters because each is a mistake that would otherwise be made again."
- **`HANDOFF.md` records what bit**, including environment-level traps (Git Bash mangling `/route` args; PowerShell text replacement causing mojibake; browser-pane tooling unavailability).
- The reflection corpus has a **test-enforced provenance rule** after a predecessor shipped two misattributions: a `quotation` must render verbatim from a source actually fetched and legally quotable, and an original `note` carries no attribution at all. `reflections.test.ts` bans the famous-name failure mode outright.

---

## 15. Strengths

1. **The engine/store/UI separation is real, not aspirational.** No React import exists anywhere in `src/utils/engine/`, and no clock read exists outside `dates.ts`. That single discipline is what makes 1,176 deterministic tests possible.
2. **Claims are evidence-gated end to end.** Personalized estimates need 5 samples and say what they were measured over. Insights return `null` below their stated minimum. Weakness needs corroboration across weighted, decaying signals. Company relevance is topic-level and first-party-quoted. This is rare rigor for a personal project.
3. **One prioritizer, one weakness model, one ladder, one time budget.** Each is explicitly guarded against a second implementation, and the docs name the two occasions a second one crept back in via *copy* rather than code.
4. **The data pipeline cannot ship silently-wrong content.** Closed-world resolution, exact-key-set intelligence, band + variety checks on estimates, and hard-failing forbidden fields are all build-time, not review-time.
5. **The type system is used properly.** `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters`. I found **zero** `as any`, `TODO`, `FIXME`, or stray `console.log` in production source (the only two `console` calls are a deliberate `console.error` in `ErrorBoundary` and a `console.warn` on quarantine).
6. **Failure modes are designed.** Quarantine before overwrite; boundary normalizers; bare-string storage for enum-ish values so a retired kind can never quarantine a payload; best-effort storage that never throws out of `load()`/`save()`.
7. **Refusals are recorded as findings.** The per-problem company question is settled *and enforced*, not deferred with a TODO.

---

## 16. Risks, gaps, and observations

Ordered by how much they would cost.

### 16.1 No CI and no linter — the quality gates are all manual

`npm test`, `npx tsc --noEmit`, `npm run build`, and `npm run validate:data` are all excellent gates, and **none of them runs automatically**. There is no `.github/`, no pre-commit hook enforcing them (the configured hooks are design-review hooks, not test hooks), and no ESLint/Prettier config at all. `CLAUDE.md` says "never commit failing tests; run the full suite before every commit" — that is a policy held in prose, enforced by memory. A single distracted commit breaks it.
**Cost if it slips:** a red `main` that nobody notices until the next session.

### 16.2 The test suite is load-sensitive

My first (contended) full run: 3 failed / 1,173 passed. My second (clean) run: 1,176 passed. The failures are timeout-shaped and at least one is the already-documented markdown-preview flake. The current mitigation is a 30 s kill ceiling, which suppresses the symptom rather than removing the race between real timers and lazy-chunk transforms in jsdom workers.
**Cost if it slips:** flake fatigue — the exact condition under which a real regression gets waved through as "probably the flake". Worth mocking `MarkdownPreview` in `questionCard.test.tsx` or driving it with fake timers.

### 16.3 The default pace is not achievable at the default capacity — by the app's own numbers

Purely arithmetic, from the shipped dataset and the shipped constants:

| Quantity | Figure |
|---|---|
| Mean authored estimate per question | 27.6 min |
| Total new-question work | 14,873 min = **247.9 h** |
| Over the default 68-day plan | **219 min/day** of new questions alone |
| Mean `revisionMinutes` (35 %, clamped 5–20) | 10.0 min |
| Full ladder for all 539 (5 passes, zero fails) | 26,820 min = **447 h** |
| Amortized across the 68 days + 56-day ladder tail | **~216 min/day** |
| **Total curriculum** | **~695 h**, ≈ **7 h/day** at the default pace |
| **Default `dailyCapacityMin`** | **180 min** |

The product handles this gracefully by design — the capacity chips cut scope, overflow is stated as `deferred` rather than hidden, and the session engine composes to a budget. But it means the "68 days" figure in `README.md` and `PRODUCT.md` describes the *slice arithmetic* (539 ÷ 8), not a schedule anyone could keep at the default capacity, and the deferral machinery will be permanently saturated. Either the framing or the default pace deserves a second look; it is the one place where the product's own honesty standard is not applied to its headline number.

### 16.4 Single point of data loss

Everything lives in one browser's `localStorage`. Quarantine protects against *corruption*, not against a cleared profile, a switched browser, or a new machine. Export is manual and un-prompted; nothing reminds the learner to take a backup, and there is no export-on-milestone. For a ~10-week daily ritual, that is the highest-consequence gap in the product. The `StorageAdapter` seam is already the correct fix (`README.md` names a Supabase adapter as the v2 plan) — but until then, a periodic "you haven't backed up in N days" nudge would be cheap and in keeping with the habit contract (it is a schedule fact, not a guilt line).

### 16.5 `/analytics` is the heaviest route in the app

435 kB raw / 122 kB gzip, larger than the app chunk itself, almost entirely Recharts. It is correctly lazy and correctly isolated behind `analyticsSelectors.ts`, so the cost is paid only by visitors to that route — but it is a meaningful cost on a phone check-in. Charting a handful of series with inline SVG (the repo already has `chartPrimitives.tsx` and a documented dot-carries-color rule) would remove the single biggest dependency in the tree.

### 16.6 Touch-target scale (documented, unresolved)

`button.tsx` ships `h-10` (40 px) default and `h-9` (36 px) small. Both clear WCAG 2.2 AA's 24×24 minimum; neither reaches the 44 px AAA/HIG figure, and `size="sm"` has ~68 call sites. Individual primary-interaction controls were raised to `min-h-11`. `HANDOFF.md` correctly classes this as a design decision awaiting a call rather than an open bug — but it is still an open question on a product with a stated phone-check-in use case.

### 16.7 Accessibility is hand-reasoned, not machine-checked

The evidence of care is everywhere (`text-muted-foreground/80` was rejected for failing AA on the light theme; `MotionConfig reducedMotion="user"`; confetti gets `disableForReducedMotion`; nav landmarks and list semantics are asserted in places). But there is no axe pass, no contrast test, and no keyboard-traversal test. Adding `jest-axe` to the existing route-mount test would cover 15 routes for roughly one file of work.

### 16.8 Documentation mass is itself a maintenance surface

~95 kB of governance prose plus ~3,000 lines of design records. It is genuinely high-quality and it is the reason the codebase is coherent — but `DESIGN.md` already contains a note that one of its own paragraphs had gone stale and would have misled anyone building from it. Prose has no type-checker. The mitigations in place (tests asserting copy, `Page.tsx` as the executable version of the composition contract) are the right shape; extending them — e.g. a test that pins the three rhythm steps or the plate-padding constants — would convert more prose into something that can fail.

### 16.9 Minor

- **Timezone:** `todayISO()` reads local midnight. A learner crossing timezones can see a day boundary shift; harmless for the use case, but undefined in the docs.
- **11 unlinked questions** (Educative/Grokking originals) have no external destination — correct per the closed-world rule, but a dead end for the learner who clicks through.
- **`estimatedTime` is authored, never learned.** `timeEstimate.ts` personalizes at *read* time and never writes back — a deliberate choice, but it means the dataset's own figures never improve.
- **Node version** is stated only in `README.md` prose ("Node 18 or newer"); there is no `engines` field or `.nvmrc`.

---

## 17. Recommended next steps

In the order I would do them.

1. **Add CI** (~1 h). A single GitHub Action running `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run validate:data` on push. Every gate already exists; nothing new needs writing. Highest value per hour available.
2. **De-flake `questionCard.test.tsx`** (~1 h). Mock `MarkdownPreview` or drive it with fake timers, then consider lowering `testTimeout` so a genuine hang fails fast instead of costing 30 s.
3. **Close the backup gap** (~half a day). A dated "last export" marker plus one quiet line on Settings/Dashboard when it is stale. Fits the habit contract exactly: it states a schedule fact, it does not manufacture urgency.
4. **Reconcile the pace headline with the workload arithmetic** (~2 h, mostly deciding). Either surface the total-hours figure honestly next to "68 days", or make the default `questionsPerDay` consistent with the default capacity.
5. **Add `jest-axe` to the route-mount test** (~2 h). Fifteen routes, one file, and it closes the only quality dimension currently asserted by hand.
6. **Add a linter** (~2 h). ESLint with `@typescript-eslint`, `react-hooks`, and `jsx-a11y`. Given `tsc` strictness and the code's consistency, expect few findings — the value is preventing the first drift, and `react-hooks/exhaustive-deps` on a codebase with this many custom hooks pays for itself.
7. **Consider replacing Recharts** (~1–2 days). Only if `/analytics` weight actually bothers the phone use case; the chart vocabulary is already narrow and centralized.
8. **v2 as already planned:** the Supabase `StorageAdapter` implementation, which the entire persistence layer was shaped around and which subsumes recommendation 3.

---

## Appendix A — Pattern inventory (roadmap order)

| # | Pattern | Qs | # | Pattern | Qs |
|---:|---|---:|---:|---|---:|
| 1 | Two Pointers | 34 | 15 | Topological Sort | 12 |
| 2 | Fast and Slow Pointers | 10 | 16 | Sort and Search | 19 |
| 3 | Sliding Window | 23 | 17 | Matrices | 20 |
| 4 | Intervals | 11 | 18 | Stacks | 20 |
| 5 | In-Place Manipulation of a Linked List | 14 | 19 | Graphs | 18 |
| 6 | Two Heaps | 12 | 20 | Tree Depth-First Search | 22 |
| 7 | K-way Merge | 7 | 21 | Tree Breadth-First Search | 14 |
| 8 | Top K Elements | 18 | 22 | Trie | 15 |
| 9 | Modified Binary Search | 24 | 23 | Hash Maps | 32 |
| 10 | Subsets | 8 | 24 | Knowing What to Track | 24 |
| 11 | Greedy Techniques | 24 | 25 | Union Find | 14 |
| 12 | Backtracking | 20 | 26 | Custom Data Structures | 16 |
| 13 | Dynamic Programming | 41 | 27 | Bitwise Manipulation | 18 |
| 14 | Cyclic Sort | 6 | 28 | Math and Geometry | 43 |

## Appendix B — Company evidence tiers

| Tier | Companies | May scope patterns? |
|---|---|---|
| `topics` (page enumerates data structures / algorithms) | Google, Meta, Microsoft, DoorDash, Roblox | ✅ — the only 5 that may be set as a target |
| `categories` (page names subject areas only) | Amazon, Databricks, Dropbox, Goldman Sachs, IBM, Snap, Salesforce, Lyft, Bloomberg, Atlassian, LinkedIn | ❌ |
| `avoids-puzzles` (page states what it does *not* ask) | Netflix | ❌ |

Every entry is a first-party page, fetched, quoted verbatim, and dated (`checkedAt`), re-verifiable via `npm run audit:companies`.

## Appendix C — Commands

```bash
npm run dev              # Vite dev server (5173; .claude/launch.json pins 5180)
npm run build            # tsc -b && vite build -> dist/
npx tsc --noEmit         # type-check only
npm test                 # full Vitest suite (must stay green)
npm run test:watch       # watch mode
npm run preview          # serve dist/ (5181)
npm run validate:data    # offline dataset validator
npm run audit:links      # LIVE LeetCode audit of all 528 mappings (network)
npm run audit:companies  # LIVE re-fetch + verbatim quote re-check (network)
node scripts/generate-questions.mjs      # the ONLY way to change src/data/questions.json
node scripts/fetch-leetcode-catalog.mjs  # refresh the catalog snapshot (network)
```

Windows repo: chain with `;` in PowerShell, not `&&`.

---

## Closing assessment

This is a solo project built to a standard most teams do not reach: a strictly layered architecture with a genuinely pure core, a content pipeline that fails the build rather than shipping an unverified claim, 1,176 deterministic tests holding both behavior and copy, and a written body of law explaining not just what the rules are but which defect each one was born from.

Its weaknesses are almost entirely in the *automation of the discipline it already practices* — no CI, no linter, no a11y assertions — rather than in the discipline itself. The one substantive product tension is that the default 8-questions-per-day pace implies roughly seven hours a day against a three-hour default budget, which the app absorbs gracefully but does not say out loud. Fixing the automation gaps is a day's work; the rest is already built.
