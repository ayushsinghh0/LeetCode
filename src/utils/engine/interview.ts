// Interview mode — the staged workflow, as data.
//
// A learner who can solve a problem alone and a learner who can be *interviewed* on it are not
// the same learner. The gap is not algorithmic: it is that an interview is a conversation with a
// fixed shape — restate, clarify, commit, beat the brute force, justify, code, test, cost,
// extend — and that the person opposite you does not hand over the pattern name, the trap, or the
// bound. This module is that shape written down, so the app can run the conversation instead of
// describing it.
//
// PROGRESSIVE REVEAL IS THE WHOLE MECHANISM. Everywhere else in this product, a question arrives
// with its pattern chip, its capability sentence, its hint ladder and its complexity in view —
// correct for study, useless for rehearsal, because a hint you have already read is not a hint.
// So interview mode starts with the title and nothing else, and each piece of support is attached
// to the stage that earns it (`REVEALS` below). The gates are modelled as data rather than
// scattered through JSX for one practical reason: a leak is then a failing test, not a code
// review someone has to notice.
//
// Pure and deterministic like every engine module: no clock, no store, no React. The elapsed
// seconds and the ISO dates arrive from the caller.
import type { Complexity, PatternId, ProblemFamily, Question } from '@/types';
import { hashSeed, mulberry32, seededShuffle } from '@/utils/engine/prng';

/* ------------------------------------------------------------------------------------------- */
/* Stages                                                                                       */
/* ------------------------------------------------------------------------------------------- */

export type StageId =
  | 'understand'
  | 'clarify'
  | 'approach'
  | 'brute-force'
  | 'optimize'
  | 'invariant'
  | 'implement'
  | 'test'
  | 'complexity'
  | 'follow-up';

/** The things interview mode withholds at the start. Each is attached to exactly one stage. */
export type RevealId = 'hints' | 'pattern' | 'family' | 'tests' | 'complexity' | 'follow-ups';

export interface InterviewStage {
  id: StageId;
  /** Short name for the stage rail. */
  label: string;
  /** What the learner is asked to do, in the interviewer's voice. The stage's headline. */
  prompt: string;
  /** The one thing they self-report before moving on — a question about them, not the problem. */
  reports: string;
  /**
   * The control that leaves this stage. Written as the learner would say it out loud, which is
   * why "I'm ready to code" sits on `invariant` and not on `implement`: the button names the
   * transition, not the destination.
   */
  advance: string;
  /**
   * What a good answer here contains. Shown only when "Check my reasoning" is pressed — this is
   * stage-level craft advice (ten entries, authored once), never per-problem guidance.
   */
  check: string[];
  /** What reaching this stage unlocks. Empty on the stages that gate nothing. */
  reveals: RevealId[];
}

/**
 * The ten stages, in order.
 *
 * The order is not decorative. `brute-force` sits after `approach` because an interviewer would
 * rather see a slow correct plan than a silent search for the fast one; `invariant` sits before
 * `implement` because code written before you can say why it terminates is code you will debug
 * on the whiteboard; `complexity` sits after `test` because a bound you state before running the
 * example is a guess.
 */
export const STAGES: InterviewStage[] = [
  {
    id: 'understand',
    label: 'Understand',
    prompt: 'Say the problem back in your own words — inputs, output, and what makes an answer correct.',
    reports: 'Could you restate it without rereading the statement?',
    advance: "I've restated it",
    check: [
      'Name the input and its shape, then the output and its shape.',
      'Work one small example by hand, all the way to the answer.',
      'Say what would make an answer wrong, as distinct from merely slow.',
    ],
    reveals: [],
  },
  {
    id: 'clarify',
    label: 'Clarify',
    prompt: 'Ask the questions you would ask a real interviewer, before you write anything down.',
    reports: 'Did you find a question whose answer would change your solution?',
    advance: "I've asked my questions",
    check: [
      'Ranges: how large can the input get, and what values may it hold?',
      'Degenerate inputs: empty, one element, everything identical.',
      'Is the input sorted, distinct, or mutable — and are you allowed to change it?',
    ],
    reveals: [],
  },
  {
    id: 'approach',
    label: 'Approach',
    prompt: 'Commit out loud: which technique does this want, and what in the statement told you so?',
    reports: 'Did you name a technique, or are you still searching for one?',
    advance: 'I have an approach',
    check: [
      'Name the technique before you defend it — "I would sort, then…" is a plan; "let me think" is not.',
      'Say which phrase in the statement pointed you there.',
      'A wrong commitment you can defend beats a silent search for the right one.',
    ],
    // Help arrives here and not earlier. Before this point the task is to read and to ask, and a
    // hint there answers a question the learner has not asked yet.
    reveals: ['hints'],
  },
  {
    id: 'brute-force',
    label: 'Brute force',
    prompt: 'State the obvious slow solution and what it costs. Never leave the board empty.',
    reports: 'Do you have a solution you could code right now, however slow?',
    advance: 'Brute force is clear',
    check: [
      'Describe it in one sentence — "try every pair and keep the best" is enough.',
      'Give its bound out loud, even if it is embarrassing.',
      'Say which part of it is doing repeated work; that is where the optimization starts.',
    ],
    // You have committed. Now find out whether the name you reached for was the right one — the
    // single most useful diagnostic in the whole flow, and worthless if shown a moment earlier.
    reveals: ['pattern'],
  },
  {
    id: 'optimize',
    label: 'Optimize',
    prompt: 'What is the brute force recomputing, and what would you have to remember to stop it?',
    reports: 'Did you beat the brute-force bound, or argue that you cannot?',
    advance: 'I have a better bound',
    check: [
      'Point at the repeated work before you name the structure that removes it.',
      'Sorting, hashing, two pointers and a heap are four different ways to buy order — say which you are buying.',
      '"This is already optimal because every element must be read" is a complete answer.',
    ],
    reveals: [],
  },
  {
    id: 'invariant',
    label: 'Invariant',
    prompt: 'State the invariant: what is true every time round the loop, and why does that make the answer right?',
    reports: 'Can you say why it is correct, rather than that it passed your example?',
    advance: "I'm ready to code",
    check: [
      'Say what the loop variables mean at the top of each iteration.',
      'Say why the invariant survives one step.',
      'Say why the invariant plus the exit condition gives the answer.',
    ],
    // The family's idea, cues and trap explain *why* the invariant holds. It lands once the
    // learner has been asked to produce one themselves.
    reveals: ['family'],
  },
  {
    id: 'implement',
    label: 'Implement',
    prompt: 'Write it. Narrate as you go, and keep the names honest enough to read back.',
    reports: 'Did it come out in one pass, or did you restart?',
    advance: 'It runs',
    check: [
      'Handle the degenerate input first so it stops being a special case later.',
      'Say each line as you write it — silence is where interviews go quiet and stay quiet.',
      'If you are stuck on syntax, say so and keep going in pseudocode.',
    ],
    // The capability sentence — "what am I actually learning here" — is a spoiler before the
    // approach is settled and useful context once the code is being written.
    reveals: ['tests'],
  },
  {
    id: 'test',
    label: 'Test',
    prompt: 'Walk your own code by hand: the smallest input first, then the nastiest one you can think of.',
    reports: 'Did you find the bug yourself, before being told there was one?',
    advance: "I've walked the edge cases",
    check: [
      'Empty, single element, all equal, already sorted, reverse sorted.',
      'Off-by-one at both ends, and the moment the loop exits.',
      'Overflow, negative numbers, and whether the input was allowed to be mutated.',
    ],
    reveals: [],
  },
  {
    id: 'complexity',
    label: 'Complexity',
    prompt: 'State the time and space bounds, and say where each one comes from.',
    reports: 'Could you point at the line each bound comes from?',
    advance: "I've stated the bounds",
    check: [
      'Time first, then space, then whether the input itself counts toward space.',
      'Name the dominant term rather than adding everything up.',
      'If a bound is amortized or average-case, say the word.',
    ],
    // Deliberately reveals nothing: the authored bound appears only after the learner has
    // committed to their own. Showing it here would be handing over the answer to this stage.
    reveals: [],
  },
  {
    id: 'follow-up',
    label: 'Follow-ups',
    prompt: 'The interviewer changes the problem. Take each one and say what breaks and what you would do.',
    reports: 'Could you answer them without starting the solution over?',
    advance: "I'm done",
    check: [
      'Say what still holds before you say what breaks.',
      'A follow-up you cannot solve is still worth a trade-off out loud.',
      '"That changes the invariant, so I would need…" is the sentence they are listening for.',
    ],
    reveals: ['complexity', 'follow-ups'],
  },
];

export const stageById: Record<StageId, InterviewStage> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, InterviewStage>;

export const FIRST_STAGE: StageId = STAGES[0]!.id;
export const LAST_STAGE: StageId = STAGES[STAGES.length - 1]!.id;

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((s) => s.id === id);
}

/** The next stage, or `null` at the end of the workflow — the caller finishes the attempt there. */
export function nextStage(id: StageId): StageId | null {
  const next = STAGES[stageIndex(id) + 1];
  return next ? next.id : null;
}

/** Has the learner got at least as far as `target`? */
export function isStageReached(target: StageId, current: StageId): boolean {
  return stageIndex(current) >= stageIndex(target);
}

/* ------------------------------------------------------------------------------------------- */
/* Reveals                                                                                      */
/* ------------------------------------------------------------------------------------------- */

export interface Reveal {
  id: RevealId;
  label: string;
  /** The stage that unlocks it. Reaching that stage is enough; the learner need not finish it. */
  revealAt: StageId;
  /** Shown while it is still locked. Names the gate — never a word of the content behind it. */
  locked: string;
}

/**
 * Every gated piece of support, and what earns it.
 *
 * Derived from STAGES rather than restated, so the two can never disagree: a reveal exists here
 * if and only if some stage claims it. The `locked` lines are the visible half of the contract —
 * a learner should always be able to see that something is being withheld and what would unlock
 * it, because a gate you cannot see is indistinguishable from missing content.
 */
const REVEAL_COPY: Record<RevealId, { label: string; locked: string }> = {
  hints: {
    label: 'Hints',
    locked: 'Unlocks once you are being asked to commit to an approach.',
  },
  pattern: {
    label: 'Pattern',
    locked: 'Unlocks once you have committed to an approach — naming it for you first would be answering the question.',
  },
  family: {
    label: 'Problem family',
    locked: 'Unlocks once you have been asked for the invariant yourself.',
  },
  tests: {
    label: 'What this problem tests',
    locked: 'Unlocks once you are writing code, when it is context rather than a spoiler.',
  },
  complexity: {
    label: 'Intended bounds',
    locked: 'Unlocks once you have stated your own — otherwise you would be reading them, not deriving them.',
  },
  'follow-ups': {
    label: 'Follow-ups',
    locked: 'Unlocks at the follow-up stage.',
  },
};

export const REVEALS: Reveal[] = STAGES.flatMap((stage) =>
  stage.reveals.map((id) => ({ id, revealAt: stage.id, ...REVEAL_COPY[id] })),
);

export const revealById: Record<RevealId, Reveal> = Object.fromEntries(
  REVEALS.map((r) => [r.id, r]),
) as Record<RevealId, Reveal>;

/**
 * Is `reveal` visible yet?
 *
 * `finished` unlocks everything unconditionally. The gate protects the *attempt*; once the
 * attempt is over there is nothing left to protect, and a debrief that still hides the answer to
 * a question the learner has stopped answering is just an app being clever at them.
 */
export function isRevealed(reveal: RevealId, current: StageId, finished = false): boolean {
  if (finished) return true;
  return isStageReached(revealById[reveal].revealAt, current);
}

/* ------------------------------------------------------------------------------------------- */
/* Self-report                                                                                  */
/* ------------------------------------------------------------------------------------------- */

/** How the learner rates their own work at a stage. Optional everywhere — never a gate. */
export type StageOutcome = 'solid' | 'shaky' | 'stuck';

export const STAGE_OUTCOME_LABEL: Record<StageOutcome, string> = {
  solid: 'Solid',
  shaky: 'Shaky',
  stuck: 'Stuck',
};

export const STAGE_OUTCOMES: StageOutcome[] = ['solid', 'shaky', 'stuck'];

/* ------------------------------------------------------------------------------------------- */
/* Timer                                                                                        */
/* ------------------------------------------------------------------------------------------- */

export interface PaceReading {
  elapsedSec: number;
  elapsedMin: number;
  /** The question's own authored estimate. A recommendation, never a limit. */
  recommendedMin: number;
  over: boolean;
  overByMin: number;
}

export function paceReading(elapsedSec: number, recommendedMin: number): PaceReading {
  const elapsedMin = Math.floor(Math.max(elapsedSec, 0) / 60);
  return {
    elapsedSec: Math.max(elapsedSec, 0),
    elapsedMin,
    recommendedMin,
    over: elapsedMin >= recommendedMin,
    overByMin: Math.max(0, elapsedMin - recommendedMin),
  };
}

/**
 * The one line shown when the recommendation has passed, or `null` while inside it.
 *
 * Deliberately counts up rather than down, states a fact rather than a verdict, and is the only
 * thing the timer ever says. A countdown, a colour change or a sound would turn a practice
 * session into an exam nobody chose to sit — and the learner already knows they are slow.
 */
export function paceNote(reading: PaceReading): string | null {
  if (!reading.over) return null;
  if (reading.overByMin === 0) {
    return `You are at the ~${reading.recommendedMin} min mark. Keep going — the clock is here to be noticed, not obeyed.`;
  }
  const unit = reading.overByMin === 1 ? 'minute' : 'minutes';
  return `${reading.overByMin} ${unit} past the ~${reading.recommendedMin} min recommendation. That is information, not a failure — real interviews run long too.`;
}

/** `m:ss`, or `h:mm:ss` once an interview has genuinely run past the hour. */
export function formatElapsed(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/* ------------------------------------------------------------------------------------------- */
/* Self-assessment                                                                              */
/* ------------------------------------------------------------------------------------------- */

export type SelfAssessmentId = 'clarity' | 'complexity' | 'edge-cases' | 'confidence' | 'follow-ups';

export interface SelfAssessmentPrompt {
  id: SelfAssessmentId;
  label: string;
  question: string;
  /** Anchors for 1 and 5, so the same number means the same thing on the next attempt. */
  low: string;
  high: string;
}

/**
 * The five things a learner can honestly judge about their own attempt.
 *
 * NOTE, and it is the point of this whole section: there is no automated judge anywhere in this
 * feature and there must never be one. Nothing here reads the learner's code, hears their
 * explanation, or has any access to what actually happened in the room. So the numbers are
 * labelled as self-assessment everywhere they appear, and this module deliberately exports no
 * total, no average and no grade — a single number derived from five self-reports looks like a
 * measurement, and the app would be inventing an assessment it is in no position to make.
 */
export const SELF_ASSESSMENT: SelfAssessmentPrompt[] = [
  {
    id: 'clarity',
    label: 'Clarity',
    question: 'How clearly did you explain your thinking as you went?',
    low: 'Mostly silent',
    high: 'Narrated throughout',
  },
  {
    id: 'complexity',
    label: 'Complexity explanation',
    question: 'How well could you justify your time and space bounds?',
    low: 'Guessed at them',
    high: 'Derived them from the code',
  },
  {
    id: 'edge-cases',
    label: 'Edge cases',
    question: 'How thoroughly did you find the awkward inputs yourself?',
    low: 'Missed the obvious ones',
    high: 'Found them before testing',
  },
  {
    id: 'confidence',
    label: 'Confidence',
    question: 'How steady did you feel while working through it?',
    low: 'Rattled',
    high: 'Composed',
  },
  {
    id: 'follow-ups',
    label: 'Follow-up handling',
    question: 'How well did you take the changed problem without starting over?',
    low: 'Had to rebuild from scratch',
    high: 'Adapted the existing solution',
  },
];

export const SELF_ASSESSMENT_SCALE = [1, 2, 3, 4, 5] as const;
export type SelfAssessmentValue = (typeof SELF_ASSESSMENT_SCALE)[number];

export function isSelfAssessmentValue(value: number): value is SelfAssessmentValue {
  return (SELF_ASSESSMENT_SCALE as readonly number[]).includes(value);
}

/* ------------------------------------------------------------------------------------------- */
/* Follow-ups                                                                                   */
/* ------------------------------------------------------------------------------------------- */

// Follow-ups are DERIVED, exactly like the hint ladder in engine/hints.ts, and for the same
// reason: there is no honest surface on which to write realistic follow-up questions for 539
// problems, and a corpus that large would drift out of agreement with the family pages within one
// release. So instead of authoring answers, this section names the seven *axes* along which real
// interviewers actually extend a problem, and then asks the dataset which of them are live here.
//
// Every axis is selected by evidence the repo already asserts:
//
//   memory      <- complexity.space is not O(1); the intended solution genuinely allocates.
//   scale       <- complexity.time is worse than linearithmic (a caret or a factorial in n).
//   streaming   <- the pattern's standard solution needs the whole input, or random access to it.
//   duplicates  <- the family text leans on the input being distinct, or the pattern is one whose
//                  canonical follow-up is literally the with-duplicates variant.
//   constraints <- the family names a trap (traps exist *because* of a constraint), or the
//                  question is catalogued as a `variant`, which is that idea by definition.
//   dynamic     <- the question is a `design` problem, or its pattern builds a structure over the
//                  input, so "now the input changes" is the next thing an interviewer says.
//   queries     <- the answer costs more than O(1) and the problem is not already a query service.
//
// A question with no mapped family therefore gets genuinely fewer follow-ups, and the UI says so
// rather than padding the gap — the same contract `hintsFor` keeps when it returns `[]`.

export type FollowUpAxis =
  | 'memory'
  | 'scale'
  | 'streaming'
  | 'duplicates'
  | 'constraints'
  | 'dynamic'
  | 'queries';

export interface FollowUp {
  axis: FollowUpAxis;
  label: string;
  /** What the interviewer asks. Phrased as speech, because it is meant to be answered out loud. */
  question: string;
  /** Why this axis is live for THIS problem. Always points at the data that selected it. */
  because: string;
}

/**
 * How many an attempt is shown. Four is what a real follow-up round has room for; a wall of seven
 * would be a checklist, and a checklist is the thing this feature exists to not be.
 */
export const MAX_FOLLOW_UPS = 4;

/**
 * Fixed presentation order — family-grounded axes first, because they are the ones that carry
 * verified content, and the cap should bite on the generic ones.
 */
const AXIS_ORDER: FollowUpAxis[] = [
  'constraints',
  'duplicates',
  'memory',
  'scale',
  'streaming',
  'dynamic',
  'queries',
];

/**
 * Patterns whose standard solution needs the whole input in hand — random access, a sort, or a
 * second pass over stored elements. "What if it arrives as a stream?" is a real question for
 * these and a non-question for the ones (heaps, running counters) that already handle one.
 */
const NEEDS_WHOLE_INPUT: ReadonlySet<PatternId> = new Set<PatternId>([
  'two-pointers',
  'modified-binary-search',
  'sort-search',
  'intervals',
  'matrices',
  'cyclic-sort',
  'subsets',
  'backtracking',
  'dynamic-programming',
]);

/** Patterns that build a structure over the input, so mutation of the input is the next question. */
const BUILDS_A_STRUCTURE: ReadonlySet<PatternId> = new Set<PatternId>([
  'custom-data-structures',
  'trie',
  'union-find',
  'intervals',
]);

/** Patterns whose canonical next problem is literally the with-duplicates variant. */
const DUPLICATE_SENSITIVE: ReadonlySet<PatternId> = new Set<PatternId>(['subsets', 'cyclic-sort']);

const DISTINCTNESS = /\b(distinct|unique|uniqueness|no duplicates|duplicate-free)\b/i;

// `O((log n)^2)` carries a caret and is still logarithmic, so the log-power form is removed before
// the test. What survives — n^2, 2^n, n!, 4^n, n*sqrt(n) — is genuinely worse than linearithmic.
const LOG_POWER = /\(\s*log[^)]*\)\s*\^\s*\d+/gi;

function allocates(complexity: Complexity | undefined): boolean {
  return complexity !== undefined && complexity.space.replace(/\s+/g, '') !== 'O(1)';
}

function costsMoreThanConstant(complexity: Complexity | undefined): boolean {
  return complexity !== undefined && complexity.time.replace(/\s+/g, '') !== 'O(1)';
}

function worseThanLinearithmic(complexity: Complexity | undefined): boolean {
  if (!complexity) return false;
  const time = complexity.time.replace(LOG_POWER, '');
  return /\^|!|sqrt/.test(time);
}

/**
 * The follow-up round for one question, most grounded first, capped at `MAX_FOLLOW_UPS`.
 *
 * `family` is optional and its absence is a real answer, not a failure: 101 of the 539 questions
 * sit outside the family map, and those attempts get a shorter round from the question's own
 * pattern, type and complexity rather than invented material.
 */
export function followUpsFor(question: Question, family: ProblemFamily | undefined): FollowUp[] {
  const found: FollowUp[] = [];
  const { complexity, pattern, type } = question;

  // --- constraints -------------------------------------------------------------------------
  // The family's `trap` is the tempting wrong turn, and a wrong turn is tempting precisely
  // because some constraint currently rules it out. Removing that constraint is the follow-up.
  if (family) {
    found.push({
      axis: 'constraints',
      label: 'Changed constraints',
      question:
        'Suppose I drop the constraint your approach leans on. Which one is it, and what do you switch to when it is gone?',
      because: `Its family names the trap: "${family.trap}" — a trap only exists while some constraint holds.`,
    });
  } else if (type === 'variant') {
    found.push({
      axis: 'constraints',
      label: 'Changed constraints',
      question:
        'One constraint in the statement is doing all the work. Which one is it, and what breaks when I remove it?',
      because: 'Catalogued as a variant — one changed constraint breaking the standard solution is what it tests.',
    });
  }

  // --- duplicates --------------------------------------------------------------------------
  const familyText = family ? [family.idea, family.trap, ...family.signals].join(' ') : '';
  if (family && DISTINCTNESS.test(familyText)) {
    found.push({
      axis: 'duplicates',
      label: 'Duplicate inputs',
      question: 'Now the input may contain repeats. Does the answer change, and does your loop still terminate?',
      because: 'Its family description leans on the input being distinct.',
    });
  } else if (DUPLICATE_SENSITIVE.has(pattern)) {
    found.push({
      axis: 'duplicates',
      label: 'Duplicate inputs',
      question: 'Now the input may contain repeats. Does the answer change, and does your loop still terminate?',
      because: 'The with-duplicates version is the standard next problem for this technique.',
    });
  }

  // --- memory ------------------------------------------------------------------------------
  if (allocates(complexity)) {
    found.push({
      axis: 'memory',
      label: 'Memory reduction',
      question: `You are using ${complexity!.space} extra space. Can you get that lower, or convince me it cannot go lower?`,
      because: `The intended solution allocates ${complexity!.space}.`,
    });
  }

  // --- scale -------------------------------------------------------------------------------
  if (worseThanLinearithmic(complexity)) {
    found.push({
      axis: 'scale',
      label: 'Larger input',
      question: `n is now a billion. Where does ${complexity!.time} stop being acceptable, and what would you trade to survive it?`,
      because: `The intended bound is ${complexity!.time} — scale is the first thing that breaks it.`,
    });
  }

  // --- streaming ---------------------------------------------------------------------------
  if (NEEDS_WHOLE_INPUT.has(pattern)) {
    found.push({
      axis: 'streaming',
      label: 'Streaming input',
      question: 'The input now arrives one element at a time and you cannot go back. What survives, and what has to change?',
      because: 'The intended approach needs the whole input in hand; a stream takes that away.',
    });
  }

  // --- dynamic -----------------------------------------------------------------------------
  if (type === 'design') {
    found.push({
      axis: 'dynamic',
      label: 'Dynamic updates',
      question: 'Between calls, elements are inserted and removed. What can you update in place, and what must you rebuild?',
      because: 'A design problem already serves repeated calls, so mutation is the next thing an interviewer adds.',
    });
  } else if (BUILDS_A_STRUCTURE.has(pattern)) {
    found.push({
      axis: 'dynamic',
      label: 'Dynamic updates',
      question: 'The input changes after you have built your structure. What can you update in place, and what must you rebuild?',
      because: 'This technique builds a structure over the input, so the natural next question is what happens when the input moves.',
    });
  }

  // --- queries -----------------------------------------------------------------------------
  if (type !== 'design' && costsMoreThanConstant(complexity)) {
    found.push({
      axis: 'queries',
      label: 'Multiple queries',
      question: 'I ask you the same question a thousand times over the same input. What do you precompute, and what does it cost?',
      because: `One answer costs ${complexity!.time}; a thousand cost a thousand times that unless something is cached.`,
    });
  }

  return found
    .sort((a, b) => AXIS_ORDER.indexOf(a.axis) - AXIS_ORDER.indexOf(b.axis))
    .slice(0, MAX_FOLLOW_UPS);
}

/* ------------------------------------------------------------------------------------------- */
/* The follow-up round's own record                                                             */
/* ------------------------------------------------------------------------------------------- */

/**
 * How a follow-up went, in the learner's own words.
 *
 * Three values rather than two because "I got most of the way there" is the commonest honest
 * answer to a follow-up and a yes/no forces it into a lie. "Missed" describes the answer, never
 * the person, and nothing anywhere folds these into a figure — see the anti-aggregate test.
 */
export type FollowUpOutcome = 'held' | 'partly' | 'missed';

export const FOLLOW_UP_OUTCOMES: FollowUpOutcome[] = ['held', 'partly', 'missed'];

export const FOLLOW_UP_OUTCOME_LABEL: Record<FollowUpOutcome, string> = {
  held: 'Held it',
  partly: 'Partly',
  missed: 'Not this time',
};

/* ------------------------------------------------------------------------------------------- */
/* Choosing the problem                                                                          */
/* ------------------------------------------------------------------------------------------- */

/**
 * Why this problem was put in front of the learner.
 *
 * The directive's ask is that an interview "deliberately test weaknesses without becoming
 * unfair", and the two halves pull in opposite directions. This is where the balance is struck:
 * the ORDER is evidence-led, so the strongest available reason wins; but the pool is still the
 * whole eligible dataset, every problem is offered exactly once, and a reroll always walks on.
 * The learner is never cornered by their own record.
 *
 * The basis is stated only AFTER the sitting. On the landing it would be a leak — "drawn from an
 * area your evidence marked shaky" tells you what technique is coming, which is precisely what
 * interview mode withholds, and it also turns opening the page into a verdict. The debrief is
 * where it becomes information.
 */
export type DrawBasis =
  /** Real time went into this one under a contest clock and it did not come out. */
  | 'contest-stall'
  /** The last sitting on this problem stopped before there was any code to show for it. */
  | 'interview-unfinished'
  /** Its area is one the single weakness model currently marks as not holding. */
  | 'weak-pattern'
  /** Its family holds a problem that needed the hint ladder and has not had a clean pass since. */
  | 'hint-reliant-family'
  /** No particular reason. Most draws, most days — and it says so by saying nothing. */
  | 'open-ground';

/**
 * The debrief's one sentence about why this problem. Never names the pattern (the leak fence
 * covers the landing, and naming it here would still be a weakness claim made outside the one
 * place allowed to make them), and never grades the learner for having been drawn there.
 */
export const DRAW_BASIS_NOTE: Record<DrawBasis, string | null> = {
  'contest-stall':
    'This one was chosen: real time went into it under a contest clock without a solution, and a staged sitting is the closest thing here to meeting it again properly.',
  'interview-unfinished':
    'This one was chosen because your last sitting on it stopped before the implementation stage. Meeting it again is the whole point of having stopped — nothing was lost by ending it early.',
  'weak-pattern':
    'This one was chosen from an area your recent evidence marks as not holding — which is the area an interview is most worth spending on.',
  'hint-reliant-family':
    'This one was chosen because its family holds a problem you needed the ladder for, and the idea transfers between them.',
  'open-ground': null,
};

const BASIS_ORDER: DrawBasis[] = [
  // Timed evidence first: a contest stall is the product's own grading of real minutes against no
  // solution. An unfinished sitting is the learner's own decision to stop, which is weaker
  // evidence about the problem and stronger evidence about where they got to — so it comes next.
  'contest-stall',
  'interview-unfinished',
  'weak-pattern',
  'hint-reliant-family',
  'open-ground',
];

/**
 * The stage a sitting has to reach before it counts as having been attempted properly.
 *
 * `implement` is where there is finally code, so a sitting that ended before it produced a plan
 * and no implementation — which is exactly the thing worth meeting again. Stated as a stage rather
 * than as a judgment: the learner stopping early is a fact, not a failure, and the copy that
 * quotes it says so.
 */
export const RECONSTRUCT_BELOW_STAGE = stageIndex('implement') + 1;

/**
 * Problems whose MOST RECENT sitting stopped before there was any code.
 *
 * Most recent, not any: a problem worked through to the follow-up round last week is not owed a
 * re-serve because the first attempt on it ended early a month ago. Records arrive oldest-first
 * (the channel appends), so the last entry per question wins.
 */
export function unfinishedInterviewIds(
  sittings: { questionId: number; stageReached: number }[],
): number[] {
  const latest = new Map<number, number>();
  for (const sitting of sittings) latest.set(sitting.questionId, sitting.stageReached);
  return [...latest.entries()]
    .filter(([, stageReached]) => stageReached < RECONSTRUCT_BELOW_STAGE)
    .map(([questionId]) => questionId);
}

export interface InterviewDraw {
  question: Question;
  basis: DrawBasis;
}

export interface InterviewDrawInput {
  /** Everything eligible — unsolved problems, as the landing already filters them. */
  pool: Question[];
  /** Stable seed, so a reload proposes the same problem rather than reshuffling it. */
  seed: string;
  /** Problems that stalled in recent contest sittings, from the persisted `contests` channel. */
  stalledQuestionIds: number[];
  /** Problems whose last staged sitting stopped before any code — see `unfinishedInterviewIds`. */
  unfinishedQuestionIds?: number[];
  /** The head of the ONE weakness model. This module never computes weakness itself. */
  weakPatterns: PatternId[];
  /** Families holding a question whose ladder was needed and not yet cleared by an unaided pass. */
  hintReliantFamilyIds: string[];
}

/**
 * The whole pool, most-worth-interviewing first, each with the grounds for its position.
 *
 * Deterministic: within a tier the order is a seeded shuffle, so the same day proposes the same
 * problem and "Not this one" walks a stable list rather than rolling dice again.
 */
export function interviewDraws(input: InterviewDrawInput): InterviewDraw[] {
  const { pool, seed, stalledQuestionIds, weakPatterns, hintReliantFamilyIds } = input;
  const stalled = new Set(stalledQuestionIds);
  const unfinished = new Set(input.unfinishedQuestionIds ?? []);
  const weak = new Set<PatternId>(weakPatterns);
  const hintFamilies = new Set(hintReliantFamilyIds);

  const basisOf = (question: Question): DrawBasis => {
    if (stalled.has(question.id)) return 'contest-stall';
    if (unfinished.has(question.id)) return 'interview-unfinished';
    if (weak.has(question.pattern)) return 'weak-pattern';
    if (question.familyId !== undefined && hintFamilies.has(question.familyId)) {
      return 'hint-reliant-family';
    }
    return 'open-ground';
  };

  const draws = pool.map((question) => ({ question, basis: basisOf(question) }));

  return BASIS_ORDER.flatMap((basis) =>
    seededShuffle(
      draws.filter((draw) => draw.basis === basis),
      mulberry32(hashSeed(`${seed}:${basis}`)),
    ),
  );
}
