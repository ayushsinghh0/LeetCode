export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'unsolved' | 'in_progress' | 'solved' | 'skipped';
export type Confidence = 1 | 2 | 3 | 4 | 5;

export type PatternId =
  | 'two-pointers' | 'fast-slow-pointers' | 'sliding-window' | 'intervals'
  | 'linked-list-inplace' | 'two-heaps' | 'k-way-merge' | 'top-k-elements'
  | 'modified-binary-search' | 'subsets' | 'greedy' | 'backtracking'
  | 'dynamic-programming' | 'cyclic-sort' | 'topological-sort' | 'sort-search'
  | 'matrices' | 'stacks' | 'graphs' | 'tree-dfs' | 'tree-bfs' | 'trie'
  | 'hash-maps' | 'tracking' | 'union-find' | 'custom-data-structures'
  | 'bitwise-manipulation' | 'math-geometry';

// What kind of practice a question is — chosen by what the learner has to supply, not by
// difficulty. Six deliberately, not dozens: the label exists to help someone decide whether
// this problem is the right next thing, and a taxonomy you have to look up cannot do that.
export type QuestionType =
  | 'foundation'      // the base technique in its clearest form
  | 'recognition'     // spotting a known technique under a disguise
  | 'implementation'  // approach is obvious; the work is bookkeeping and edge cases
  | 'optimization'    // a brute force exists; the skill is beating its bound
  | 'variant'         // one changed constraint breaks the standard solution
  | 'design';         // build a structure that answers queries, not one answer

export interface Complexity {
  time: string;   // canonical Big-O of the intended solution, e.g. "O(n log n)"
  space: string;
}

export interface Question {
  id: number;
  title: string;
  pattern: PatternId;
  difficulty: Difficulty;
  // Authored per question in scripts/data/question-intelligence.json and band-checked against
  // difficulty by the generator (easy 8-20 / medium 20-35 / hard 35-60). This is the "typical
  // learner, first attempt" figure; QuestionProgress history personalizes it at read time.
  estimatedTime: number; // minutes
  type: QuestionType;
  // One sentence answering "what am I actually learning here?", shown BEFORE the attempt —
  // it names the transferable skill and deliberately stops short of the solution.
  tests: string;
  complexity?: Complexity; // intended solution's bounds; absent where not confidently known
  // Curriculum intelligence (hand-verified in scripts/data/curriculum.json, emitted by the
  // generator): the sub-pattern group within the pattern, and the problem family sharing
  // one underlying idea. Both optional — only assigned where they genuinely aid learning.
  subpattern?: string;
  familyId?: string;
  // Verified external identity, present on the 528 questions with an exact LeetCode
  // counterpart (resolved against the committed catalog snapshot by the generator —
  // see scripts/generate-questions.mjs). Absent for Educative/Grokking originals.
  url?: string;
  leetcodeId?: number;
  premium?: boolean; // LeetCode paywalled problem — link works, content needs a subscription
}

// One underlying algorithmic idea shared by several questions. `canonical` is the reference
// problem; `warmup`/`standard`/`variant`/`stretch` grade the on-ramp. `signals` are the
// statement-level cues that should trigger recognition; `trap` is the tempting wrong turn.
export type FamilyRole = 'canonical' | 'warmup' | 'standard' | 'variant' | 'stretch';

export interface ProblemFamily {
  id: string;
  pattern: PatternId;
  name: string;
  idea: string;
  signals: string[];
  trap: string;
  members: { questionId: number; role: FamilyRole }[];
}

export interface SubpatternGroup {
  id: string;
  name: string;
  questionIds: number[];
}

export interface RevisionEvent {
  date: string;
  passed: boolean;
  /**
   * V7: the learner's own one-tap read of what kind of miss this was (engine/miss.ts registry:
   * recognition | implementation | edge-case | recall). Optional always — an untagged fail
   * carries exactly the evidence it always did. Typed as a bare string and validated as one, so
   * a kind removed from the registry can never quarantine an old payload; the UI resolves
   * through the registry and skips what it cannot name. Only fail events carry it.
   */
  missKind?: string;
}

export interface QuestionProgress {
  status: QuestionStatus;
  revisionStage: number;          // 0..5; 5 = mastered
  nextRevision: string | null;    // ISO yyyy-MM-dd
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
  notes: string;                  // markdown
  bookmarked: boolean;
  completedAt: string | null;     // ISO date
  confidence: Confidence | null;
  timeSpentMin: number;
  // --- Attempt quality (optional in persisted payloads; the load boundary defaults them) ----
  // How deep into the hint ladder this question needed the learner to go: 0 = solved unaided,
  // 3 = full walkthrough. A mastery signal, never a punishment — it is what lets "solved" and
  // "solved without help" stop being the same fact.
  hintLevelUsed?: number;
  // The learner's own answer to "what did you learn?", captured at the moment of solving when
  // it is cheapest to write and most worth having later. Markdown, like `notes`.
  reflection?: string;
  // The one line the learner wrote after failing a recall — "what tripped it?" — turning a fail
  // into information rather than a verdict (design record copy rule 4). Overwritten on each fail
  // (last-write-wins) and revealed at the NEXT post-grade, never before the attempt. Optional in
  // persisted payloads; the load boundary defaults it in like reflection/hintLevelUsed.
  lastMissNote?: string;
}

export interface DayLog {
  date: string;                   // yyyy-MM-dd
  solvedIds: number[];
  revisionsPassed: number[];
  revisionsFailed: number[];
  xpEarned: number;
  focusMinutes: number;
}

export interface PatternMeta {
  id: PatternId;
  name: string;
  icon: string;                   // lucide-react icon component name
  color: string;                  // tailwind-compatible hex for charts/chips
}

export interface SettingsState {
  questionsPerDay: number;        // default 8
  revisionEnabled: boolean;       // default true
  theme: 'dark' | 'light';        // default 'dark'
  notifications: boolean;         // default false
  dailyCapacityMin: number;       // default 180 — study minutes the daily plan budgets against
  /**
   * A company the learner is preparing for, or absent when they are not preparing for one.
   *
   * Stored as a bare id and validated as a bare non-blank string: a company retired from the
   * dataset must make this setting inert, never quarantine the learner's entire state. Every
   * reader resolves it against `companyById` and falls back to "no target" when it misses.
   *
   * What it can influence is deliberately narrow. There is no per-problem company data and there
   * never will be (PRODUCT.md), so a target can only ever scope practice by the PATTERNS a
   * company's own page names — and only for the five companies whose pages enumerate any.
   */
  targetCompanyId?: string;
  /**
   * Whether Today surfaces contest-library reviews that have come due. Default true.
   *
   * It is a setting rather than a decision because the two answers are both defensible and only
   * the learner knows which is theirs: contest practice is a real second track for someone
   * working through rated problems, and pure noise for someone who never opens it.
   *
   * Note what it does NOT do. Contest work never enters `rankWork`'s ordering, the roadmap, or
   * the daily plan's counts — the plan's finishability caps are calibrated to the 539, and the
   * two universes do not merge (PRODUCT.md). The setting governs one clearly-labelled block
   * beside the day's work, nothing more.
   */
  contestOnToday?: boolean;
}

// --- Daily execution layer -------------------------------------------------------------
// Lightweight, learning-adjacent tasks (a project milestone, a follow-up email, an admin
// errand) that share the day with roadmap/course work in the Today plan. Deliberately NOT a
// project-management system: no assignees, no subtasks, no recurring rules.

export type TaskCategory = 'study' | 'project' | 'communication' | 'admin';

export interface DailyTask {
  id: string;                 // stable "t<N>" — never derived from title or date
  title: string;
  category: TaskCategory;
  date: string;               // yyyy-MM-dd the task belongs to
  done: boolean;
  completedOn: string | null; // stamped when done flips true
  estMinutes: number | null;  // explicit user estimate; null = use the plan's default
  notes: string;
}

export interface TasksState {
  byId: Record<string, DailyTask>; // sparse like every other map — reads must tolerate absence
}

// AI/ML course track (100xDevs cohort). A core week has two sessions — day 1 lecture,
// day 2 practice; optional extras use day 1 only. Dates are ISO yyyy-MM-dd, stamped when
// the session was marked done. Cleared core weeks climb the same 1/3/7/15/30 review ladder
// as questions (stage 5 = retained, nextRevision null); extras never enter the ladder.
export interface CourseWeekProgress {
  day1DoneOn: string | null;
  day2DoneOn: string | null;
  notes: string; // markdown, like QuestionProgress.notes
  revisionStage: number; // 0..5; 5 = retained
  nextRevision: string | null;
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
  // Self-test results from the "Check yourself" recall dialog, keyed by date, first-attempt-wins
  // (drills precedent). A lighter signal than a ladder review — it never moves the 1/3/7/15/30
  // ladder — but it is still retrieval, so courseRetention counts it toward "reviewed". Optional
  // in persisted payloads; the load boundary defaults it to {}.
  recallChecks?: Record<string, { correct: number; total: number }>;
}

export interface CourseState {
  byWeekId: Record<string, CourseWeekProgress>; // sparse — only touched weeks exist
}

// Recognition-drill signal: one recorded (first) attempt per calendar date. Each entry carries
// the patterns of its wrongly answered items, so every aggregate (miss ledger, weakness ranking,
// drill weighting) is derived — and can exclude "today" to keep the day's drill stable.
export interface DrillDayResult {
  correct: number;
  total: number;
  missedPatterns: string[];
}

export interface DrillsState {
  byDate: Record<string, DrillDayResult>;
}

// Contest stall evidence — the one thing a finished contest leaves behind. The live sitting
// (contestSlice) is deliberately never persisted: a restored stopped clock lies about what
// happened. What persists is the derived record `analyzeContest` produced: the patterns that
// genuinely stalled (real time in, no solution), dated so the weakness model can decay them.
// An inconclusive contest writes nothing — `analyzeContest` suppresses `patternGaps` to [] and
// that stays the single source of that decision. Keyed by date like drills: contests are seeded
// by the date, so a same-day rerun replays a set whose problems have already been seen.
export interface ContestProblemRecord {
  questionId: number;
  minutesSpent: number;
  targetMinutes: number;
  /**
   * The engine's outcome label for this problem, stored as a bare string on purpose: renaming or
   * retiring an outcome must never quarantine a learner's entire state on the next load (the
   * missKind precedent). Readers treat an unrecognised value as "no claim".
   */
  outcome: string;
}

export interface ContestStallRecord {
  /** Pattern id of every problem that stalled, deduped — one stall per pattern per sitting. */
  stalledPatterns: string[];
  /** Problems with a genuine attempt (the analysis' informative readings). */
  attempted: number;
  /** Problems in the set. */
  total: number;
  /**
   * Per-problem readings of the sitting. Optional: payloads written before V8 have none, and a
   * reader must fall back rather than assume. This is what makes timed evidence measurable —
   * without it the channel could only ever say which patterns stalled, so the only sittings it
   * described were the bad ones, and any "practice vs performance" comparison built on that would
   * be reading a sample selected for failure.
   */
  problems?: ContestProblemRecord[];
}

export interface ContestsState {
  byDate: Record<string, ContestStallRecord>;
}

// Interview evidence — what a finished sitting leaves behind. The live sitting
// (`interviewSlice`) is never persisted: an interview is a performance, and reloading into
// "stage 6, 24 minutes elapsed" would restore a rehearsal that stopped happening. The derived
// record is different: it is the only thing that lets the debrief's own promise — "compare this
// sitting with your next one" — be kept at all.
//
// Nothing here aggregates. There is no judge (PRODUCT.md), so the numbers stay separate
// dimensions the learner reported themselves, and no reader may total them into a score.
export interface InterviewSittingRecord {
  /** ISO date the sitting STARTED — a sitting that crosses midnight belongs to the evening it began. */
  date: string;
  questionId: number;
  /** 1-based stage the sitting reached, out of the ten. */
  stageReached: number;
  /**
   * The learner's own per-stage call, keyed by stage id. Both key and value are stored as bare
   * strings: renaming or retiring a stage must never quarantine a learner's whole state.
   */
  outcomes: Record<string, string>;
  /** The 1..5 self-ratings, by dimension id. Sparse — an unanswered dimension is simply absent. */
  assessment: Record<string, number>;
  minutes: number;
  hintsTaken: number;
  hintsAvailable: number;
  /**
   * What the learner expected before starting, 1..5, or null when they did not say. Optional and
   * nullable on purpose: it is the calibration half of the V7 confidence model applied to a whole
   * sitting, and an expectation nobody offered must read as absent rather than as a middling 3.
   */
  expectation?: number | null;
  /** Follow-ups the sitting actually reached. The denominator; without it a count means nothing. */
  followUpsAsked?: number;
  /** How many of them the learner said they held. Null when they rated none. */
  followUpsHeld?: number | null;
  /** The learner's own closing line. Their words, never parsed, never scored. */
  reflection?: string;
}

// --- ML implementation tracks (V8) ------------------------------------------------------------
// The eleven from-scratch tracks shipped as content with nowhere to record having done them. This
// is that record, and it is deliberately NOT courseSlice: the id spaces are different, a track's
// `weekId` is frequently null, and folding them together would make "the course" mean two things.
//
// The ladder is entered at the SCRATCH rung, not on finishing the track. Deriving the maths is
// reading; writing the thing in numpy is the first moment there is something to forget. What a
// review asks for is a rebuild from a blank file, which is why it is worth scheduling at all.
export interface MlTrackProgress {
  /** Rung id → the ISO date it was first stamped. Sparse; stamps never move once written. */
  rungs: Record<string, string>;
  revisionStage: number; // 0..5; 5 = retained, same ladder as questions and course weeks
  nextRevision: string | null;
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
}

export interface MlProjectProgress {
  startedOn: string | null;
  shippedOn: string | null;
}

export interface MlState {
  /** Sparse — only tracks the learner has touched exist. Readers must fall back. */
  tracksById: Record<string, MlTrackProgress>;
  projectsById: Record<string, MlProjectProgress>;
}

export interface InterviewsState {
  /** Most recent last. Capped — see MAX_INTERVIEW_SITTINGS. */
  sittings: InterviewSittingRecord[];
}

// --- Practice layer (V6) ---------------------------------------------------------------
// The positive-habit + reflection channel — the one place the product carries habit machinery
// rather than only measuring the practice itself. Three independent, learner-owned records, each
// optional-with-boundary-default in the persisted payload:
//
//  - intentions: up to MAX_INTENTIONS authored "After [cue], I will [action]" lines
//    (implementation intentions anchored on routines, per Keller 2021). No per-intention
//    tracking, no XP — a suggestion the learner chose, never a habit the app scores. `action` is
//    a key into engine/practice.ts's PRACTICE_ACTIONS registry (resolved to a label + deep link
//    at render; an unknown key renders nothing rather than quarantining the payload).
//  - journal: one free line per calendar date, last-write-wins (the session-close reflection).
//  - sittings: a durable ledger of revision sittings (planned vs done), capped to the most
//    recent SITTINGS_CAP — the evidence behind the sessionFollowThrough insight. `done <= planned`.
export interface PracticeIntention {
  cue: string;    // free text — "After my morning coffee"
  action: string; // key into PRACTICE_ACTIONS
}

export interface PracticeSitting {
  date: string;    // yyyy-MM-dd
  planned: number; // activities in the frozen plan
  done: number;    // activities completed this sitting (0..planned)
}

export interface PracticeState {
  intentions: PracticeIntention[];
  journal: Record<string, string>; // date -> one line
  sittings: PracticeSitting[];
}

// --- Contest library (V13) ---------------------------------------------------------------
// The second question universe: 2,561 rated contest problems, generated by
// scripts/generate-contest-library.mjs. Deliberately NOT `Question`, for three reasons that are
// each independently sufficient — `Question` requires authored `type`/`tests` whose key set the
// generator pins to exactly the 539 SECTIONS titles; `Question.pattern` is a single id where a
// contest problem needs several; and the 539 are a curated *curriculum* while this is a *pool*
// you draw from (PRODUCT.md's two-universes rule). The two never merge.

/**
 * How much the AICM pattern classification can be trusted for one problem.
 *
 * `unmapped` is a shipped, populated state (244 of the 2,561), not a failure: a problem whose
 * only LeetCode tags are "Array, Enumeration" has no honest AICM pattern, and the product's
 * standing rule is that silence beats invented metadata. Only `exact` and `strong` may satisfy a
 * pattern filter or contribute evidence to the weakness model; `heuristic` is shown as inferred
 * and is evidentially inert.
 */
export type MappingConfidence = 'exact' | 'strong' | 'heuristic' | 'unmapped';

export interface RatingBand {
  id: string;
  label: string;
  min: number;
  max: number;
}

export interface ContestLibraryProblem {
  /**
   * THE identity. Not the numeric id, and this is load-bearing: ZeroTrac's `ID` is LeetCode's
   * FRONTEND question id while the committed catalog stores the INTERNAL `question_id`, and
   * measured 2026-08-19 those differ for 2561/2561 records. Every join in the pipeline is on the
   * slug; the numbers are display-only.
   */
  slug: string;
  /** The number LeetCode shows the user. Two independent sources agree on it. Display only. */
  frontendId: number;
  title: string;
  /** Built from the slug, never from the title. */
  url: string;
  officialDifficulty: Difficulty;
  /**
   * ZeroTrac's ESTIMATED contest difficulty — never called `officialRating`, and never presented
   * as one. It is a separate signal from `officialDifficulty`, not a replacement for it: a
   * surface shows "Medium · Contest rating 1648", never "Medium = 1648".
   */
  contestRating: number;
  contest: {
    slug: string;
    type: 'weekly' | 'biweekly' | 'unknown';
    number: number | null;
    /** 1-based position. Usually 1–4; Weekly Contest 68 ran five, so 5 is legal. */
    index: number;
  };
  /** LeetCode's own taxonomy, verbatim. NOT AICM patterns — the two are different systems. */
  leetcodeTopics: string[];
  /** Filterable, weakness-eligible patterns (exact/strong only). May be empty. */
  aicmPatterns: PatternId[];
  /** Defensible but too-broad associations. Shown as inferred; never filtered on. */
  inferredPatterns: PatternId[];
  /** Only ever populated for the 207 curriculum-bridged problems — tags cannot imply these. */
  aicmSubpatterns: string[];
  mappingConfidence: MappingConfidence;
  premium: boolean;
  /** The identity bridge: non-null when this problem IS one of the 539. Never a second copy. */
  curriculumQuestionId: number | null;
}

/**
 * What the learner has done with one contest-library problem.
 *
 * Keyed by SLUG in `ContestLibraryState`, never by number — `progress.byId` is keyed by roadmap
 * ids 1–539 while LeetCode's ids run past 4,000, so a shared numeric key space would have let a
 * contest solve overwrite a curriculum question. The slug removes the collision by removing the
 * number.
 *
 * The ladder fields are the SAME 1/3/7/15/30 ladder questions and course weeks climb
 * (engine/spacedRepetition.ts). This is a second register on one scheduler, not a second
 * scheduler — Contest Revision had to leave the existing ladder untouched, and reusing it is how.
 */
export interface ContestProblemProgress {
  solved: boolean;
  /** Every recorded attempt, solved or not. A count, never a penalty. */
  attempts: number;
  lastAttemptedOn: string | null;
  /** First solve. Re-solving for practice does not move it, and does not restart the ladder. */
  solvedOn: string | null;
  revisionStage: number; // 0..5; 5 = mastered
  nextRevision: string | null;
  lastReviewed: string | null;
  revisionHistory: RevisionEvent[];
}

export interface ContestLibraryState {
  /** Sparse — only problems the learner has touched exist. Readers must fall back. */
  bySlug: Record<string, ContestProblemProgress>;
}

export interface PersistedStateV1 {
  version: 1;
  progress: {
    byId: Record<number, QuestionProgress>;
    dayLogs: Record<string, DayLog>;
    startDate: string | null;
  };
  // dailyCapacityMin is optional in persisted payloads (predates the daily plan; the load
  // boundary defaults it to 180) but always present in the live store.
  settings: Omit<SettingsState, 'dailyCapacityMin'> & { dailyCapacityMin?: number };
  // unlocked: achievementId -> ISO date. The two bonus markers gate the daily-goal (+25) and
  // weekly-clear (+50) bonuses to once per day / once per roadmap week; optional so payloads
  // saved before they shipped keep validating (absent -> null).
  gamification: {
    xp: number;
    unlocked: Record<string, string>;
    dailyGoalBonusDate?: string | null;   // ISO date the +25 daily bonus last fired
    weeklyClearBonusDay?: number | null;  // roadmap day the +50 weekly bonus last fired
  };
  // Optional so pre-course backups (and older stored payloads) keep validating/loading.
  course?: CourseState;
  // Optional for the same reason — payloads saved before the daily execution layer shipped.
  tasks?: TasksState;
  // Optional for the same reason — payloads saved before recognition drills recorded results.
  drills?: DrillsState;
  // Optional for the same reason — payloads saved before contest stalls were recorded.
  contests?: ContestsState;
  // Optional for the same reason — payloads saved before interview sittings were recorded.
  interviews?: InterviewsState;
  // Optional for the same reason — payloads saved before the ML tracks could be worked through.
  ml?: MlState;
  // Optional for the same reason — payloads saved before the practice layer (V6) shipped.
  practice?: PracticeState;
  // Optional for the same reason — payloads saved before the contest library (V13) shipped.
  contestLibrary?: ContestLibraryState;
}
