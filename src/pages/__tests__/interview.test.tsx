import { act } from 'react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import InterviewPage from '@/pages/InterviewPage';
import questionsData from '@/data/questions.json';
import { familyById } from '@/data/curriculum';
import { patternById } from '@/data/patterns';
import { makeStore } from '@/store/store';
import { revealHint } from '@/store/actions';
import type { InterviewState } from '@/store/slices/interviewSlice';
import { hashSeed, mulberry32, seededShuffle } from '@/utils/engine/prng';
import { followUpsFor } from '@/utils/engine/interview';
import type { Question } from '@/types';

const questions = questionsData as Question[];

// The page seeds its proposal off todayISO(), so the pinned clock makes the landing screen
// reproducible; the test recomputes the same draw.
const TODAY = '2026-07-30';
const proposed = seededShuffle(questions, mulberry32(hashSeed(`interview:${TODAY}`)))[0]!;

// The running/finished shapes are driven off a preloaded slice rather than the day's draw, so the
// reveal assertions can name a problem that genuinely has a family and recorded bounds.
const subject = questions.find((q) => q.familyId !== undefined && q.complexity !== undefined)!;
const family = familyById[subject.familyId!]!;
const patternName = patternById[subject.pattern].name;
const followUps = followUpsFor(subject, family);
// 101 of the 539 questions sit outside the family map, so they have no hint ladder at all.
const familyless = questions.find((q) => q.familyId === undefined)!;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

function interviewStore(overrides: Partial<InterviewState> = {}) {
  return makeStore({
    interview: {
      questionId: subject.id,
      stage: 'understand',
      stageOutcomes: {},
      selfAssessment: {},
      elapsedSec: 0,
      // null = no segment running; the page opens one on mount and settles it on the way out.
      startedAtMs: null,
      hintsAtStart: 0,
      hintsTaken: 0,
      startedOn: TODAY,
      finishedOn: null,
      ...overrides,
    },
  });
}

/** Everything interview mode is meant to be withholding, as it would appear on screen. */
function gatedStrings(): string[] {
  return [patternName, family.name, family.idea, family.trap, subject.tests, ...family.signals];
}

describe('InterviewPage — choosing a problem', () => {
  test('offers one problem and nothing else about it', () => {
    renderWithStore(<InterviewPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Interview mode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: proposed.title })).toBeInTheDocument();
    expect(screen.getByText(`~${proposed.estimatedTime} min recommended`)).toBeInTheDocument();
    expect(
      screen.getByText(/No pattern, no hints, no capability sentence, no bounds/),
    ).toBeInTheDocument();

    // The proposal names the problem, never the technique behind it.
    expect(screen.queryByText(patternById[proposed.pattern].name)).not.toBeInTheDocument();
    expect(screen.queryByText(proposed.tests)).not.toBeInTheDocument();
  });

  test('"Different problem" offers another draw', () => {
    renderWithStore(<InterviewPage />);
    fireEvent.click(screen.getByRole('button', { name: /different problem/i }));

    expect(screen.queryByRole('heading', { level: 2, name: proposed.title })).not.toBeInTheDocument();
  });

  test('lists the ten stages and what each one unlocks, before anything is committed', () => {
    renderWithStore(<InterviewPage />);

    expect(screen.getByRole('heading', { level: 2, name: 'How it runs' })).toBeInTheDocument();
    for (const label of ['Understand', 'Clarify', 'Approach', 'Complexity', 'Follow-ups']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Unlocks: Pattern')).toBeInTheDocument();
  });
});

describe('InterviewPage — the reveal gates', () => {
  test('the first stage shows the prompt and holds every gate shut', () => {
    renderWithStore(<InterviewPage />, interviewStore());

    expect(screen.getByRole('heading', { level: 1, name: subject.title })).toBeInTheDocument();
    expect(screen.getByText(/Stage 1 \/ 10 · Understand/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Say the problem back in your own words/,
      }),
    ).toBeInTheDocument();

    // Every gate is visible AS a gate — a withheld thing the learner cannot see is
    // indistinguishable from a thing that does not exist.
    for (const label of [
      'Hints',
      'Pattern',
      'Problem family',
      'What this problem tests',
      'Intended bounds',
      'Follow-ups',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/Unlocks once you have committed to an approach/)).toBeInTheDocument();
  });

  test('nothing gated leaks at the first stage', () => {
    renderWithStore(<InterviewPage />, interviewStore());
    const body = document.body.textContent ?? '';

    for (const leaked of gatedStrings()) {
      expect(body).not.toContain(leaked);
    }
    // The recorded bounds are withheld too, even though the question carries them.
    expect(body).not.toMatch(/Time O\(/);
    for (const followUp of followUps) {
      expect(body).not.toContain(followUp.question);
    }
  });

  test('the pattern appears only once the learner has committed to an approach', () => {
    renderWithStore(<InterviewPage />, interviewStore({ stage: 'approach' }));

    expect(screen.queryByText(patternName)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /I have an approach/i }));

    expect(screen.getByText(/Stage 4 \/ 10 · Brute force/)).toBeInTheDocument();
    expect(screen.getByText(patternName)).toBeInTheDocument();
  });

  test('hints are locked before the approach stage and open from it', () => {
    const store = interviewStore();
    renderWithStore(<InterviewPage />, store);

    expect(screen.getByRole('button', { name: /need a hint/i })).toBeDisabled();
    expect(screen.queryByText(family.signals[0]!)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /I've restated it/i }));
    fireEvent.click(screen.getByRole('button', { name: /I've asked my questions/i }));

    const hintButton = screen.getByRole('button', { name: /need a hint/i });
    expect(hintButton).not.toBeDisabled();
    fireEvent.click(hintButton);

    // The rung is the family's own recognition cues — there is no second hint corpus.
    expect(screen.getByText(family.signals[0]!)).toBeInTheDocument();
    expect(store.getState().progress.byId[subject.id]?.hintLevelUsed).toBe(1);
  });

  test('the intended bounds stay shut while the learner is asked to state their own', () => {
    renderWithStore(<InterviewPage />, interviewStore({ stage: 'complexity' }));

    expect(
      screen.getByRole('heading', { level: 2, name: /State the time and space bounds/ }),
    ).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/Time O\(/);
    expect(screen.getByText(/Unlocks once you have stated your own/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /I've stated the bounds/i }));

    expect(
      screen.getByText(`Time ${subject.complexity!.time} · Space ${subject.complexity!.space}`),
    ).toBeInTheDocument();
    expect(screen.getByText(followUps[0]!.question)).toBeInTheDocument();
  });

  test('"Check my reasoning" offers stage craft, not the answer', () => {
    renderWithStore(<InterviewPage />, interviewStore());

    expect(screen.queryByText(/Name the input and its shape/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check my reasoning/i }));

    expect(screen.getByText(/Name the input and its shape/)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain(family.idea);
  });
});

describe('InterviewPage — the hint gate', () => {
  test('the button is disabled by the gate and never by a missing family', () => {
    // `canTakeHint` used to include `hintLevelUsed < hints.length`, so a question outside the
    // family map — no ladder, length 0 — kept the button disabled the instant the approach stage
    // unlocked hints. That announced "this one has no mapped family" three stages before the
    // family gate opens, through a control nobody had pressed.
    const store = makeStore({
      interview: {
        questionId: familyless.id,
        stage: 'approach',
        stageOutcomes: {},
        selfAssessment: {},
        elapsedSec: 0,
        startedAtMs: null,
        hintsAtStart: 0,
        hintsTaken: 0,
        startedOn: TODAY,
        finishedOn: null,
      },
    });
    renderWithStore(<InterviewPage />, store);

    const button = screen.getByRole('button', { name: /need a hint/i });
    expect(button).not.toBeDisabled();

    // Pressing it says so out loud instead of encoding the fact in a dead control.
    fireEvent.click(button);
    expect(screen.getByText(/no mapped family/)).toBeInTheDocument();
  });

  test('a ladder opened on another day starts closed, and is not billed to this sitting', () => {
    // `hintLevelUsed` is the all-time deepest rung. Reading it as the sitting's position rendered
    // the whole ladder open the moment the gate lifted — defeating the one mechanism interview
    // mode has — and then reported three hints taken in a sitting that took none.
    const store = interviewStore({ stage: 'approach', hintsAtStart: 3 });
    act(() => {
      store.dispatch(revealHint(subject.id, 3)); // as if from the question sheet, weeks ago
    });
    renderWithStore(<InterviewPage />, store);

    expect(screen.queryByText(family.signals[0]!)).not.toBeInTheDocument();
    expect(screen.getByText(/the ladder is closed/i)).toBeInTheDocument();

    // And it still opens, one rung at a time, from the gated control.
    fireEvent.click(screen.getByRole('button', { name: /need a hint/i }));
    expect(screen.getByText(family.signals[0]!)).toBeInTheDocument();
    expect(store.getState().interview.hintsTaken).toBe(1);
  });

  test('the debrief counts the rungs this sitting opened, not the ones the question remembers', () => {
    const store = interviewStore({ finishedOn: TODAY, hintsAtStart: 3, hintsTaken: 0 });
    act(() => {
      store.dispatch(revealHint(subject.id, 3));
    });
    renderWithStore(<InterviewPage />, store);

    expect(screen.getByText('0 of 3')).toBeInTheDocument();
    expect(screen.getByText('Untouched this sitting')).toBeInTheDocument();
  });

  test('beginning an interview snapshots the hint record the question already carried', () => {
    const store = makeStore();
    act(() => {
      store.dispatch(revealHint(proposed.id, 2));
    });
    renderWithStore(<InterviewPage />, store);

    fireEvent.click(screen.getByRole('button', { name: /begin interview/i }));

    expect(store.getState().interview.hintsAtStart).toBe(2);
    expect(store.getState().interview.hintsTaken).toBe(0);
  });
});

describe('InterviewPage — the timer', () => {
  test('shows the question\'s own recommendation and counts elapsed time up', () => {
    renderWithStore(<InterviewPage />, interviewStore());

    expect(screen.getByText(`Easy · recommended ~${subject.estimatedTime} min`)).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
    // No countdown, no deadline language anywhere on the running surface.
    expect(document.body.textContent ?? '').not.toMatch(/remaining|time left|out of time/i);
  });

  test('past the recommendation it says so once, as information', () => {
    renderWithStore(<InterviewPage />, interviewStore({ elapsedSec: 31 * 60 }));

    expect(
      screen.getByText(/past the ~12 min recommendation. That is information, not a failure/),
    ).toBeInTheDocument();
  });

  test('leaving the page keeps the minutes worked and drops the minutes away', () => {
    // The clock used to be rebuilt on mount from `elapsedSec`, which was written only at stage
    // transitions — so on this lazy route, navigating away and back discarded everything since
    // the last one, and a thirty-minute sitting was debriefed as ten. It also kept counting while
    // the learner was elsewhere, which is the opposite error.
    const store = interviewStore();
    const first = renderWithStore(<InterviewPage />, store);

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(screen.getByText('5:00')).toBeInTheDocument();

    first.unmount(); // navigating to another route
    expect(store.getState().interview.elapsedSec).toBe(300);
    expect(store.getState().interview.startedAtMs).toBeNull();

    act(() => {
      vi.advanceTimersByTime(40 * 60_000); // forty minutes somewhere else
    });

    renderWithStore(<InterviewPage />, store);
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });
});

describe('InterviewPage — self-report and self-assessment', () => {
  test('a stage self-report is recorded without gating the stage', () => {
    const store = interviewStore();
    renderWithStore(<InterviewPage />, store);

    const group = screen.getByRole('group', { name: 'Your own read on this stage' });
    const shaky = [...group.querySelectorAll('button')].find((b) => b.textContent === 'Shaky')!;
    fireEvent.click(shaky);

    expect(shaky).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().interview.stageOutcomes.understand).toBe('shaky');
  });

  test('finishing collects a self-assessment and says plainly that nothing judged the attempt', () => {
    const store = interviewStore({ stage: 'follow-up' });
    renderWithStore(<InterviewPage />, store);
    fireEvent.click(screen.getByRole('button', { name: /I'm done/i }));

    expect(screen.getByText('Self-assessment')).toBeInTheDocument();
    expect(
      screen.getByText(/there is no score, no grade and no verdict/),
    ).toBeInTheDocument();
    for (const label of [
      'Clarity',
      'Complexity explanation',
      'Edge cases',
      'Confidence',
      'Follow-up handling',
    ]) {
      expect(screen.getByRole('group', { name: `${label} self-rating` })).toBeInTheDocument();
    }
    // No aggregate anywhere — a total would read as a measurement of something nothing observed.
    expect(document.body.textContent ?? '').not.toMatch(
      /out of 100|\/ ?100|overall score|total score|final score|your grade/i,
    );
  });

  test('a self-assessment rating is recorded against its own dimension', () => {
    const store = interviewStore({ finishedOn: TODAY });
    renderWithStore(<InterviewPage />, store);

    const group = screen.getByRole('group', { name: 'Clarity self-rating' });
    const four = [...group.querySelectorAll('button')].find((b) => b.textContent === '4')!;
    fireEvent.click(four);

    expect(four).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().interview.selfAssessment.clarity).toBe(4);
  });

  test('the debrief opens every gate, however early the attempt ended', () => {
    renderWithStore(<InterviewPage />, interviewStore({ finishedOn: TODAY, elapsedSec: 240 }));

    // Stage is still `understand` — the attempt stopped there — but it is over, so nothing is
    // worth hiding any longer.
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
    expect(screen.getByText('4:00')).toBeInTheDocument();
    for (const revealedText of gatedStrings()) {
      expect(document.body.textContent ?? '').toContain(revealedText);
    }
    expect(screen.getByText(followUps[0]!.question)).toBeInTheDocument();
    expect(screen.getByText(followUps[0]!.because)).toBeInTheDocument();
  });

  test('"Interview another problem" returns to the landing screen', () => {
    const store = interviewStore({ finishedOn: TODAY });
    renderWithStore(<InterviewPage />, store);

    fireEvent.click(screen.getByRole('button', { name: /interview another problem/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Interview mode' })).toBeInTheDocument();
    expect(store.getState().interview.questionId).toBeNull();
  });
});

describe('InterviewPage — composition', () => {
  test('each shape spends exactly one plate (DESIGN.md § The plate rule)', () => {
    const idle = renderWithStore(<InterviewPage />);
    expect(idle.container.querySelectorAll('.glass')).toHaveLength(1);
    idle.unmount();

    const running = renderWithStore(<InterviewPage />, interviewStore());
    expect(running.container.querySelectorAll('.glass')).toHaveLength(1);
    running.unmount();

    const done = renderWithStore(<InterviewPage />, interviewStore({ finishedOn: TODAY }));
    expect(done.container.querySelectorAll('.glass')).toHaveLength(1);
  });
});
