import { Progress } from '@/components/ui/progress';

interface DailyGoalProgressProps {
  solvedToday: number;
  perDay: number;
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
export function DailyGoalProgress({ solvedToday, perDay }: DailyGoalProgressProps) {
  const pct = perDay === 0 ? 0 : Math.min(100, (solvedToday / perDay) * 100);
  const met = perDay > 0 && solvedToday >= perDay;

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
