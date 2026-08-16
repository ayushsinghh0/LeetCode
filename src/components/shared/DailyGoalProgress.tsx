import { Progress } from '@/components/ui/progress';

interface DailyGoalProgressProps {
  solvedToday: number;
  perDay: number;
  /**
   * One row instead of two: the bar and its caption side by side. For Screen-class routes
   * (Today), where the masthead band has to leave the first viewport to the hero and the plan —
   * the stacked variant costs 36px on the page whose whole job fits in ~590px of height.
   */
  dense?: boolean;
}

/**
 * The daily solve goal, as a bare ruled line.
 *
 * A progress bar already draws its own boundary, so this renders on the page ground: no plate, no
 * heading, no icon. The caption is the label — "3 / 8 solved today" needs nothing above it to say
 * what it is, and a border around it would only add a second edge to a shape that already has one.
 *
 * Shared by Today and the Dashboard so the bar and the arithmetic can never drift apart.
 */
export function DailyGoalProgress({ solvedToday, perDay, dense = false }: DailyGoalProgressProps) {
  const pct = perDay === 0 ? 0 : Math.min(100, (solvedToday / perDay) * 100);
  const met = perDay > 0 && solvedToday >= perDay;

  if (dense) {
    return (
      // `flex-wrap` + a minimum basis on the bar: at phone widths the caption drops to a second
      // line instead of squeezing the bar to nothing or pushing the row past the viewport.
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Progress value={pct} aria-label="Daily goal progress" className="min-w-[10rem] flex-1 basis-48" />
        <p className="figures shrink-0 text-xs text-muted-foreground">
          {solvedToday} / {perDay} solved today
        </p>
        {met && <p className="shrink-0 text-xs font-medium">Daily goal met — come back tomorrow.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Progress value={pct} aria-label="Daily goal progress" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="figures text-sm text-muted-foreground">
          {solvedToday} / {perDay} solved today
        </p>
        {/* Stated, not celebrated in ink: the One Ink Rule keeps the accent off running text, and
            a met goal reads clearly enough by simply being there. */}
        {met && <p className="text-sm font-medium">Daily goal met — come back tomorrow.</p>}
      </div>
    </div>
  );
}
