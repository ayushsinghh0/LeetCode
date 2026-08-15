import { Lightbulb } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { FAMILY_ROLE_LABEL, FAMILY_ROLE_ORDER } from '@/data/curriculum';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { Disclosure, Eyebrow } from '@/components/layout/Page';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { cn } from '@/utils/cn';
import type { FamilyRole, ProblemFamily, Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

/**
 * The problem family, read as a miniature course rather than a "Related Questions" list.
 *
 * The curriculum data already carries the four things a short course needs — the core idea, the
 * statement-level signals that should trigger recognition, the tempting wrong turn, and an
 * ordered on-ramp of problems. What it did not have was a reading order, so the panel used to
 * put all of it on screen at once and let the learner sort it out.
 *
 * Now it discloses progressively: the core idea is always visible (it is the reason the family
 * exists), and signals / trap / ladder each open on request. Recall before explanation is the
 * point — a learner who can list the cues from memory has learned something a paragraph they
 * skimmed cannot tell them.
 *
 * This is the *teaching* surface. The actionable shortlist of where to go next lives in
 * ResourcePanel and PostSolvePanel, and the modal deliberately never shows both readings of the
 * same family at once.
 */

// What each on-ramp role is FOR. The transfer framing, stated per rung: the technique holds
// constant and the constraint or objective moves. Display copy, so it lives here rather than in
// the generated curriculum data.
const ROLE_MEANING: Record<FamilyRole, string> = {
  canonical: 'The reference statement of the idea — learn it here first.',
  warmup: 'A smaller version of the same move, if the canonical is fighting you.',
  standard: 'The idea at full size, stated plainly.',
  variant: 'One constraint or objective changed — enough to break the standard answer.',
  stretch: 'The idea pushed until it needs one more observation on top.',
};

// The local `Disclosure` that used to live here is gone. It shadowed the one exported from
// `Page.tsx` — same name, two feet away in the same dialog, but a ChevronDown/rotate-180 instead of
// a ChevronRight/rotate-90, a `useState` map instead of native `<details>`, and a `py-2.5` summary
// that computed to 40px against the shared component's `min-h-11`. Two components with one name and
// three differences is exactly the drift `Eyebrow` was extracted to end.

export function FamilyPanel({ family, currentQuestionId }: { family: ProblemFamily; currentQuestionId: number }) {
  const dispatch = useAppDispatch();
  const byId = useAppSelector((s) => s.progress.byId);
  const members = [...family.members].sort(
    (a, b) => FAMILY_ROLE_ORDER.indexOf(a.role) - FAMILY_ROLE_ORDER.indexOf(b.role),
  );
  const knownMembers = members.filter((m) => questionById.has(m.questionId));
  const solvedCount = knownMembers.filter(
    (m) => byId[m.questionId]?.status === 'solved',
  ).length;

  // `gap-4` — the one interior step this sheet uses (DESIGN.md § The rhythm, "inside a group").
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Same idea: {family.name}</p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{family.idea}</p>
        {/* How far through the idea the learner actually is. The ladder below has always listed
            every member; what it never said is how much of it is behind them — and "3 of 5 solved"
            is the difference between a list and a position in one. Counted over members that
            exist in the dataset, so a family whose member was renamed cannot report 4 of 5 with
            only four rows rendered. */}
        <p className="figures mt-1 text-xs text-muted-foreground">
          {solvedCount} of {knownMembers.length} solved
        </p>
      </div>

      {/* No wrapper rules: the shared `Disclosure` draws its own `border-b`. */}
      <div className="flex flex-col border-t border-border">
        <Disclosure summary="Recognition cues">
          <ul className="space-y-1.5">
            {family.signals.map((signal) => (
              <li key={signal} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </Disclosure>

        <Disclosure summary="The common trap">
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{family.trap}</p>
        </Disclosure>

        <Disclosure summary="The problem ladder" meta={`${members.length} problems`}>
          <div className="flex flex-col gap-4">
            {FAMILY_ROLE_ORDER.map((role) => {
              const inRole = members.filter((m) => m.role === role && questionById.has(m.questionId));
              if (inRole.length === 0) return null;
              return (
                <div key={role}>
                  <Eyebrow>{FAMILY_ROLE_LABEL[role]}</Eyebrow>
                  <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{ROLE_MEANING[role]}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {inRole.map(({ questionId }) => {
                      const q = questionById.get(questionId)!;
                      const solved = byId[questionId]?.status === 'solved';
                      const isCurrent = questionId === currentQuestionId;
                      return (
                        <li key={questionId}>
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => dispatch(activeQuestionSet(questionId))}
                            className={cn(
                              'flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ease-swift',
                              isCurrent ? 'bg-muted' : 'hover:bg-muted',
                            )}
                            aria-current={isCurrent ? 'true' : undefined}
                          >
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate',
                                solved ? 'text-muted-foreground line-through decoration-1' : 'font-medium',
                              )}
                            >
                              {q.title}
                            </span>
                            <DifficultyBadge difficulty={q.difficulty} variant="bare" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
