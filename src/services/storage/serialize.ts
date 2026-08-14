import type {
  Confidence,
  ContestProblemRecord,
  ContestStallRecord,
  CourseWeekProgress,
  DailyTask,
  DayLog,
  InterviewSittingRecord,
  PersistedStateV1,
  PracticeIntention,
  PracticeSitting,
  QuestionProgress,
  QuestionStatus,
  RevisionEvent,
  TaskCategory,
} from '@/types';
import type { RootState } from '@/store/store';
import { MASTERED_STAGE } from '@/utils/engine/spacedRepetition';
import { MAX_HINT_LEVEL } from '@/utils/engine/hints';
import { CAPACITY_MAX, CAPACITY_MIN } from '@/utils/engine/planner';

// Projects the persistable slices (progress, settings, gamification, course) out of RootState.
// `ui` is deliberately excluded — it holds only ephemeral session state (celebration, toast
// queue, search-open flag) that PersistedStateV1 has no room for and that should not survive a
// reload. `course` is written only once it holds progress: untouched-course payloads stay
// byte-identical to pre-course ones, so nothing changes for users (or fixtures) that never
// touched the AI/ML track.
export function selectPersistedState(root: RootState): PersistedStateV1 {
  const courseByWeekId = root.course.byWeekId;
  const tasksById = root.tasks.byId;
  const drillDates = root.drills.byDate;
  const contestDates = root.contests.byDate;
  const interviewSittings = root.interviews.sittings;
  const practice = root.practice;
  return {
    version: 1,
    progress: {
      byId: root.progress.byId,
      dayLogs: root.progress.dayLogs,
      startDate: root.progress.startDate,
    },
    settings: { ...root.settings },
    gamification: { ...root.gamification },
    ...(Object.keys(courseByWeekId).length > 0 ? { course: { byWeekId: courseByWeekId } } : {}),
    // Same written-only-once-touched rule as `course`: payloads from users who never created a
    // task stay byte-identical to pre-tasks ones.
    ...(Object.keys(tasksById).length > 0 ? { tasks: { byId: tasksById } } : {}),
    ...(Object.keys(drillDates).length > 0 ? { drills: { byDate: drillDates } } : {}),
    // Note this is `contests` (persisted stall records), never `contest` (the live sitting) —
    // a restored stopped clock lies, so only the derived evidence survives a reload.
    ...(Object.keys(contestDates).length > 0 ? { contests: { byDate: contestDates } } : {}),
    // Note this is `interviews` (the finished sittings' derived records), never `interview` (the
    // live sitting) — an interview is a performance, and a restored one would be a fiction.
    ...(interviewSittings.length > 0 ? { interviews: { sittings: interviewSittings } } : {}),
    // Same written-only-once-touched rule: a learner who set no intention, wrote no journal line
    // and ran no sitting produces a payload byte-identical to a pre-practice-layer one.
    ...(practice.intentions.length > 0 ||
    Object.keys(practice.journal).length > 0 ||
    practice.sittings.length > 0
      ? {
          practice: {
            intentions: practice.intentions,
            journal: practice.journal,
            sittings: practice.sittings,
          },
        }
      : {}),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The whole engine compares dates as `yyyy-MM-dd` strings with <= — a date in any other shape
// ("2026-1-5", "tomorrow", an ISO timestamp) would pass a typeof check but silently break every
// due/streak/forecast computation, so date fields are validated against the exact format.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

// xpEarned, focusMinutes, timeSpentMin, xp — counters that must be real non-negative numbers
// (NaN/Infinity would poison every sum they feed).
function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// Ladder stage: an integer within 0..MASTERED_STAGE. `stage >= 5` means mastered and the
// interval table is indexed by stage, so NaN / -1 / 1e9 must all be rejected.
function isRevisionStage(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MASTERED_STAGE;
}

// Hint ladder depth: 0 (unaided) .. MAX_HINT_LEVEL (full walkthrough). It indexes the derived
// hint list and feeds mastery quality, so a float or an out-of-range number must be rejected.
function isHintLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_HINT_LEVEL;
}

function isQuestionStatus(value: unknown): value is QuestionStatus {
  return value === 'unsolved' || value === 'in_progress' || value === 'solved' || value === 'skipped';
}

function isConfidence(value: unknown): value is Confidence | null {
  return value === null || (typeof value === 'number' && [1, 2, 3, 4, 5].includes(value));
}

function isRevisionEventArray(value: unknown): value is RevisionEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (ev) =>
        isPlainObject(ev) &&
        isIsoDate(ev.date) &&
        typeof ev.passed === 'boolean' &&
        // V7 miss kind: optional, and deliberately validated as a bare string — the registry is
        // a UI concern, so removing a kind there can never quarantine an old payload here.
        (!('missKind' in ev) || typeof ev.missKind === 'string'),
    )
  );
}

/** Rebuild one event with exactly the known fields — copy-when-present for the optional kind. */
function copyRevisionEvent(ev: RevisionEvent): RevisionEvent {
  return { date: ev.date, passed: ev.passed, ...('missKind' in ev ? { missKind: ev.missKind } : {}) };
}

function isIdArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isInteger(v));
}

// Per-entry shape check for progress.byId[id] — every field of QuestionProgress, not just "is it
// an object". A backup file that survives JSON.parse but has e.g. a string revisionStage or a
// non-array revisionHistory must still be rejected wholesale rather than handed to the store,
// where untyped/malformed data would silently corrupt selectors and engine math downstream.
function isValidProgressEntry(value: unknown): value is QuestionProgress {
  if (!isPlainObject(value)) return false;
  return (
    isQuestionStatus(value.status) &&
    isRevisionStage(value.revisionStage) &&
    isNullableIsoDate(value.nextRevision) &&
    isNullableIsoDate(value.lastReviewed) &&
    isRevisionEventArray(value.revisionHistory) &&
    typeof value.notes === 'string' &&
    typeof value.bookmarked === 'boolean' &&
    isNullableIsoDate(value.completedAt) &&
    isConfidence(value.confidence) &&
    isNonNegativeNumber(value.timeSpentMin) &&
    // Attempt-quality fields shipped after the original shape — optional-when-absent (pre-hint
    // payloads must keep loading; the load boundary normalizes them in) but strict when present.
    (!('hintLevelUsed' in value) || isHintLevel(value.hintLevelUsed)) &&
    (!('reflection' in value) || typeof value.reflection === 'string') &&
    (!('lastMissNote' in value) || typeof value.lastMissNote === 'string')
  );
}

// Recall-check map (wave F): date -> {correct, total}, correct in [0, total], total a real count.
// Same shape rules as the drills channel; keyed by ISO date because first-attempt-per-date is the
// signal. An empty map is valid (a touched week that has never been self-tested carries {}).
function isRecallCheckMap(value: unknown): value is Record<string, { correct: number; total: number }> {
  if (!isPlainObject(value)) return false;
  for (const [date, entry] of Object.entries(value)) {
    if (!isIsoDate(date)) return false;
    if (!isPlainObject(entry)) return false;
    const { correct, total } = entry;
    if (typeof total !== 'number' || !Number.isInteger(total) || total < 1) return false;
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct > total) return false;
  }
  return true;
}

// Per-entry shape check for course.byWeekId[weekId]. The review-ladder fields shipped one
// release after the day stamps, so they are optional-when-absent (pre-ladder payloads must
// keep loading; loadInitialState/stateImported normalize them in) but strictly typed when
// present. recallChecks (wave F) follows the same optional-when-absent rule.
function isValidCourseEntry(value: unknown): value is CourseWeekProgress {
  if (!isPlainObject(value)) return false;
  return (
    isNullableIsoDate(value.day1DoneOn) &&
    isNullableIsoDate(value.day2DoneOn) &&
    typeof value.notes === 'string' &&
    (!('revisionStage' in value) || isRevisionStage(value.revisionStage)) &&
    (!('nextRevision' in value) || isNullableIsoDate(value.nextRevision)) &&
    (!('lastReviewed' in value) || isNullableIsoDate(value.lastReviewed)) &&
    (!('revisionHistory' in value) || isRevisionEventArray(value.revisionHistory)) &&
    (!('recallChecks' in value) || isRecallCheckMap(value.recallChecks))
  );
}

function isTaskCategory(value: unknown): value is TaskCategory {
  return value === 'study' || value === 'project' || value === 'communication' || value === 'admin';
}

// Per-entry shape check for tasks.byId[id] — the daily execution layer's persisted unit.
function isValidTaskEntry(value: unknown): value is DailyTask {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.title === 'string' &&
    value.title.trim() !== '' &&
    isTaskCategory(value.category) &&
    isIsoDate(value.date) &&
    typeof value.done === 'boolean' &&
    (value.completedOn === null || isIsoDate(value.completedOn)) &&
    (value.estMinutes === null ||
      (typeof value.estMinutes === 'number' && Number.isInteger(value.estMinutes) && value.estMinutes > 0)) &&
    typeof value.notes === 'string'
  );
}

// Per-entry shape check for progress.dayLogs[date] — in particular that solvedIds/revisionsPassed/
// revisionsFailed are actually arrays of numbers, not just "present".
function isValidDayLogEntry(value: unknown): value is DayLog {
  if (!isPlainObject(value)) return false;
  return (
    isIsoDate(value.date) &&
    isIdArray(value.solvedIds) &&
    isIdArray(value.revisionsPassed) &&
    isIdArray(value.revisionsFailed) &&
    isNonNegativeNumber(value.xpEarned) &&
    isNonNegativeNumber(value.focusMinutes)
  );
}

// Structural validation only — this is the single source of truth for "is this safe to load as
// a PersistedStateV1". Both LocalStorageAdapter.load() and any future adapter (including the
// Settings page's import-from-file flow, where genuinely untrusted JSON reaches this function)
// must route their parsed/fetched data through here before handing it to the store. Validation
// goes deeper than top-level key presence: every entry inside progress.byId and progress.dayLogs
// is checked against its full expected shape — including domain ranges (revisionStage 0..5) and
// exact yyyy-MM-dd date formats — so a malformed-but-version-1 file is rejected wholesale rather
// than partially accepted. The return value is rebuilt field-by-field from the validated input
// (never a cast of the raw object), so unknown extra keys are dropped instead of smuggled into
// the store.
export function validatePersisted(raw: unknown): PersistedStateV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== 1) return null;

  const progress = raw.progress;
  if (!isPlainObject(progress)) return null;
  if (!isPlainObject(progress.byId)) return null;
  const byId: Record<number, QuestionProgress> = {};
  for (const [key, entry] of Object.entries(progress.byId)) {
    const id = Number(key);
    if (!Number.isInteger(id)) return null;
    if (!isValidProgressEntry(entry)) return null;
    byId[id] = {
      status: entry.status,
      revisionStage: entry.revisionStage,
      nextRevision: entry.nextRevision,
      lastReviewed: entry.lastReviewed,
      revisionHistory: entry.revisionHistory.map(copyRevisionEvent),
      notes: entry.notes,
      bookmarked: entry.bookmarked,
      completedAt: entry.completedAt,
      confidence: entry.confidence,
      timeSpentMin: entry.timeSpentMin,
      // Copied only when present — writing `field: undefined` would later override
      // normalizeQuestionProgress's spread defaults (same rule as the course ladder fields).
      ...('hintLevelUsed' in entry ? { hintLevelUsed: entry.hintLevelUsed } : {}),
      ...('reflection' in entry ? { reflection: entry.reflection } : {}),
      ...('lastMissNote' in entry ? { lastMissNote: entry.lastMissNote } : {}),
    };
  }
  if (!isPlainObject(progress.dayLogs)) return null;
  const dayLogs: Record<string, DayLog> = {};
  for (const [date, entry] of Object.entries(progress.dayLogs)) {
    if (!isIsoDate(date)) return null;
    if (!isValidDayLogEntry(entry)) return null;
    dayLogs[date] = {
      date: entry.date,
      solvedIds: [...entry.solvedIds],
      revisionsPassed: [...entry.revisionsPassed],
      revisionsFailed: [...entry.revisionsFailed],
      xpEarned: entry.xpEarned,
      focusMinutes: entry.focusMinutes,
    };
  }
  if (!('startDate' in progress) || !isNullableIsoDate(progress.startDate)) return null;

  const settings = raw.settings;
  if (!isPlainObject(settings)) return null;
  if (typeof settings.questionsPerDay !== 'number' || !Number.isInteger(settings.questionsPerDay) || settings.questionsPerDay < 1) {
    return null;
  }
  if (typeof settings.revisionEnabled !== 'boolean') return null;
  if (settings.theme !== 'dark' && settings.theme !== 'light') return null;
  if (typeof settings.notifications !== 'boolean') return null;
  // Optional (predates the daily plan); when present it must be a sane study budget. The bounds
  // are CAPACITY_MIN/CAPACITY_MAX from store/actions.ts, and they must stay in lockstep: this
  // validator once floored at 30 while the Today and Revision chips wrote 15, so tapping the
  // smallest chip quarantined the learner's entire state on the next load. A validator stricter
  // than the UI is a data-loss bug.
  const capacity = settings.dailyCapacityMin;
  if ('dailyCapacityMin' in settings && capacity !== undefined) {
    if (
      typeof capacity !== 'number' ||
      !Number.isInteger(capacity) ||
      capacity < CAPACITY_MIN ||
      capacity > CAPACITY_MAX
    ) {
      return null;
    }
  }

  const gamification = raw.gamification;
  if (!isPlainObject(gamification)) return null;
  if (!isNonNegativeNumber(gamification.xp)) return null;
  if (!isPlainObject(gamification.unlocked)) return null;
  if (!Object.values(gamification.unlocked).every((v) => typeof v === 'string')) return null;
  // Bonus gates are optional (absent in payloads saved before they shipped).
  if ('dailyGoalBonusDate' in gamification && gamification.dailyGoalBonusDate !== undefined && !isNullableIsoDate(gamification.dailyGoalBonusDate)) {
    return null;
  }
  const weeklyDay = gamification.weeklyClearBonusDay;
  if ('weeklyClearBonusDay' in gamification && weeklyDay !== undefined && weeklyDay !== null && !(typeof weeklyDay === 'number' && Number.isInteger(weeklyDay) && weeklyDay >= 0)) {
    return null;
  }

  // `tasks` is optional (absent in pre-daily-plan payloads) — reject-wholesale when malformed,
  // and each entry's key must equal its own id (the map invariant every reader assumes).
  let tasks: PersistedStateV1['tasks'];
  if ('tasks' in raw && raw.tasks !== undefined) {
    const rawTasks = raw.tasks;
    if (!isPlainObject(rawTasks)) return null;
    if (!isPlainObject(rawTasks.byId)) return null;
    const byId: Record<string, DailyTask> = {};
    for (const [key, entry] of Object.entries(rawTasks.byId)) {
      if (!isValidTaskEntry(entry)) return null;
      if (entry.id !== key) return null;
      byId[key] = {
        id: entry.id,
        title: entry.title,
        category: entry.category,
        date: entry.date,
        done: entry.done,
        completedOn: entry.completedOn,
        estMinutes: entry.estMinutes,
        notes: entry.notes,
      };
    }
    tasks = { byId };
  }

  // `drills` is optional (absent before recognition drills recorded results) — reject-wholesale
  // when malformed: date keys must be real ISO dates, counters real non-negative integers with
  // correct <= total, and missedPatterns a string array (it feeds weakness ranking, and its
  // length can't exceed the misses that actually happened).
  let drills: PersistedStateV1['drills'];
  if ('drills' in raw && raw.drills !== undefined) {
    const rawDrills = raw.drills;
    if (!isPlainObject(rawDrills)) return null;
    if (!isPlainObject(rawDrills.byDate)) return null;
    const byDate: Record<string, { correct: number; total: number; missedPatterns: string[] }> = {};
    for (const [date, entry] of Object.entries(rawDrills.byDate)) {
      if (!isIsoDate(date)) return null;
      if (!isPlainObject(entry)) return null;
      const { correct, total, missedPatterns } = entry;
      if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0) return null;
      if (typeof total !== 'number' || !Number.isInteger(total) || total < 1) return null;
      if (correct > total) return null;
      if (!Array.isArray(missedPatterns) || missedPatterns.some((p) => typeof p !== 'string' || p === '')) return null;
      if (missedPatterns.length > total - correct) return null;
      byDate[date] = { correct, total, missedPatterns: [...missedPatterns] };
    }
    drills = { byDate };
  }

  // `contests` is optional (absent before contest stalls were recorded) — reject-wholesale when
  // malformed: date keys must be real ISO dates (the weakness model decays on them), counters
  // real positive integers with attempted <= total, and stalledPatterns an array of non-blank,
  // DEDUPED pattern ids no longer than the attempts behind it. The dedupe check is not stricter
  // than the write path — analyzeContest dedupes and finishContest re-dedupes — and it matters
  // because a duplicate here would double-count a single sitting in the weakness model.
  //
  // `stalledPatterns` may be EMPTY since V8: a conclusive sitting where nothing stalled is real
  // evidence about timed performance and now banks a record too. Widening what the validator
  // admits is always safe (every payload that validated before still does); the reverse — a
  // validator stricter than its write path — is the data-loss bug this file exists to avoid.
  //
  // `problems` is optional and deliberately LENIENT: `outcome` is only checked for being a
  // non-blank string, never against the engine's Outcome union, so retiring an outcome later can
  // never quarantine an old payload.
  let contests: PersistedStateV1['contests'];
  if ('contests' in raw && raw.contests !== undefined) {
    const rawContests = raw.contests;
    if (!isPlainObject(rawContests)) return null;
    if (!isPlainObject(rawContests.byDate)) return null;
    const byDate: Record<string, ContestStallRecord> = {};
    for (const [date, entry] of Object.entries(rawContests.byDate)) {
      if (!isIsoDate(date)) return null;
      if (!isPlainObject(entry)) return null;
      const { stalledPatterns, attempted, total, problems } = entry;
      if (typeof attempted !== 'number' || !Number.isInteger(attempted) || attempted < 1) return null;
      if (typeof total !== 'number' || !Number.isInteger(total) || total < 1) return null;
      if (attempted > total) return null;
      if (!Array.isArray(stalledPatterns)) return null;
      if (stalledPatterns.some((p) => typeof p !== 'string' || p === '')) return null;
      if (new Set(stalledPatterns).size !== stalledPatterns.length) return null;
      if (stalledPatterns.length > attempted) return null;

      let problemRecords: ContestProblemRecord[] | undefined;
      if (problems !== undefined) {
        if (!Array.isArray(problems)) return null;
        if (problems.length > total) return null;
        const parsed: ContestProblemRecord[] = [];
        for (const problem of problems) {
          if (!isPlainObject(problem)) return null;
          const { questionId, minutesSpent, targetMinutes, outcome } = problem;
          if (typeof questionId !== 'number' || !Number.isInteger(questionId) || questionId < 1) {
            return null;
          }
          if (typeof minutesSpent !== 'number' || !Number.isInteger(minutesSpent) || minutesSpent < 0) {
            return null;
          }
          if (typeof targetMinutes !== 'number' || !Number.isInteger(targetMinutes) || targetMinutes < 1) {
            return null;
          }
          if (typeof outcome !== 'string' || outcome === '') return null;
          parsed.push({ questionId, minutesSpent, targetMinutes, outcome });
        }
        problemRecords = parsed;
      }

      byDate[date] = {
        stalledPatterns: [...stalledPatterns],
        attempted,
        total,
        ...(problemRecords ? { problems: problemRecords } : {}),
      };
    }
    contests = { byDate };
  }

  // `interviews` is optional (absent before interview sittings were recorded) — reject-wholesale
  // when malformed, but deliberately LENIENT about vocabulary: stage ids, stage outcomes and
  // self-assessment dimension ids are only checked for being non-blank strings, never against the
  // engine's unions, so renaming or retiring a stage can never quarantine a learner's whole state
  // (the missKind precedent). Numbers are range-checked, because those ranges are what the copy
  // means: a 7 in a 1..5 self-report would silently change what every comparison says.
  let interviews: PersistedStateV1['interviews'];
  if ('interviews' in raw && raw.interviews !== undefined) {
    const rawInterviews = raw.interviews;
    if (!isPlainObject(rawInterviews)) return null;
    if (!Array.isArray(rawInterviews.sittings)) return null;
    const sittings: InterviewSittingRecord[] = [];
    for (const entry of rawInterviews.sittings) {
      if (!isPlainObject(entry)) return null;
      const { date, questionId, stageReached, outcomes, assessment, minutes, hintsTaken, hintsAvailable } =
        entry;
      if (!isIsoDate(date)) return null;
      if (typeof questionId !== 'number' || !Number.isInteger(questionId) || questionId < 1) return null;
      if (typeof stageReached !== 'number' || !Number.isInteger(stageReached) || stageReached < 1) {
        return null;
      }
      if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0) return null;
      if (typeof hintsTaken !== 'number' || !Number.isInteger(hintsTaken) || hintsTaken < 0) return null;
      if (
        typeof hintsAvailable !== 'number' ||
        !Number.isInteger(hintsAvailable) ||
        hintsAvailable < 0
      ) {
        return null;
      }
      if (hintsTaken > hintsAvailable) return null;
      if (!isPlainObject(outcomes)) return null;
      const parsedOutcomes: Record<string, string> = {};
      for (const [stageId, outcome] of Object.entries(outcomes)) {
        if (stageId === '' || typeof outcome !== 'string' || outcome === '') return null;
        parsedOutcomes[stageId] = outcome;
      }
      if (!isPlainObject(assessment)) return null;
      const parsedAssessment: Record<string, number> = {};
      for (const [dimension, value] of Object.entries(assessment)) {
        if (dimension === '') return null;
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) return null;
        parsedAssessment[dimension] = value;
      }
      sittings.push({
        date,
        questionId,
        stageReached,
        outcomes: parsedOutcomes,
        assessment: parsedAssessment,
        minutes,
        hintsTaken,
        hintsAvailable,
      });
    }
    interviews = { sittings };
  }

  // `practice` is optional (absent before the V6 practice layer) — reject-wholesale when
  // malformed. Deliberately LENIENT where the write path is: `action` is only checked for being a
  // non-blank string, NOT against the PRACTICE_ACTIONS registry, so removing an action key later
  // can never quarantine an old payload (the Today rail skips an unknown key at render instead);
  // and neither the intention count nor the sitting count is upper-bounded here, because a
  // validator stricter than its own controls is a data-loss bug — the write path caps both, and
  // admitting a hand-imported over-count is harmless where rejecting it destroys the whole state.
  let practice: PersistedStateV1['practice'];
  if ('practice' in raw && raw.practice !== undefined) {
    const rawPractice = raw.practice;
    if (!isPlainObject(rawPractice)) return null;
    if (!Array.isArray(rawPractice.intentions)) return null;
    if (!isPlainObject(rawPractice.journal)) return null;
    if (!Array.isArray(rawPractice.sittings)) return null;

    const intentions: PracticeIntention[] = [];
    for (const entry of rawPractice.intentions) {
      if (!isPlainObject(entry)) return null;
      if (typeof entry.cue !== 'string' || entry.cue.trim() === '') return null;
      if (typeof entry.action !== 'string' || entry.action === '') return null;
      intentions.push({ cue: entry.cue, action: entry.action });
    }

    const journal: Record<string, string> = {};
    for (const [date, line] of Object.entries(rawPractice.journal)) {
      if (!isIsoDate(date)) return null;
      if (typeof line !== 'string' || line === '') return null;
      journal[date] = line;
    }

    const sittings: PracticeSitting[] = [];
    for (const entry of rawPractice.sittings) {
      if (!isPlainObject(entry)) return null;
      if (!isIsoDate(entry.date)) return null;
      const { planned, done } = entry;
      if (typeof planned !== 'number' || !Number.isInteger(planned) || planned < 0) return null;
      if (typeof done !== 'number' || !Number.isInteger(done) || done < 0 || done > planned) return null;
      sittings.push({ date: entry.date, planned, done });
    }

    practice = { intentions, journal, sittings };
  }

  // `course` is optional (absent in pre-course payloads) — but when present it must be fully
  // well-formed, same reject-wholesale rule as every other section.
  let course: PersistedStateV1['course'];
  if ('course' in raw && raw.course !== undefined) {
    const rawCourse = raw.course;
    if (!isPlainObject(rawCourse)) return null;
    if (!isPlainObject(rawCourse.byWeekId)) return null;
    const byWeekId: Record<string, CourseWeekProgress> = {};
    for (const [weekId, entry] of Object.entries(rawCourse.byWeekId)) {
      if (!isValidCourseEntry(entry)) return null;
      // Ladder fields may be genuinely absent in pre-ladder payloads — they must stay absent
      // here (writing `field: undefined` would later override normalizeCourseWeekProgress's
      // spread defaults), so each is copied only when present. The cast is safe: presence and
      // types were just validated, and the load boundary normalizes the gaps in.
      byWeekId[weekId] = {
        day1DoneOn: entry.day1DoneOn,
        day2DoneOn: entry.day2DoneOn,
        notes: entry.notes,
        ...('revisionStage' in entry ? { revisionStage: entry.revisionStage } : {}),
        ...('nextRevision' in entry ? { nextRevision: entry.nextRevision } : {}),
        ...('lastReviewed' in entry ? { lastReviewed: entry.lastReviewed } : {}),
        ...('revisionHistory' in entry
          ? { revisionHistory: entry.revisionHistory.map(copyRevisionEvent) }
          : {}),
        ...('recallChecks' in entry
          ? {
              recallChecks: Object.fromEntries(
                Object.entries(entry.recallChecks as Record<string, { correct: number; total: number }>).map(
                  ([d, c]) => [d, { correct: c.correct, total: c.total }],
                ),
              ),
            }
          : {}),
      } as CourseWeekProgress;
    }
    course = { byWeekId };
  }

  return {
    version: 1,
    progress: {
      byId,
      dayLogs,
      startDate: progress.startDate as string | null,
    },
    settings: {
      questionsPerDay: settings.questionsPerDay,
      revisionEnabled: settings.revisionEnabled,
      theme: settings.theme,
      notifications: settings.notifications,
      // Echoed only when the payload carried it — same input-shape-preserving rule as the
      // gamification bonus gates below; the load boundary defaults it.
      ...('dailyCapacityMin' in settings && capacity !== undefined ? { dailyCapacityMin: capacity as number } : {}),
    },
    // Bonus gates are echoed only when the payload carried them — validation preserves the
    // input shape; defaulting absent fields to null is the load boundary's job
    // (loadInitialState / the gamification slice's stateImported case).
    gamification: {
      xp: gamification.xp,
      unlocked: { ...(gamification.unlocked as Record<string, string>) },
      ...('dailyGoalBonusDate' in gamification && gamification.dailyGoalBonusDate !== undefined
        ? { dailyGoalBonusDate: gamification.dailyGoalBonusDate as string | null }
        : {}),
      ...('weeklyClearBonusDay' in gamification && weeklyDay !== undefined
        ? { weeklyClearBonusDay: weeklyDay as number | null }
        : {}),
    },
    ...(course ? { course } : {}),
    ...(tasks ? { tasks } : {}),
    ...(drills ? { drills } : {}),
    ...(contests ? { contests } : {}),
    ...(interviews ? { interviews } : {}),
    ...(practice ? { practice } : {}),
  };
}

export function exportAsJson(root: RootState): string {
  return JSON.stringify(selectPersistedState(root), null, 2);
}
