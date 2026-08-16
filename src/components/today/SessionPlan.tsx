import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, RotateCcw, Sparkles, Target } from 'lucide-react';
import { Figures, Section, RuledList, RuledItem } from '@/components/layout/Page';
import { ChipRadioRow } from '@/components/shared/ChipRadioRow';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDailyCapacity } from '@/store/actions';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import { buildSession, SESSION_PRESETS, type ActionKind, type WorkItem } from '@/utils/engine/nextAction';
import { formatMinutes } from '@/utils/engine/planner';

const SHORT_LABEL: Record<number, string> = {
  15: '15m', 30: '30m', 60: '1h', 90: '90m', 120: '2h', 180: '3h',
};

// The plan is a timeline of *kinds* of work, and a row that does not say which kind it is makes
// the learner open it to find out. One 14px glyph carries that, which a second text column would
// not have room for at 375px. Labels stay on the hero, which has the space to spell them.
const KIND_ICON: Record<ActionKind, typeof Target> = {
  revision: RotateCcw,
  drill: Target,
  'course-review': RotateCcw,
  'ml-review': RotateCcw,
  'course-session': ArrowRight,
  'new-question': Sparkles,
  task: Check,
  done: Check,
};

const KIND_NAME: Record<ActionKind, string> = {
  revision: 'Recall',
  drill: 'Recognition',
  'course-review': 'Course recall',
  'ml-review': 'Rebuild',
  'course-session': 'Course',
  'new-question': 'New problem',
  task: 'Your task',
  done: 'Done',
};

/**
 * "I have N minutes" — fixed time, variable scope.
 *
 * The budget is the input and the plan is cut to fit it, which is the opposite of a to-do list
 * that prints a total and leaves the trimming to the reader. What does not fit is stated rather
 * than hidden: a plan that silently drops work reads as "you are done" when you are not.
 *
 * The chips write the same capacity the Settings page and the Revision session own, so today's
 * answer becomes tomorrow's default — the commitment is asked once and then remembered, not
 * re-asked every morning. One number, three places to set it, never three competing numbers.
 *
 * Composition note: this is a `Section`, not a plate. It is the support for the lead above it,
 * and giving it an outline of its own was what made the two read as siblings.
 *
 * Two defects fixed in the V9 pass, both of which had been invisible in the file and obvious on a
 * phone. First, the row: `RuledItem` documents that `padded` must be **off** when the row's own
 * child is the interactive element, and this row's child is a `<button>` — so the hover surface
 * and the focus ring covered only the 20px text band inside a 48px row, and the tap target was
 * 20px tall on the same page whose capacity chips are explicitly 44px. The control now carries the
 * padding and the row is a real 44px target. Second, the footer: two stacked paragraphs of time
 * arithmetic became one `Figures` line, because available / planned / spare are three readings of
 * one budget and reading them as a sentence is the whole point.
 */
/** Rows shown before a long plan folds; plans up to VISIBLE_ROWS + 1 never fold (a one-row latch
 *  is sillier than the row it hides). At a 3h budget the list runs past 15 rows — 600px of
 *  timeline on a page whose first viewport is the decision — while the 30–60m plans most days
 *  actually run at stay fully open. */
const VISIBLE_ROWS = 5;

export function SessionPlan({ ranked }: { ranked: WorkItem[] }) {
  const dispatch = useAppDispatch();
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);
  const [showAll, setShowAll] = useState(false);

  const session = useMemo(() => buildSession(capacityMin, ranked), [capacityMin, ranked]);

  if (ranked.length === 0) return null;

  const skippedMinutes = session.skipped.reduce((sum, i) => sum + i.minutes, 0);
  const folded = !showAll && session.items.length > VISIBLE_ROWS + 1;
  const visibleItems = folded ? session.items.slice(0, VISIBLE_ROWS) : session.items;
  const foldedMinutes = session.items.slice(VISIBLE_ROWS).reduce((sum, i) => sum + i.minutes, 0);

  return (
    // The support sentence ("Say how long you have and the list is cut to fit it…") is gone: the
    // chips' own label asks the question, the Figures line below does the arithmetic, and the
    // skipped-items sentence carries the "nothing expires" promise. Teaching copy read a hundred
    // times costs a plan row on every one of those visits.
    //
    // The chips live in the section header's action slot: the budget IS the section's one
    // control, and as a standalone row it cost 60px of the first viewport on the route with the
    // least height to spend. Below `sm` the header wraps and the chips drop under the title —
    // the same position they held as a row.
    //
    // A radiogroup, not a row of toggles: these are six mutually exclusive options, and
    // `aria-pressed` would announce six independent switches with five "not pressed" for no
    // stated reason. The shared `ChipRadioRow` carries the roving tabIndex and arrow keys the
    // radio role promises (DESIGN.md § Capacity chips); `aria-label` names the group, so no
    // visible legend is needed.
    <Section
      aria-label="Session plan"
      title="Today's plan"
      action={
        <ChipRadioRow
          label="How long have you got?"
          options={SESSION_PRESETS}
          value={capacityMin}
          onSelect={(preset) => dispatch(setDailyCapacity(preset))}
          format={(preset) => SHORT_LABEL[preset] ?? `${preset}m`}
          // No `optionLabel`: it was passed here as a function byte-identical to `format`, which
          // produced `aria-label="15m"` over visible text "15m" — an accessible name that
          // overrides the content with the same string.
          className="grid w-[21rem] max-w-full grid-cols-6"
          chipClassName="figures px-1"
        />
      }
    >

      {session.items.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing on today&apos;s list fits {formatMinutes(capacityMin)}. The smallest item left is{' '}
          ~{formatMinutes(Math.min(...session.skipped.map((i) => i.minutes)))} — pick a longer window, or
          come back when you have one.
        </p>
      ) : (
        <RuledList as="ol" aria-label="Planned work, in order">
          {visibleItems.map((item) => {
            const Icon = KIND_ICON[item.kind];
            // `lg:min-h-9`: the 44px floor is a touch-target rule, and above `lg` the pointer is
            // fine — WCAG 2.5.8's 24px holds with room. Six 44px rows were 48px of pure air on
            // the one viewport (1280×590) where every pixel is a row the learner can see.
            const rowClass =
              'flex min-h-11 w-full items-center gap-3 py-1.5 text-left text-sm transition-colors duration-150 ease-swift hover:text-primary lg:min-h-9';
            const body = (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">{KIND_NAME[item.kind]}: </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="figures shrink-0 text-xs text-muted-foreground">
                  ~{formatMinutes(item.minutes)}
                </span>
              </>
            );
            return (
              <RuledItem key={item.id} padded={false}>
                {item.questionId !== undefined ? (
                  <button
                    type="button"
                    onClick={() => dispatch(activeQuestionSet(item.questionId!))}
                    className={rowClass}
                  >
                    {body}
                  </button>
                ) : (
                  <Link to={item.href} className={rowClass}>
                    {body}
                  </Link>
                )}
              </RuledItem>
            );
          })}
          {folded && (
            <RuledItem padded={false}>
              {/* The fold row stays inside the ordered list so the timeline reads as one list to
                  a screen reader; expanding renders the remaining rows in place. One-way on
                  purpose — a session plan is minutes old, and a collapse control would be chrome
                  for a state nobody returns to. */}
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setShowAll(true)}
                className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-150 ease-swift hover:text-primary lg:min-h-9"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  Show {session.items.length - VISIBLE_ROWS} more
                </span>
                <span className="figures shrink-0 text-xs">~{formatMinutes(foldedMinutes)}</span>
              </button>
            </RuledItem>
          )}
        </RuledList>
      )}

      {/* Available, planned, spare, and what waits — one budget read four ways, so one closing
          line, wrapping where the column is narrow. The `~` hedge stays on every estimate; these
          are estimates and the copy says so. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Figures
          items={[
            { value: formatMinutes(capacityMin), label: 'available' },
            { value: `~${formatMinutes(session.totalMinutes)}`, label: 'planned' },
            ...(session.leftoverMin > 0
              ? [{ value: `~${formatMinutes(session.leftoverMin)}`, label: 'spare' }]
              : []),
          ]}
        />
        {session.skipped.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Not in this session: {session.skipped.length}{' '}
            {session.skipped.length === 1 ? 'item' : 'items'} (~{formatMinutes(skippedMinutes)}). They
            stay on the list — nothing expires.
          </p>
        )}
      </div>
    </Section>
  );
}
