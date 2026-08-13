import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/layout/Page';
import { usePomodoro } from '@/hooks/usePomodoro';
import { cn } from '@/utils/cn';

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PHASE_LABEL: Record<'idle' | 'focus' | 'break', string> = {
  idle: 'Ready',
  focus: 'Focus',
  break: 'Break',
};

export interface PomodoroWidgetProps {
  // 'floating' (default): fixed bottom-right — mounted once in AppShell for every page except
  // /focus (that route sits outside AppShell entirely, see src/App.tsx, so this floating copy
  // never doubles up with the inline one below). Idle it is a bare ghost button; a plate only
  // while a phase is counting.
  // 'inline': larger, non-fixed — embedded directly in FocusPage's centered layout.
  variant?: 'floating' | 'inline';
}

export function PomodoroWidget({ variant = 'floating' }: PomodoroWidgetProps) {
  const { phase, remainingSec, isRunning, focusLenMin, breakLenMin, start, pause, skip, reset } = usePomodoro();

  const totalSec = (phase === 'break' ? breakLenMin : focusLenMin) * 60;
  const pct = totalSec > 0 ? remainingSec / totalSec : 0;
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  // Ink for focus (the working accent), sage for break (the "rest" ink — same family as `easy`)
  // so the two phases stay distinguishable at a glance in both themes. The phase word is rendered
  // alongside the clock in both variants, so the ring's colour is never the only carrier.
  const ringColorClass = phase === 'break' ? 'text-easy' : 'text-primary';

  const isInline = variant === 'inline';
  // A timer that is not running has nothing to report, and a permanent plate reading "25:00 /
  // Ready" in the corner of all 18 pages is a plate that has not earned itself (DESIGN.md
  // § Composition). Idle collapses to the one thing it can offer — start — and the surface
  // materialises only once a phase is actually counting. The inline variant on /focus is exempt:
  // there the dial IS the page, so it stays whole in every phase.
  const collapsed = !isInline && phase === 'idle';

  return (
    <div
      className={cn(
        !isInline &&
          // Height budget, phones: AppShell reserves pb-28 (112px) at the foot of every page, and
          // MobileNav occupies the bottom 66px (bottom-2 + 44px tab + 12px padding + hairlines),
          // so this anchors at 80px and clears the bar by 14px in both states.
          //
          // Idle — which is how this widget spends nearly all of its life — is a bare 40px ghost
          // button whose only ink is the 16px glyph at its centre, i.e. 92–108px above the foot,
          // wholly inside that reservation. Only while a phase runs does the 54px plate appear and
          // reach 134px, floating over the tail of the page: a state the learner just started, and
          // one Reset returns it to the ghost. AchievementToast is z-50 and always draws over this.
          'fixed bottom-20 right-3 z-40 md:bottom-24 md:right-4',
      )}
    >
      {/* Announces phase transitions (focus -> break -> ready) to screen readers; changes only
          when `phase` changes, never on a tick. It sits outside the surface below so it survives
          the collapse — the return to idle is one of the transitions worth announcing. */}
      <span aria-live="polite" className="sr-only">
        {phase === 'idle' ? 'Pomodoro ready' : `${PHASE_LABEL[phase]} phase running`}
      </span>

      {collapsed ? (
        <Button size="icon" variant="ghost" aria-label="Start pomodoro" onClick={start}>
          <Play />
        </Button>
      ) : (
        <div
          role="group"
          aria-label="Pomodoro timer"
          className={cn('glass flex items-center', isInline ? 'flex-col gap-4 p-5' : 'gap-2 px-3 py-1.5')}
        >
          {/* role="timer" (implicit aria-live=off) names the countdown without announcing every
              tick; the sr-only live region above announces only phase transitions. */}
          <div
            className={cn('flex shrink-0 items-center', isInline ? 'relative' : 'gap-2')}
            role="timer"
            aria-label={`Pomodoro: ${PHASE_LABEL[phase]}, ${formatClock(remainingSec)} remaining`}
          >
            <svg viewBox="0 0 48 48" aria-hidden="true" className={cn(isInline ? 'h-40 w-40' : 'h-10 w-10')}>
              <circle cx="24" cy="24" r={RADIUS} fill="none" strokeWidth="4" className="text-muted-foreground/20" stroke="currentColor" />
              <circle
                cx="24"
                cy="24"
                r={RADIUS}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                stroke="currentColor"
                className={cn(ringColorClass, 'transition-[stroke-dashoffset] duration-300')}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 24 24)"
              />
            </svg>
            {/* Inline: the clock sits inside the 160px dial. Floating: the dial is only 40px, whose
                ~33px of clear interior cannot hold "25:00" without crossing the stroke, so the
                clock reads beside it — and gets to be text-sm rather than text-xs for the trouble. */}
            <div
              className={cn(
                'flex flex-col',
                isInline ? 'absolute inset-0 items-center justify-center gap-1' : 'gap-0.5',
              )}
            >
              <span className={cn('figures font-semibold leading-none', isInline ? 'text-3xl' : 'text-sm')}>
                {formatClock(remainingSec)}
              </span>
              {/* The shared eyebrow register rather than a local restatement of it — see Page.tsx. */}
              <Eyebrow className="leading-none">{PHASE_LABEL[phase]}</Eyebrow>
            </div>
          </div>

          {/* Labels are prefixed with "Pomodoro" (rather than plain "Start"/"Skip"/etc.) so they
              never collide, for screen-reader users or role-based queries alike, with FocusPage's
              own question-action buttons (e.g. its "Skip" = skipQuestion) when this widget is
              embedded inline right alongside them. */}
          <div className={cn('flex items-center', isInline ? 'gap-2' : 'gap-1')}>
            {isRunning ? (
              <Button size="icon" variant="ghost" aria-label="Pause pomodoro" onClick={pause}>
                <Pause />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" aria-label="Start pomodoro" onClick={start}>
                <Play />
              </Button>
            )}
            <Button size="icon" variant="ghost" aria-label="Skip pomodoro phase" disabled={phase === 'idle'} onClick={skip}>
              <SkipForward />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Reset pomodoro" disabled={phase === 'idle'} onClick={reset}>
              <RotateCcw />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PomodoroWidget;
