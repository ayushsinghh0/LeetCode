import type { QuestionType } from '@/types';

// Display layer for the six question types (see the QuestionType doc comment in src/types).
// The label is what the learner reads on a card; the meaning is what they get on hover or on
// the filter row, because a taxonomy nobody can decode is a taxonomy that costs attention and
// returns nothing.

export const QUESTION_TYPE_ORDER: QuestionType[] = [
  'foundation',
  'recognition',
  'implementation',
  'optimization',
  'variant',
  'design',
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  foundation: 'Foundation',
  recognition: 'Recognition',
  implementation: 'Implementation',
  optimization: 'Optimization',
  variant: 'Variant',
  design: 'Design',
};

export const QUESTION_TYPE_MEANING: Record<QuestionType, string> = {
  foundation: 'The technique in its clearest form — the version to learn it from.',
  recognition: 'The technique is disguised. The work is noticing which one applies.',
  implementation: 'The approach is obvious. The work is indices, edge cases, and care.',
  optimization: 'A brute force is easy. The work is beating its bound.',
  variant: 'A familiar problem with one constraint changed — enough to break the usual answer.',
  design: 'Build a structure that answers queries, rather than computing one answer.',
};
