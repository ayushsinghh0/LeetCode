import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, Sparkles, Target } from 'lucide-react';
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
export function SessionPlan({ ranked }: { ranked: WorkItem[] }) {
  const dispatch = useAppDispatch();
  const capacityMin = useAppSelector((s) => s.settings.dailyCapacityMin);

  const session = useMemo(() => buildSession(capacityMin, ranked), [capacityMin, ranked]);

  if (ranked.length === 0) return null;

  const skippedMinutes = session.skipped.reduce((sum, i) => sum + i.minutes, 0);

  return (
    <Section
      aria-label="Session plan"
      title="Today's plan"
      support="Say how long you have and the list is cut to fit it. Whatever does not fit simply waits."
    >
      {/* A radiogroup, not a row of toggles: these are six mutually exclusive options, and
          `aria-pressed` would announce six independent switches with five "not pressed" for
          no stated reason.

          The `<fieldset>`/`<legend>` pair is gone: the legend restated the section's own support
          line one element below it, and `aria-label` on the radiogroup already names the control
          for anyone who cannot see where it sits. Two sentences and two containers to introduce
          six chips was the densest stack of redundancy on the page.

          It now uses the shared `ChipRadioRow`, and that is a bug fix rather than a tidy-up. This
          row declared `role="radiogroup"` and `aria-checked` but shipped no `onKeyDown` and no
          roving `tabIndex`, so all six chips sat in the tab sequence and the arrow keys did
          nothing — while DESIGN.md § Capacity chips states that "arrow-key selection is the
          contract the radio role promises" and RevisionPage's own comment claimed this row already
          carried it. Two of the three copies were right; the documented one was not. */}
      <ChipRadioRow
        label="How long have you got?"
        options={SESSION_PRESETS}
        value={capacityMin}
        onSelect={(preset) => dispatch(setDailyCapacity(preset))}
        format={(preset) => SHORT_LABEL[preset] ?? `${preset}m`}
        // The chip reads "15m"; the accessible name says what fifteen minutes is *for*, because
        // "15m" alone is not a decodable option name when read out of the row's context.
        optionLabel={(preset) => SHORT_LABEL[preset] ?? `${preset}m`}
        className="grid grid-cols-6 sm:max-w-md"
        chipClassName="figures px-1"
      />

      {session.items.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing on today&apos;s list fits {formatMinutes(capacityMin)}. The smallest item left is{' '}
          ~{formatMinutes(Math.min(...session.skipped.map((i) => i.minutes)))} — pick a longer window, or
          come back when you have one.
        </p>
      ) : (
        <RuledList as="ol" aria-label="Planned work, in order">
          {session.items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const rowClass =
              'flex min-h-11 w-full items-center gap-3 py-2 text-left text-sm transition-colors duration-150 ease-swift hover:text-primary';
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
        </RuledList>
      )}

      {/* Available, planned, spare — one budget read three ways, so one line. The `~` hedge stays
          on every estimate; these are estimates and the copy says so. */}
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
        <p className="max-w-prose text-sm text-muted-foreground">
          Not in this session: {session.skipped.length}{' '}
          {session.skipped.length === 1 ? 'item' : 'items'} (~{formatMinutes(skippedMinutes)}). They
          stay on the list — nothing expires.
        </p>
      )}
    </Section>
  );
}
