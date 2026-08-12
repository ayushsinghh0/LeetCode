import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  CHART_COLORS,
  ChartTooltip,
  WEEKLY_TICK_INTERVAL,
  formatFullDate,
  formatTickDate,
  renderChartLegend,
} from '@/components/charts/chartPrimitives';

export interface SolvedPerDayDatum {
  date: string; // ISO yyyy-MM-dd
  solved: number;
  revisions: number;
}

export interface SolvedPerDayChartProps {
  data: SolvedPerDayDatum[];
}

/**
 * Stacked bar chart: solved (ink, bottom) + revisions (ochre, top) per day. Form: "compare
 * magnitude over time, two series" -> stacked bar, categorical color (dataviz skill,
 * choosing-a-form.md). The top segment alone carries the 4px rounded data-end; the bottom
 * segment is square (baseline). A 2px surface-color stroke stands in for the "surface gap"
 * spacer between the two stacked segments — Recharts has no native gap *within* a stack (only
 * between categories, via barCategoryGap, used here too), so a stroke in the exact surface color
 * is the documented, deliberate workaround for that library limitation.
 */
export function SolvedPerDayChart({ data }: SolvedPerDayChartProps) {
  // The series is zero-filled by the caller, so "new user" means all-zero, not empty.
  const hasAnyActivity = data.some((d) => d.solved > 0 || d.revisions > 0);

  return (
    <div className="flex flex-col gap-1">
      {/* Accessible text equivalent of the chart (dataviz skill: "a table view exists"), and a
          stable, non-implementation-detail hook for tests to confirm the full date range was
          passed through (see src/pages/__tests__/analytics.test.tsx). */}
      <p className="sr-only">
        {data.length === 0
          ? 'No activity data yet.'
          : `Solved and revision counts for ${data.length} days, from ${data[0]!.date} to ${data[data.length - 1]!.date}.`}
      </p>
      {!hasAnyActivity ? (
        <div className="flex h-72 items-center justify-center">
          <EmptyState
            icon={BarChart3}
            title="No activity in this range"
            hint="Solve or revise a question and it will chart here"
          />
        </div>
      ) : (
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatTickDate}
              interval={WEEKLY_TICK_INTERVAL}
              stroke={CHART_COLORS.axis}
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              stroke={CHART_COLORS.axis}
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              content={<ChartTooltip labelFormatter={formatFullDate} />}
            />
            <Legend content={renderChartLegend} />
            <Bar dataKey="solved" stackId="day" name="Solved" fill={CHART_COLORS.solved} isAnimationActive={false} />
            <Bar
              dataKey="revisions"
              stackId="day"
              name="Revisions"
              fill={CHART_COLORS.revisions}
              radius={[4, 4, 0, 0]}
              stroke={CHART_COLORS.surface}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
