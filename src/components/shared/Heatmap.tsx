import { getDay, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/utils/cn';

export interface HeatmapDatum {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapProps {
  data: HeatmapDatum[];
  onSelectDate?: (date: string) => void;
}

const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted/40',
  1: 'bg-violet-900/40',
  2: 'bg-violet-700/50',
  3: 'bg-violet-500/70',
  4: 'bg-violet-400',
};

// GitHub-style layout: weeks as columns of 7 (Sunday-aligned). `data` arrives oldest-first
// (see selectHeatmapData); padding null cells onto the front aligns the very first entry onto
// its correct weekday row without reshuffling any real entries.
function buildWeeks(data: HeatmapDatum[]): (HeatmapDatum | null)[][] {
  if (data.length === 0) return [];
  const firstWeekday = getDay(parseISO(data[0].date)); // 0 = Sunday
  const padded: (HeatmapDatum | null)[] = [...Array<null>(firstWeekday).fill(null), ...data];
  const weeks: (HeatmapDatum | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  return weeks;
}

export function Heatmap({ data, onSelectDate }: HeatmapProps) {
  const weeks = buildWeeks(data);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) =>
              cell ? (
                <Tooltip key={cell.date}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${cell.count} activities on ${cell.date}`}
                      onClick={() => onSelectDate?.(cell.date)}
                      className={cn(
                        'h-3 w-3 rounded-sm transition-transform hover:scale-125',
                        LEVEL_CLASS[cell.level],
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{`${cell.count} activities on ${cell.date}`}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={di} className="h-3 w-3" aria-hidden="true" />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
