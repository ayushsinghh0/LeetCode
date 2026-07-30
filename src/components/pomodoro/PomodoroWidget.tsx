import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  // 'floating' (default): small glass pill, fixed bottom-right — mounted once in AppShell for
  // every page except /focus (that route sits outside AppShell entirely, see src/App.tsx, so
  // this floating copy never doubles up with the inline one below).
  // 'inline': larger, non-fixed — embedded directly in FocusPage's centered layout.
  variant?: 'floating' | 'inline';
}

export function PomodoroWidget({ variant = 'floating' }: PomodoroWidgetProps) {
  const { phase, remainingSec, isRunning, focusLenMin, breakLenMin, start, pause, skip, reset } = usePomodoro();

  const totalSec = (phase === 'break' ? breakLenMin : focusLenMin) * 60;
  const pct = totalSec > 0 ? remainingSec / totalSec : 0;
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  // Violet for focus (matches --primary), cyan for break (matches --accent) — the theme's own
  // "focus/break" hue pairing (see .text-gradient / .bg-accent-gradient in src/index.css).
  const ringColorClass = phase === 'break' ? 'text-accent' : 'text-primary';

  const isInline = variant === 'inline';

  return (
    <div
      className={cn(
        !isInline &&
          // Offset up from AchievementToast (fixed bottom-4 right-4) so an achievement toast can
          // pop in without overlapping this widget; also clears MobileNav's full-width bottom
          // bar (fixed bottom-2) on small screens.
          'fixed bottom-20 right-3 z-40 md:bottom-24 md:right-4',
      )}
    >
      <div
        role="group"
        aria-label="Pomodoro timer"
        className={cn('glass flex items-center gap-3', isInline ? 'flex-col p-8' : 'p-3')}
      >
        <div className="relative shrink-0">
          <svg viewBox="0 0 48 48" className={cn(isInline ? 'h-40 w-40' : 'h-14 w-14')}>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-mono font-semibold tabular-nums', isInline ? 'text-3xl' : 'text-xs')}>
              {formatClock(remainingSec)}
            </span>
            {isInline && <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{PHASE_LABEL[phase]}</span>}
          </div>
        </div>

        <div className={cn('flex items-center gap-1', isInline && 'flex-col gap-2')}>
          {!isInline && (
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {PHASE_LABEL[phase]}
            </span>
          )}
          <div className="flex items-center gap-1">
            {isRunning ? (
              <Button size="icon" variant="ghost" aria-label="Pause" onClick={pause}>
                <Pause />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" aria-label="Start" onClick={start}>
                <Play />
              </Button>
            )}
            <Button size="icon" variant="ghost" aria-label="Skip" disabled={phase === 'idle'} onClick={skip}>
              <SkipForward />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Reset" disabled={phase === 'idle'} onClick={reset}>
              <RotateCcw />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PomodoroWidget;
