import {
  analyzeContest,
  buildContest,
  CONTEST_SHAPE,
  SLOW_FACTOR,
  UNTOUCHED_SHARE,
  timeReading,
  type Contest,
  type ContestAttempt,
} from '@/utils/engine/contest';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import type { Difficulty, PatternId, Question, QuestionProgress } from '@/types';
import { QF } from '@/test/questionFixture';

const q = (
  id: number,
  difficulty: Difficulty,
  pattern: PatternId,
  estimatedTime = 25,
): Question => ({ id, title: `Q${id}`, pattern, difficulty, estimatedTime, ...QF });

// A dataset with several options at every difficulty, spread across patterns.
const PATTERNS: PatternId[] = ['two-pointers', 'graphs', 'stacks', 'hash-maps', 'greedy', 'trie'];
const all: Question[] = [];
let nextId = 1;
for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
  for (const pattern of PATTERNS) {
    all.push(q(nextId++, difficulty, pattern, difficulty === 'easy' ? 12 : difficulty === 'medium' ? 25 : 45));
  }
}

describe('buildContest', () => {
  test('follows the difficulty ladder, opening on something finishable', () => {
    const contest = buildContest({ all, byId: {}, seed: '2026-07-30' });

    expect(contest.problems).toHaveLength(CONTEST_SHAPE.length);
    expect(contest.problems.map((p) => p.question.difficulty)).toEqual(CONTEST_SHAPE);
    expect(contest.problems[0]!.question.difficulty).toBe('easy');
  });

  test('spans distinct patterns — four problems on one technique measure one thing four times', () => {
    const contest = buildContest({ all, byId: {}, seed: '2026-07-30' });
    const patterns = contest.problems.map((p) => p.question.pattern);

    expect(new Set(patterns).size).toBe(patterns.length);
  });

  test('the same seed produces the same contest, so a reload does not reshuffle it', () => {
    const a = buildContest({ all, byId: {}, seed: '2026-07-30' });
    const b = buildContest({ all, byId: {}, seed: '2026-07-30' });
    const c = buildContest({ all, byId: {}, seed: '2026-07-31' });

    expect(a.problems.map((p) => p.question.id)).toEqual(b.problems.map((p) => p.question.id));
    expect(a.problems.map((p) => p.question.id)).not.toEqual(c.problems.map((p) => p.question.id));
  });

  test('never sets a problem the learner has already solved', () => {
    const byId: Record<number, QuestionProgress> = {};
    for (const question of all.filter((x) => x.difficulty === 'easy')) {
      byId[question.id] = { ...initialProgress(), status: 'solved' };
    }

    const contest = buildContest({ all, byId, seed: '2026-07-30' });
    for (const problem of contest.problems) {
      expect(byId[problem.question.id]?.status).not.toBe('solved');
    }
  });

  test('repeats a pattern rather than shipping a short contest', () => {
    // Only one easy question left, and it shares a pattern with the medium pool.
    const narrow: Question[] = [
      q(100, 'easy', 'graphs', 12),
      q(101, 'medium', 'graphs', 25),
      q(102, 'medium', 'graphs', 25),
      q(103, 'hard', 'graphs', 45),
    ];
    const contest = buildContest({ all: narrow, byId: {}, seed: 's' });

    expect(contest.problems).toHaveLength(4);
  });

  test('the schedule is tight but not impossible — a little over the sum of estimates', () => {
    const contest = buildContest({ all, byId: {}, seed: '2026-07-30' });
    const sum = contest.problems.reduce((total, p) => total + p.targetMinutes, 0);

    expect(contest.durationMin).toBeGreaterThan(sum);
    expect(contest.durationMin).toBeLessThan(sum * 1.5);
  });
});

describe('analyzeContest — conservative by design', () => {
  const contest: Contest = buildContest({ all, byId: {}, seed: '2026-07-30' });
  const [p1, p2, p3, p4] = contest.problems;

  const attempt = (id: number, solved: boolean, minutesSpent: number): ContestAttempt => ({
    questionId: id,
    solved,
    minutesSpent,
  });

  test('a solve at pace reads clean; a solve well over reads as time in the writing', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, true, Math.ceil(p2!.targetMinutes * SLOW_FACTOR) + 5),
      attempt(p3!.question.id, true, p3!.targetMinutes),
      attempt(p4!.question.id, true, p4!.targetMinutes),
    ]);

    expect(analysis.readings[0]!.outcome).toBe('clean');
    expect(analysis.readings[1]!.outcome).toBe('slow');
    expect(analysis.readings[1]!.reading).toContain('the approach was there');
    expect(analysis.solved).toBe(4);
  });

  test('a barely-touched problem produces no claim about the learner', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, true, p2!.targetMinutes),
      attempt(p3!.question.id, true, p3!.targetMinutes),
      attempt(p4!.question.id, false, Math.floor(p4!.targetMinutes * UNTOUCHED_SHARE) - 1),
    ]);

    const last = analysis.readings[3]!;
    expect(last.outcome).toBe('untouched');
    expect(last.reading).toContain('not enough to read anything into');
    // A pattern must never be called a gap on the strength of a problem nobody engaged with.
    expect(analysis.patternGaps).not.toContain(last.question.pattern);
  });

  test('a genuine stall names the pattern as a gap and points at it', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, true, p2!.targetMinutes),
      attempt(p3!.question.id, false, p3!.targetMinutes),
      attempt(p4!.question.id, true, p4!.targetMinutes),
    ]);

    expect(analysis.readings[2]!.outcome).toBe('stalled');
    expect(analysis.patternGaps).toEqual([p3!.question.pattern]);
    expect(analysis.next?.pattern).toBe(p3!.question.pattern);
    expect(analysis.next?.why).toContain('real time on the clock');
  });

  test('an abandoned contest is declared inconclusive rather than mined for weaknesses', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      // The rest never really started.
      attempt(p2!.question.id, false, 1),
      attempt(p3!.question.id, false, 0),
      attempt(p4!.question.id, false, 0),
    ]);

    expect(analysis.inconclusive).toBe(true);
    expect(analysis.patternGaps).toEqual([]);
    expect(analysis.next).toBeNull();
  });

  test('a missing attempt is treated as untouched, not as a failure', () => {
    const analysis = analyzeContest(contest, [attempt(p1!.question.id, true, p1!.targetMinutes)]);

    expect(analysis.readings.slice(1).every((r) => r.outcome === 'untouched')).toBe(true);
    expect(analysis.solved).toBe(1);
  });

  test('a problem set aside early is a decision, not a stall — and produces no claim', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, true, p2!.targetMinutes),
      attempt(p3!.question.id, true, p3!.targetMinutes),
      { ...attempt(p4!.question.id, false, 2), setAside: true },
    ]);

    const last = analysis.readings[3]!;
    expect(last.outcome).toBe('set-aside');
    expect(last.reading).toMatch(/not enough time in it to read anything into/i);
    expect(analysis.patternGaps).not.toContain(last.question.pattern);
  });

  test('setting a problem aside after real time keeps the stall evidence — the decision was good, the gap is still real', () => {
    // Protecting the clock is the right call and the product says so; it does not erase the fact
    // that twenty-five minutes went in without a solution. Naming the decision must not launder
    // the evidence, or "set aside" becomes the button that hides every weakness.
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, true, p2!.targetMinutes),
      { ...attempt(p3!.question.id, false, p3!.targetMinutes), setAside: true },
      attempt(p4!.question.id, true, p4!.targetMinutes),
    ]);

    expect(analysis.readings[2]!.outcome).toBe('set-aside');
    expect(analysis.readings[2]!.reading).toMatch(/without a solution/i);
    expect(analysis.patternGaps).toContain(p3!.question.pattern);
    expect(analysis.stalledQuestionIds).toContain(p3!.question.id);
  });

  test('submissions that did not pass are reported as the fact they are', () => {
    const analysis = analyzeContest(contest, [
      { ...attempt(p1!.question.id, true, p1!.targetMinutes), wrongSubmits: 2 },
      { ...attempt(p2!.question.id, false, p2!.targetMinutes), wrongSubmits: 1 },
      attempt(p3!.question.id, true, p3!.targetMinutes),
      attempt(p4!.question.id, true, p4!.targetMinutes),
    ]);

    expect(analysis.readings[0]!.reading).toMatch(/2 submissions didn't pass/i);
    expect(analysis.readings[1]!.reading).toMatch(/1 submission didn't pass/i);
    // Never a verdict about the learner — a wrong submit is an event, not a trait.
    expect(analysis.readings[0]!.reading).not.toMatch(/careless|sloppy|rushed/i);
  });

  test('stalled question ids survive the analysis so one problem can be served again later', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, true, p2!.targetMinutes),
      attempt(p3!.question.id, false, p3!.targetMinutes),
      attempt(p4!.question.id, false, 1),
    ]);

    expect(analysis.stalledQuestionIds).toEqual([p3!.question.id]);
  });

  test('there is no score, rank, or rating anywhere in the reading', () => {
    const analysis = analyzeContest(contest, [
      attempt(p1!.question.id, true, p1!.targetMinutes),
      attempt(p2!.question.id, false, p2!.targetMinutes),
      attempt(p3!.question.id, true, p3!.targetMinutes),
      attempt(p4!.question.id, false, p4!.targetMinutes),
    ]);

    const prose = analysis.readings.map((r) => r.reading).join(' ') + (analysis.next?.why ?? '');
    expect(prose).not.toMatch(/score|rank|rating|percentile|\bpoints\b/i);
  });
});

describe('timeReading — where the clock actually went', () => {
  const contest: Contest = buildContest({ all, byId: {}, seed: '2026-07-30' });
  const [p1, p2, p3, p4] = contest.problems;
  const attempt = (id: number, solved: boolean, minutesSpent: number): ContestAttempt => ({
    questionId: id,
    solved,
    minutesSpent,
  });

  test('says nothing when only one problem got real time — a single figure is not a distribution', () => {
    expect(
      timeReading(contest, [
        attempt(p1!.question.id, true, p1!.targetMinutes),
        attempt(p2!.question.id, false, 1),
        attempt(p3!.question.id, false, 0),
        attempt(p4!.question.id, false, 0),
      ]),
    ).toBeNull();
  });

  test('names the problem that took the clock when one of them dominated', () => {
    const reading = timeReading(contest, [
      attempt(p1!.question.id, true, 10),
      attempt(p2!.question.id, true, 10),
      attempt(p3!.question.id, false, 60),
      attempt(p4!.question.id, false, 0),
    ]);

    expect(reading).toContain(p3!.question.title);
    expect(reading).toMatch(/60 of your 80 minutes/i);
    expect(reading).toMatch(/did not solve/i);
  });

  test('reports an even spread as an even spread rather than inventing a story', () => {
    const reading = timeReading(contest, [
      attempt(p1!.question.id, true, 20),
      attempt(p2!.question.id, true, 22),
      attempt(p3!.question.id, false, 24),
      attempt(p4!.question.id, false, 21),
    ]);

    expect(reading).toMatch(/spread/i);
    expect(reading).toMatch(/20.*24 min/);
  });

  test('states plainly when problems never got real time', () => {
    const reading = timeReading(contest, [
      attempt(p1!.question.id, true, 30),
      attempt(p2!.question.id, false, 30),
      attempt(p3!.question.id, false, 0),
      attempt(p4!.question.id, false, 0),
    ]);

    expect(reading).toMatch(/2 problems never got real time/i);
  });

  test('carries no judgment register — it reports minutes, it does not grade the learner', () => {
    const reading = timeReading(contest, [
      attempt(p1!.question.id, false, 50),
      attempt(p2!.question.id, false, 30),
      attempt(p3!.question.id, false, 0),
      attempt(p4!.question.id, false, 0),
    ]);

    expect(reading).not.toMatch(
      /score|rank|too long|wasted|should have|poor|bad|worse under pressure|mismanag/i,
    );
  });
});
