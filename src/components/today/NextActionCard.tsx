import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, Shuffle, Sparkles, Target } from 'lucide-react';
import { toggleTask } from '@/store/actions';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { PatternChip } from '@/components/questions/PatternChip';
import { patternById } from '@/data/patterns';
import { useAppDispatch } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { selectQuestionById } from '@/store/selectors';
import { formatMinutes } from '@/utils/engine/planner';
import type { ActionKind, WorkItem } from '@/utils/engine/nextAction';

const KIND_LABEL: Record<ActionKind, string> = {
  revision: 'Recall',
  drill: 'Recognition',
  'course-review': 'Course recall',
  'course-session': 'Course',
  'new-question': 'New problem',
  task: 'Your task',
  done: 'Done',
};

const KIND_ICON: Record<ActionKind, typeof Target> = {
  revision: RotateCcw,
  drill: Target,
  'course-review': RotateCcw,
  'course-session': ArrowRight,
  'new-question': Sparkles,
  task: Check,
  done: Check,
};

/**
 * The one thing to do next.
 *
 * Everything about this plate is in service of a single decision. It shows one item, states why
 * that item and not another, sizes it, and gives a button that opens the work itself rather than
 * a page from which the work could be found. The rest of the day lives below it, deliberately
 * quieter — a surface with fourteen equal-weight choices is a surface that has handed the
 * prioritizing back to the person who opened it to avoid prioritizing.
 *
 * "Not this one" exists because a recommendation the learner cannot decline is a rail, not a
 * recommendation. It steps down the same ranked list rather than randomizing, so declining is
 * cheap and predictable.
 */
export function NextActionCard({ ranked }: { ranked: WorkItem[] }) {
  const dispatch = useAppDispatch();
  const [offset, setOffset] = useState(0);
  const [declinedFrom, setDeclinedFrom] = useState<string | null>(null);

  // A declination applies to a specific recommendation. Once the top pick changes — because
  // work was completed, a revision came due, or the day rolled over — the old offset is stale
  // and would silently park the learner in the middle of the list.
  const head = ranked[0]?.id ?? null;
  if (offset > 0 && head !== declinedFrom) {
    setOffset(0);
    setDeclinedFrom(null);
  }

  const item = ranked[Math.min(offset, ranked.length - 1)];
  if (!item) return null;

  const question = item.questionId !== undefined ? selectQuestionById(item.questionId) : undefined;
  const pattern = question ? patternById[question.pattern] : null;
  const Icon = KIND_ICON[item.kind];
  const hasAlternative = ranked.length > 1;

  return (
    <section className="glass flex flex-col gap-4 p-6" aria-label="Your next action">
      <div className="flex items-center gap-2 border-b border-border/70 pb-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Next &middot; {KIND_LABEL[item.kind]}
        </p>
        <span className="figures ml-auto text-xs text-muted-foreground">~{formatMinutes(item.minutes)}</span>
      </div>

      {/* Announced on change: "Not this one" swaps the heading and reason in place, which is
          silent to a screen reader without this. */}
      <div className="flex flex-col gap-2" aria-live="polite">
        <h2 className="text-xl font-semibold leading-snug md:text-2xl">{item.title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{item.why}</p>
      </div>

      {(question || pattern) && (
        <div className="flex flex-wrap items-center gap-2">
          {question && <DifficultyBadge difficulty={question.difficulty} />}
          {pattern && <PatternChip pattern={pattern} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* The primary action performs the work; it never navigates to a page where the work
            could be started. A question opens its sheet, a task completes in place, and only
            the genuinely elsewhere-kinds (drill, course) are links. */}
        {item.questionId !== undefined ? (
          <Button onClick={() => dispatch(activeQuestionSet(item.questionId!))}>
            {item.kind === 'revision' ? 'Recall it' : 'Start'}
          </Button>
        ) : item.taskId !== undefined ? (
          <Button onClick={() => dispatch(toggleTask(item.taskId!))}>
            <Check /> Mark done
          </Button>
        ) : (
          <Button asChild>
            <Link to={item.href}>Start</Link>
          </Button>
        )}

        {/* Wraps rather than disappearing at the end of the list: a control that unmounts under
            the cursor drops keyboard focus to <body>, and cycling is the more useful behavior
            anyway. */}
        {hasAlternative && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDeclinedFrom(head);
              setOffset((o) => (o + 1) % ranked.length);
            }}
          >
            <Shuffle /> Not this one
          </Button>
        )}
        {offset > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOffset(0);
              setDeclinedFrom(null);
            }}
          >
            Back to the top pick
          </Button>
        )}
      </div>
    </section>
  );
}
