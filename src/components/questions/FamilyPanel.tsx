import { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { FAMILY_ROLE_LABEL, FAMILY_ROLE_ORDER } from '@/data/curriculum';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { cn } from '@/utils/cn';
import type { ProblemFamily, Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

// "Same idea" panel: the problem family this question belongs to. Siblings are ordered by
// learning role (canonical first), and recognition cues sit behind a reveal so the learner
// can try to recall the signals before reading them.
export function FamilyPanel({ family, currentQuestionId }: { family: ProblemFamily; currentQuestionId: number }) {
  const dispatch = useAppDispatch();
  const byId = useAppSelector((s) => s.progress.byId);
  const [cuesOpen, setCuesOpen] = useState(false);

  const members = [...family.members].sort(
    (a, b) => FAMILY_ROLE_ORDER.indexOf(a.role) - FAMILY_ROLE_ORDER.indexOf(b.role),
  );

  return (
    <div className="glass rounded-md p-3">
      <p className="text-sm font-medium">Same idea: {family.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{family.idea}</p>

      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-foreground"
        aria-expanded={cuesOpen}
        onClick={() => setCuesOpen((o) => !o)}
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-150 ease-swift', cuesOpen && 'rotate-180')} aria-hidden="true" />
        Recognition cues
      </button>
      {cuesOpen && (
        <div className="mt-2 space-y-1">
          <ul className="space-y-1">
            {family.signals.map((signal) => (
              <li key={signal} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Watch out:</span> {family.trap}
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1">
        {members.map(({ questionId, role }) => {
          const q = questionById.get(questionId);
          if (!q) return null;
          const solved = byId[questionId]?.status === 'solved';
          const isCurrent = questionId === currentQuestionId;
          return (
            <li key={questionId}>
              <button
                type="button"
                disabled={isCurrent}
                onClick={() => dispatch(activeQuestionSet(questionId))}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ease-swift',
                  isCurrent ? 'bg-muted' : 'hover:bg-muted',
                )}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                  {FAMILY_ROLE_LABEL[role]}
                </span>
                <span className={cn('flex-1 truncate', solved ? 'text-muted-foreground line-through decoration-1' : 'font-medium')}>
                  {q.title}
                </span>
                <DifficultyBadge difficulty={q.difficulty} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
