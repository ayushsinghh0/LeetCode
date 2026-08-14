// Every selector here is a thin, memoized wrapper around the pure engine layer — no engine
// logic is reimplemented. Selectors never read the system clock: any that need "today" take it
// as an explicit second argument, `(state, today)`, so results stay deterministic and
// memoizable. Call sites (UI, thunks) supply `todayISO()` themselves.
import { createSelector } from '@reduxjs/toolkit';
import questionsData from '@/data/questions.json';
import type {
  DayLog,
  InterviewSittingRecord,
  PatternId,
  Question,
  QuestionProgress,
} from '@/types';
import type { RootState } from '@/store/store';
import { PATTERNS } from '@/data/patterns';
import { addDays, diffDays } from '@/utils/dates';
import { dueIds, REVISION_INTERVALS } from '@/utils/engine/spacedRepetition';
import { estimateFor, paceSamples, plannedMinutes } from '@/utils/engine/timeEstimate';
import { DRILL_MIN_SOLVED, rankWork, type WorkItem } from '@/utils/engine/nextAction';
import { DRILL_MINUTES } from '@/utils/engine/drills';
import { selectMostMissedPatterns } from '@/store/slices/drillsSlice';
import {
  COURSE_REVIEW_MINUTES,
  COURSE_SESSION_MINUTES,
  DEFAULT_TASK_MINUTES,
  ML_REBUILD_MINUTES,
  revisionMinutes,
} from '@/utils/engine/planner';
import { ML_TRACK_TITLES } from '@/data/mlTrackIndex';
import {
  dueMlTrackIds,
  mlActivityByDate,
  mlLadderItems,
  mlStanding,
} from '@/utils/engine/mlTrack';
import { patternWeakness, type PatternWeakness } from '@/utils/engine/weakness';
import { isHintReliant } from '@/utils/engine/hints';
import {
  analyzeContest,
  stalledIdsFromRecord,
  timeReading,
  type Contest,
  type ContestAnalysis,
  type ContestAttempt,
  type ContestProblem,
} from '@/utils/engine/contest';
import { interviewDraws, type InterviewDraw } from '@/utils/engine/interview';
import { companyById, type Company } from '@/data/companies';
import {
  companyCoverage,
  companyPracticeSet,
  type CompanyCoverage,
} from '@/utils/engine/companies';
import {
  buildRevisionSession,
  type RevisionCandidate,
  type RevisionSession,
  type TransferCandidate,
} from '@/utils/engine/session';
import { FAMILIES } from '@/data/curriculum';
import { courseWeekById } from '@/data/aimlCourse';
import { currentDay, daySlice, isWeeklyRevisionDay, totalDays } from '@/utils/engine/roadmap';
import { computeStreaks, hasActivity } from '@/utils/engine/streak';
import { levelProgress } from '@/utils/engine/xp';
import { difficultyStats, patternStats, productivityScore } from '@/utils/engine/stats';
import { buildAchievementCtx } from '@/utils/engine/achievements';
import { combinedRevisionLoadForecast } from '@/utils/engine/predictor';
import { weeklyTopUp } from '@/utils/engine/weeklyRevision';
import { COURSE_WEEKS } from '@/data/aimlCourse';
import {
  courseActivityByDate,
  courseSchedule,
  courseStats,
  dueCourseReviewWeekIds,
  nextSession,
  projectedFinish,
} from '@/utils/engine/aimlCourse';
import type { CourseWeekProgress } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

// --- Static dataset helpers (no store dependency — identity of the static import) -----------

export const selectQuestions = (): Question[] => questions;

export const selectQuestionById = (id: number): Question | undefined => questionById.get(id);

// --- Base (non-memoized) field accessors, reused as createSelector inputs -------------------

export const selectProgressById = (state: RootState): Record<number, QuestionProgress> =>
  state.progress.byId;
export const selectDayLogs = (state: RootState): Record<string, DayLog> => state.progress.dayLogs;
const selectRevisionEnabled = (state: RootState): boolean => state.settings.revisionEnabled;
const selectXp = (state: RootState): number => state.gamification.xp;
export const selectTodayArg = (_state: RootState, today: string): string => today;
export const selectCourseByWeekId = (state: RootState): Record<string, CourseWeekProgress> =>
  state.course.byWeekId;

// Course work per date (sessions + graded reviews), derived from byWeekId. Every activity
// surface (streaks, heatmap, calendar) merges this in so a course-only day counts like a
// solving day.
export const selectCourseActivityByDate = createSelector([selectCourseByWeekId], (byWeekId) =>
  courseActivityByDate(byWeekId),
);

export const selectCourseActiveDates = createSelector(
  [selectCourseActivityByDate],
  (activity): ReadonlySet<string> => new Set(activity.keys()),
);

/**
 * Work on the ML implementation tracks and projects, per date — rung stamps, graded rebuilds,
 * projects started and shipped. Derived from progress rather than logged, exactly as the course's
 * is, so DayLog stays the DSA-only ledger it has always been.
 */
export const selectMlActivityByDate = createSelector(
  [(state: RootState) => state.ml.tracksById, (state: RootState) => state.ml.projectsById],
  (tracksById, projectsById) => mlActivityByDate(tracksById, projectsById),
);

/**
 * Everything that is not DSA solving, per date. The product's rule is "a day counts as active when
 * EITHER track saw work"; V8 makes the implementation tracks a third source of that work, so every
 * activity surface reads this rather than the course alone — otherwise an evening spent rebuilding
 * backprop from a blank file would break a streak.
 */
export const selectOtherTrackActivityByDate = createSelector(
  [selectCourseActivityByDate, selectMlActivityByDate],
  (course, ml): Map<string, number> => {
    const merged = new Map(course);
    for (const [date, count] of ml) merged.set(date, (merged.get(date) ?? 0) + count);
    return merged;
  },
);

export const selectOtherTrackActiveDates = createSelector(
  [selectOtherTrackActivityByDate],
  (activity): ReadonlySet<string> => new Set(activity.keys()),
);

export const selectPerDay = (state: RootState): number => state.settings.questionsPerDay;

// --- Roadmap progression ----------------------------------------------------------------

export const selectSolvedNewCount = createSelector([selectProgressById], (byId): number =>
  Object.values(byId).filter((p) => p.status === 'solved').length,
);

export const selectTotalDays = createSelector([selectPerDay], (perDay) =>
  totalDays(questions.length, perDay),
);

export const selectCurrentDay = createSelector(
  [selectSolvedNewCount, selectPerDay],
  (solvedNewCount, perDay) => currentDay(solvedNewCount, perDay, questions.length),
);

// Full day-slice (8 questions) for the current day, including ones already solved today — the
// UI is responsible for rendering those as completed cards.
export const selectTodaysNewQuestions = createSelector(
  [selectCurrentDay, selectPerDay],
  (day, perDay) => daySlice(questions, day, perDay),
);

export const selectIsWeeklyDay = createSelector([selectCurrentDay], (day) =>
  isWeeklyRevisionDay(day),
);

// --- Revision queue ----------------------------------------------------------------------

export const selectDueRevisionIds = createSelector(
  [selectProgressById, selectTodayArg],
  (byId, today) => dueIds(byId, today),
);

// Gated on the weekly day here (not just at the queue-assembly step below) so the 539-question
// pool scan never runs on the six days out of seven whose result would be discarded anyway.
export const selectWeeklyTopUpIds = createSelector(
  [selectIsWeeklyDay, selectProgressById, selectDueRevisionIds, selectTodayArg],
  (isWeekly, byId, due, today): number[] => (isWeekly ? weeklyTopUp(questions, byId, due, today) : []),
);

// Due items every day; on weekly-revision days, due + weekly top-up extras. [] whenever
// revision is disabled in settings.
export const selectRevisionQueueIds = createSelector(
  [selectRevisionEnabled, selectIsWeeklyDay, selectDueRevisionIds, selectWeeklyTopUpIds],
  (enabled, isWeekly, due, topUp): number[] => {
    if (!enabled) return [];
    return isWeekly ? [...due, ...topUp] : due;
  },
);

// --- Stats / gamification -----------------------------------------------------------------

export const selectPatternStats = createSelector([selectProgressById], (byId) =>
  patternStats(questions, byId),
);

export const selectDifficultyStats = createSelector([selectProgressById], (byId) =>
  difficultyStats(questions, byId),
);

export const selectStreaks = createSelector(
  [selectDayLogs, selectTodayArg, selectOtherTrackActiveDates],
  (dayLogs, today, otherTrackDates) => computeStreaks(dayLogs, today, otherTrackDates),
);

export const selectLevelInfo = createSelector([selectXp], (xp) => levelProgress(xp));

function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

// Last 365 days ending today (oldest first).
export const selectHeatmapData = createSelector(
  [selectDayLogs, selectTodayArg, selectOtherTrackActivityByDate],
  (dayLogs, today, courseActivity): { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] => {
    const days: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
    for (let i = 364; i >= 0; i--) {
      const date = addDays(today, -i);
      const log = dayLogs[date];
      const dsaCount = log ? log.solvedIds.length + log.revisionsPassed.length + log.revisionsFailed.length : 0;
      const count = dsaCount + (courseActivity.get(date) ?? 0);
      days.push({ date, count, level: heatmapLevel(count) });
    }
    return days;
  },
);

// `selectEstimatedFinish` used to live here, returning a bare date string. It was deleted rather
// than kept: DashboardPage reads `finishProjection` directly because a bare date cannot express
// the basis it was computed from, nor suppress itself once the roadmap is complete. Two paths to
// the same fact is how two surfaces come to disagree about it.

export const selectProductivityScore = createSelector(
  [selectDayLogs, selectProgressById, selectPerDay, selectTodayArg],
  (dayLogs, byId, perDay, today) => productivityScore(dayLogs, byId, perDay, today),
);

// NOTE: `selectWeakestPatterns` (engine/recommendations.weakestPatterns) was deleted here. It was
// the second weakness formula — a pass-rate/confidence/coverage blend that imputed `passRate ?? 1`
// and `avgConfidence ?? 3`, i.e. scored UNMEASURED patterns as if they had been tested. Dashboard,
// Companies and Patterns read it while Analytics, Revision and the session engine read
// `selectPatternWeakness`, so the product held two contradictory opinions about the same learner
// (one of them capable of calling a 100%-solved pattern "weakest"). Weakness is claimed in exactly
// one place: `selectPatternWeakness`.

// Course weeks climb the same 1/3/7/15/30 ladder as questions, so the load forecast counts
// both tracks in one series.
export const selectForecast = createSelector(
  [selectProgressById, selectCourseByWeekId, (state: RootState) => state.ml.tracksById, selectTodayArg],
  (byId, byWeekId, mlTracksById, today) =>
    combinedRevisionLoadForecast(
      byId,
      COURSE_WEEKS,
      byWeekId,
      today,
      30,
      mlLadderItems(mlTracksById),
    ),
);

export const selectBookmarkedIds = createSelector([selectProgressById], (byId): number[] =>
  Object.entries(byId)
    .filter(([, p]) => p.bookmarked)
    .map(([id]) => Number(id)),
);

export const selectTodayLog = createSelector(
  [selectDayLogs, selectTodayArg],
  (dayLogs, today): DayLog | undefined => dayLogs[today],
);

// --- AI/ML course track -------------------------------------------------------------------

export const selectAchievementCtx = createSelector(
  [selectProgressById, selectDayLogs, selectTodayArg, selectCourseByWeekId],
  (byId, dayLogs, today, courseByWeekId) =>
    buildAchievementCtx(questions, byId, dayLogs, today, courseByWeekId),
);

export const selectCourseStats = createSelector([selectCourseByWeekId], (byWeekId) =>
  courseStats(COURSE_WEEKS, byWeekId),
);

export const selectCourseNextSession = createSelector([selectCourseByWeekId], (byWeekId) =>
  nextSession(COURSE_WEEKS, byWeekId),
);

export const selectCourseSchedule = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today) => courseSchedule(COURSE_WEEKS, byWeekId, today),
);

export const selectCourseProjectedFinish = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today) => projectedFinish(COURSE_WEEKS, byWeekId, today),
);

export const selectCourseDueReviewIds = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today) => dueCourseReviewWeekIds(COURSE_WEEKS, byWeekId, today),
);

// --- ML implementation tracks ------------------------------------------------------------------

const selectMlTracksById = (state: RootState) => state.ml.tracksById;

/** Tracks whose rebuild has come due — the third ladder, same 1/3/7/15/30 arithmetic. */
export const selectMlDueTrackIds = createSelector(
  [selectMlTracksById, selectTodayArg],
  (tracksById, today) => dueMlTrackIds(tracksById, today),
);

/**
 * How much of the eleven-track ladder has been worked. One line on /aiml, no more.
 *
 * Computed from the progress map and the id index — never from the track catalog, which would
 * pull 275 kB of content onto the app chunk (see src/data/mlTrackIndex.ts).
 */
export const selectMlStanding = createSelector([selectMlTracksById], (tracksById) =>
  mlStanding(tracksById),
);

/** Whether a course session was already marked done today — the track's one-a-day cadence. */
export const selectCourseSessionDoneToday = createSelector(
  [selectCourseByWeekId, selectTodayArg],
  (byWeekId, today): boolean =>
    Object.values(byWeekId).some((w) => w.day1DoneOn === today || w.day2DoneOn === today),
);

// --- Time intelligence --------------------------------------------------------------------

// Every usable pace measurement, computed once for the whole app rather than per question —
// a question list would otherwise rescan the entire history for each row it renders.
export const selectPaceSamples = createSelector([selectProgressById], (byId) =>
  paceSamples(questions, byId),
);

/** The estimate for one question, personalized when the history supports it. */
export const selectTimeEstimate = createSelector(
  [selectPaceSamples, (_state: RootState, question: Question) => question],
  (samples, question) => estimateFor(question, samples),
);

// --- What to do next ----------------------------------------------------------------------

export const selectDrillsByDate = (state: RootState) => state.drills.byDate;
export const selectContestsByDate = (state: RootState) => state.contests.byDate;
const selectTasksById = (state: RootState) => state.tasks.byId;

/**
 * The whole day's work, ranked — the single source both the "next best action" hero and the
 * "I have N minutes" session planner read from.
 *
 * Everything the ranker needs is assembled here rather than inside it: the engine stays pure
 * and clock-free, and the joins against the static dataset happen once, memoized.
 */
export const selectRankedWork = createSelector(
  [
    selectRevisionQueueIds,
    selectProgressById,
    selectTodaysNewQuestions,
    selectPaceSamples,
    selectDrillsByDate,
    selectMostMissedPatterns,
    selectCourseDueReviewIds,
    selectCourseNextSession,
    selectMlDueTrackIds,
    selectTasksById,
    selectSolvedNewCount,
    selectDayLogs,
    selectPerDay,
    selectCourseSessionDoneToday,
    selectTodayArg,
  ],
  (
    revisionIds,
    byId,
    todaysNew,
    samples,
    drillsByDate,
    mostMissed,
    courseDueReviewIds,
    courseNext,
    mlDueTrackIds,
    tasksById,
    solvedNewCount,
    dayLogs,
    perDay,
    courseSessionDoneToday,
    today,
  ): WorkItem[] => {
    const revisions = revisionIds
      .map((id) => {
        const question = questionById.get(id);
        const progress = byId[id];
        if (!question || !progress) return null;
        const daysPastDue = progress.nextRevision ? diffDays(today, progress.nextRevision) : 0;
        return {
          question,
          overdueDays: Math.max(0, daysPastDue),
          intervalDays: REVISION_INTERVALS[progress.revisionStage] ?? REVISION_INTERVALS[0],
          minutes: revisionMinutes(question),
          // A weekly-revision-day top-up is scheduled in the FUTURE (negative days-past-due).
          // Flagged rather than clamped-and-forgotten, so the ranker can give it a reason that
          // is true instead of announcing a ladder step that has not arrived.
          topUp: daysPastDue < 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // `currentDay` derives from the solved count, so finishing today's slice immediately
    // advances the roadmap and exposes the NEXT day's questions. Left uncapped, the plan would
    // refill the instant it was emptied and the day could never be finished — a treadmill with
    // no completion moment, which is the single most demotivating shape a daily surface can
    // have. The allowance closes it: once the day's goal is met, further questions are
    // available on the roadmap as explicitly optional work, not as unfinished business.
    // Counted against ALL of today's solves, matching the daily goal the rest of the app shows.
    // Scoping it to today's slice instead does not work: `currentDay` derives from the solved
    // count, so the moment the slice is finished `todaysNew` becomes the NEXT slice, a
    // slice-scoped allowance resets to full, and the plan refills — the treadmill this cap
    // exists to close.
    //
    // Known interaction with the locked roadmap spec: solving out of order (e.g. from a company
    // practice set) advances `currentDay` past questions that were never shown here, and they do
    // not return to Today. That is inherent to `currentDay = f(solvedCount)` over static id
    // ranges, not to this cap — /roadmap remains the surface that shows every question, and
    // Today links to it for exactly this reason.
    const solvedToday = dayLogs[today]?.solvedIds.length ?? 0;
    const remainingAllowance = Math.max(0, perDay - solvedToday);
    const newQuestions = todaysNew
      .filter((q) => {
        const status = byId[q.id]?.status ?? 'unsolved';
        return status !== 'solved' && status !== 'skipped';
      })
      .slice(0, remainingAllowance)
      .map((question) => ({ question, minutes: plannedMinutes(estimateFor(question, samples)) }));

    // The pattern `buildDrill` is actually weighted toward. It is NOT a weakness claim — that is
    // `selectPatternWeakness`'s job and nowhere else's — so it is named for what it measures.
    const missedMost = mostMissed[0]?.pattern as PatternId | undefined;

    return rankWork({
      revisions,
      newQuestions,
      drill: {
        eligible: solvedNewCount >= DRILL_MIN_SOLVED,
        doneToday: drillsByDate[today] !== undefined,
        missedMostPatternName: missedMost
          ? (PATTERNS.find((p) => p.id === missedMost)?.name ?? null)
          : null,
        minutes: DRILL_MINUTES,
      },
      course: {
        dueReviews: courseDueReviewIds.map((weekId) => ({
          weekId,
          title: courseWeekById.get(weekId)?.title ?? weekId,
          minutes: COURSE_REVIEW_MINUTES,
        })),
        // The course is paced one session a day (day 1 lecture, day 2 practice, on consecutive
        // days). Once today's session is done, `nextSession` still reports the following one —
        // suggesting it here would push the learner a day ahead of the cadence and, because
        // there is always a next week, would keep the day's plan permanently non-empty.
        nextSession: courseNext && !courseSessionDoneToday
          ? {
              weekId: courseNext.weekId,
              title: `${courseWeekById.get(courseNext.weekId)?.title ?? courseNext.weekId} · Day ${courseNext.day}`,
              minutes: COURSE_SESSION_MINUTES,
            }
          : null,
      },
      ml: {
        dueRebuilds: mlDueTrackIds.map((trackId) => ({
          trackId,
          title: ML_TRACK_TITLES[trackId] ?? trackId,
          minutes: ML_REBUILD_MINUTES,
        })),
      },
      openTasks: Object.values(tasksById).filter((t) => t.date === today && !t.done),
      taskDefaultMinutes: DEFAULT_TASK_MINUTES,
    });
  },
);

// --- Decision-support analytics ------------------------------------------------------------

/**
 * Which patterns are not holding, how strongly, and why. ONE place, deliberately.
 *
 * The whole model lives in `engine/weakness.ts`: eight recency-weighted signals, each gated on
 * repeated evidence, none of them allowed to dominate, every score carrying the signals that
 * produced it. This selector only assembles the inputs — the joins against the static dataset
 * happen here, memoized, so the engine stays pure.
 *
 * The return shape is deliberately a superset of `{ id, name, score }`: the revision session
 * (engine/session.ts) reads exactly those three fields and must keep working unchanged, while
 * every surface that explains a weakness reads `signals`/`summary` instead of printing a score.
 */
const MAX_WEAK_PATTERNS = 5;

export const selectAllPatternWeakness = createSelector(
  [selectProgressById, selectDrillsByDate, selectContestsByDate, selectTodayArg],
  (byId, drills, contests, today): PatternWeakness[] =>
    patternWeakness({ today, all: questions, byId, drills, contests, families: FAMILIES }),
);

/** The head of the same list, for the surfaces that act on it rather than explain it. */
export const selectPatternWeakness = createSelector(
  [selectAllPatternWeakness],
  (all): PatternWeakness[] => all.slice(0, MAX_WEAK_PATTERNS),
);

/**
 * Mean `revisionMinutes` across the questions currently on the review ladder.
 *
 * The revision-load forecast is a count of reviews per day, so converting it to time needs one
 * representative figure. Deriving it from the learner's own ladder keeps the analytics surface
 * and the session plan quoting compatible numbers; the flat constant is only the empty-ladder
 * fallback.
 */
/** Raw pass/fail counts across both tracks — `overallRevisionPassRate` returns only the ratio. */
export const selectRecallRecord = createSelector(
  [selectProgressById, selectCourseByWeekId],
  (byId, byWeekId): { passed: number; failed: number; attempts: number; rate: number | null } => {
    let passed = 0;
    let failed = 0;
    for (const p of [...Object.values(byId), ...Object.values(byWeekId)]) {
      for (const ev of p.revisionHistory) {
        if (ev.passed) passed += 1;
        else failed += 1;
      }
    }
    const attempts = passed + failed;
    return { passed, failed, attempts, rate: attempts === 0 ? null : passed / attempts };
  },
);

/** Whether anything is left on today's plan — the "done for today" signal. */
export const selectDayCleared = createSelector([selectRankedWork], (work) => work.length === 0);

// --- Revision session ------------------------------------------------------------------------
// Assembly for engine/session.ts. Same discipline as selectRankedWork: every join against the
// static dataset happens here, memoized, so the engine stays pure and clock-free.

/**
 * Every question on the ladder — due AND not yet due. The session engine needs both: the due work
 * is the session, and the not-yet-due work is what a longer session pulls forward instead of
 * padding itself with filler.
 */
const selectLadderCandidates = createSelector(
  [selectProgressById, selectTodayArg],
  (byId, today): RevisionCandidate[] => {
    const out: RevisionCandidate[] = [];
    for (const [rawId, progress] of Object.entries(byId)) {
      if (progress.status !== 'solved' || progress.nextRevision === null) continue;
      const question = questionById.get(Number(rawId));
      if (!question) continue;
      out.push({
        question,
        overdueDays: diffDays(today, progress.nextRevision),
        intervalDays: REVISION_INTERVALS[progress.revisionStage] ?? REVISION_INTERVALS[0]!,
        stage: progress.revisionStage,
        failures: progress.revisionHistory.filter((r) => !r.passed).length,
        confidence: progress.confidence,
        // "Days since the learner last touched it" — so a question solved but never yet reviewed
        // counts from the day it was solved, not from zero. Reading only `lastReviewed` reported
        // a question solved a month ago and never revisited as freshly seen, which zeroed the
        // staleness tiebreak on precisely the work most at risk of being forgotten.
        daysSinceSeen: diffDays(today, progress.lastReviewed ?? progress.completedAt ?? today),
        // V7: the reconstruction gap — real hint help (rung ≥2) and no passed review since. One
        // unaided pass clears it: the learner has re-derived the idea, whatever help started it.
        hintReliant: isHintReliant(progress.hintLevelUsed) && !progress.revisionHistory.some((e) => e.passed),
      });
    }
    return out;
  },
);

/**
 * Unsolved problems in families the learner has already met — the only honest transfer material
 * in the dataset. "Same idea, new disguise" is a claim the family map can actually support;
 * picking an arbitrary unsolved question and calling it transfer would not be.
 */
const MAX_TRANSFER_CANDIDATES = 40;

const selectTransferCandidates = createSelector(
  [selectProgressById],
  (byId): TransferCandidate[] => {
    const out: TransferCandidate[] = [];
    for (const family of FAMILIES) {
      const solved = family.members.filter((m) => byId[m.questionId]?.status === 'solved');
      if (solved.length === 0) continue;
      const from = questionById.get(solved[0]!.questionId);
      if (!from) continue;
      for (const member of family.members) {
        const status = byId[member.questionId]?.status ?? 'unsolved';
        if (status === 'solved' || status === 'skipped') continue;
        const question = questionById.get(member.questionId);
        if (!question) continue;
        out.push({ question, familyName: family.name, fromTitle: from.title });
        if (out.length >= MAX_TRANSFER_CANDIDATES) return out;
      }
    }
    return out;
  },
);

/**
 * "I have N minutes" — the best revision session that fits, most valuable first.
 *
 * Budget comes from `settings.dailyCapacityMin`, the same number the Today chips and the Settings
 * page write. One concept, several places to change it, never two competing numbers.
 */
export const selectRevisionSession = createSelector(
  [
    selectLadderCandidates,
    selectTransferCandidates,
    selectCourseDueReviewIds,
    selectCourseByWeekId,
    selectPatternWeakness,
    selectSolvedNewCount,
    selectDrillsByDate,
    (state: RootState) => state.settings.dailyCapacityMin,
    selectRevisionEnabled,
    selectTodayArg,
  ],
  (
    candidates,
    transfer,
    courseDueIds,
    courseByWeekId,
    weakPatterns,
    solvedNewCount,
    drillsByDate,
    budgetMin,
    revisionEnabled,
    today,
  ): RevisionSession =>
    buildRevisionSession({
      budgetMin,
      // The Settings toggle promises "Show due revisions on the Today and Revision pages" — the
      // same gate selectRevisionQueueIds applies for Today, or the two surfaces contradict each
      // other. Only ladder reviews are gated: drills, transfer and course reviews stay, exactly
      // as they do on Today.
      candidates: revisionEnabled ? candidates : [],
      transfer,
      courseReviews: courseDueIds
        .map((weekId) => {
          const week = courseWeekById.get(weekId);
          if (!week) return null;
          const next = courseByWeekId[weekId]?.nextRevision ?? null;
          return {
            weekId,
            title: `Week ${week.week} — ${week.title}`,
            minutes: COURSE_REVIEW_MINUTES,
            overdueDays: next ? Math.max(0, diffDays(today, next)) : 0,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
      weakPatterns,
      drill: {
        available: solvedNewCount >= DRILL_MIN_SOLVED && drillsByDate[today] === undefined,
        minutes: DRILL_MINUTES,
        weakestPatternName: weakPatterns[0]?.name ?? null,
      },
    }),
);

/**
 * Days since the last day with any activity on either track, or null for a learner who has never
 * been active. Drives the return experience: coming back after a gap should be met with a
 * fresh-start frame and a rebalanced plan, not a pile of overdue debt.
 */
export const selectDaysAway = createSelector(
  [selectDayLogs, selectCourseActiveDates, selectTodayArg],
  (dayLogs, courseDates, today): number | null => {
    let last: string | null = null;
    for (const log of Object.values(dayLogs)) {
      if (log.date < today && hasActivity(log) && (last === null || log.date > last)) last = log.date;
    }
    for (const date of courseDates) {
      if (date < today && (last === null || date > last)) last = date;
    }
    return last === null ? null : diffDays(today, last);
  },
);

// --- Company preparation -----------------------------------------------------------------------

/**
 * The company being prepared for, or null. Resolved through the dataset every time and gated on
 * the topics tier, so retiring a company (or downgrading its evidence) makes a stored target inert
 * rather than dangerous — the setting stores a bare id precisely so it can go stale safely.
 */
export const selectTargetCompany = createSelector(
  [(state: RootState) => state.settings.targetCompanyId],
  (targetCompanyId): Company | null => {
    if (!targetCompanyId) return null;
    const company = companyById[targetCompanyId];
    return company && company.evidence === 'topics' ? company : null;
  },
);

/**
 * How this learner stands across the target company's OWN named topics, and the highest-value
 * practice inside them. One memoized seam, so Today, the company page and the interview scope all
 * read the same reading rather than three surfaces each recomputing (and eventually disagreeing).
 *
 * Null without a target, which is most of the time and is not a gap.
 */
export const selectTargetCompanyCoverage = createSelector(
  [selectTargetCompany, selectPatternStats, selectProgressById],
  (company, stats, byId): CompanyCoverage | null =>
    company ? companyCoverage(company.patterns, stats, questions, byId) : null,
);

export const selectTargetCompanyPracticeSet = createSelector(
  [selectTargetCompanyCoverage, selectProgressById],
  (coverage, byId): Question[] =>
    coverage ? companyPracticeSet(coverage, questions, byId) : [],
);

// --- Interviews ------------------------------------------------------------------------------

/**
 * The problems an interview could draw, most worth interviewing first, each with its grounds.
 *
 * This assembles the inputs; `interviewDraws` decides the order. Note what it reads: the ONE
 * weakness model, the persisted contest record, and the existing hint-reliance rule — three
 * signals that already exist, joined here rather than re-derived. Interview mode computes no
 * weakness of its own, and it may not: a second opinion about what the learner is bad at is the
 * failure this codebase has already had twice.
 */
export const selectInterviewDraws = createSelector(
  [selectQuestions, selectProgressById, selectContestsByDate, selectPatternWeakness, selectTodayArg],
  (all, byId, contests, weakness, todayArg): InterviewDraw[] => {
    const pool = all.filter((question) => {
      const status = byId[question.id]?.status ?? 'unsolved';
      return status === 'unsolved' || status === 'in_progress';
    });

    // Every stall the persisted record still holds. No recency cutoff on purpose: a stalled
    // problem stays in the pool only until it is solved, so solving it is what retires the
    // evidence — an arbitrary "last 30 days" would just hide work that is still undone.
    const stalledQuestionIds = Object.values(contests).flatMap(stalledIdsFromRecord);

    const hintReliantFamilyIds = Array.from(
      new Set(
        all
          .filter((question) => {
            const progress = byId[question.id];
            if (!progress || question.familyId === undefined) return false;
            return (
              isHintReliant(progress.hintLevelUsed) &&
              !progress.revisionHistory.some((event) => event.passed)
            );
          })
          .map((question) => question.familyId!),
      ),
    );

    return interviewDraws({
      pool,
      seed: `interview:${todayArg}`,
      stalledQuestionIds,
      weakPatterns: weakness.map((entry) => entry.id),
      hintReliantFamilyIds,
    });
  },
);

/**
 * The sitting before this one, or null when there is no earlier one to compare against.
 *
 * `finishInterview` banks the current sitting the moment it ends, so on the debrief screen the
 * last record IS the sitting being read — the previous one is the record behind it. Resolving that
 * here rather than in the page keeps the debrief from doing index arithmetic on a growing array,
 * which is exactly the sort of thing that silently starts comparing a sitting with itself.
 */
export const selectPreviousInterviewSitting = createSelector(
  [(state: RootState) => state.interviews.sittings, (state: RootState) => state.interview],
  (sittings, live): InterviewSittingRecord | null => {
    if (sittings.length === 0) return null;
    const last = sittings[sittings.length - 1]!;
    const lastIsCurrent =
      live.questionId !== null &&
      live.finishedOn !== null &&
      last.questionId === live.questionId &&
      last.date === live.startedOn;
    const index = sittings.length - (lastIsCurrent ? 2 : 1);
    return index >= 0 ? sittings[index]! : null;
  },
);

// --- Contest ---------------------------------------------------------------------------------

const selectContestState = (state: RootState) => state.contest;

/**
 * The running set, rebuilt from the slice's snapshot (question ids + per-problem targets)
 * against the static dataset. The slice, not `buildContest`, is the source of truth once a
 * contest starts — the same freezing rule as a revision session: solving a problem mid-sitting
 * must not reshuffle the set underneath the learner.
 */
export const selectContestProblems = createSelector(
  [selectContestState],
  (contest): ContestProblem[] =>
    contest.questionIds.flatMap((id, i) => {
      const question = questionById.get(id);
      const targetMinutes = contest.targetMinutes[i];
      return question && targetMinutes !== undefined
        ? [{ question, order: i + 1, targetMinutes }]
        : [];
    }),
);

/**
 * The engine's reading of a finished contest, or null while none is finished. Null rather than a
 * half-analysis mid-contest: `analyzeContest` treats unattempted problems as untouched, so
 * running it early would "read" a sitting that is still happening.
 */
/** The live attempts in the engine's shape. One conversion, so every reader sees the same sitting. */
export const selectContestAttempts = createSelector(
  [selectContestState, selectContestProblems],
  (contest, problems): ContestAttempt[] =>
    problems.map((p) => {
      const attempt = contest.attempts[p.question.id];
      return {
        questionId: p.question.id,
        solved: attempt?.solved ?? false,
        minutesSpent: attempt?.minutesSpent ?? 0,
        wrongSubmits: attempt?.wrongSubmits ?? 0,
        setAside: attempt?.setAside ?? false,
      };
    }),
);

/** The set the finished analysis was read from — the frozen contest, in the engine's shape. */
const selectFinishedContest = createSelector(
  [selectContestState, selectContestProblems],
  (contest, problems): Contest | null =>
    contest.seed === null || contest.finishedAtMs === null
      ? null
      : {
          id: contest.seed,
          // The honest shape is what the set actually holds, not the ladder it aimed for — a slot
          // can go unfilled when the eligible pool for its difficulty runs dry.
          shape: problems.map((p) => p.question.difficulty),
          problems,
          durationMin: contest.durationMin,
        },
);

export const selectContestAnalysis = createSelector(
  [selectFinishedContest, selectContestAttempts],
  (contest, attempts): ContestAnalysis | null =>
    contest === null ? null : analyzeContest(contest, attempts),
);

/** How the sitting's minutes were distributed, or null when there is no distribution to describe. */
export const selectContestTimeReading = createSelector(
  [selectFinishedContest, selectContestAttempts],
  (contest, attempts): string | null => (contest === null ? null : timeReading(contest, attempts)),
);
