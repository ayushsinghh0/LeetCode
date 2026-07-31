import { Progress } from '@/components/ui/progress';

interface DailyGoalProgressProps {
  solvedToday: number;
  perDay: number;
}

// The one rendering of the daily solve-goal bar — Dashboard's "Today's Progress" plate and
// TodayPage's header plate previously duplicated this markup and math with drifting details
// (figures class, goal-crushed line).
export function DailyGoalProgress({ solvedToday, perDay }: DailyGoalProgressProps) {
  const pct = perDay === 0 ? 0 : Math.min(100, (solvedToday / perDay) * 100);
  return (
    <div>
      <Progress value={pct} />
      <p className="figures mt-2 text-sm text-muted-foreground">
        {solvedToday} / {perDay} solved today
      </p>
      {perDay > 0 && solvedToday >= perDay && (
        <p className="mt-1 text-sm font-medium text-primary">Daily goal crushed — come back tomorrow 🎉</p>
      )}
    </div>
  );
}
