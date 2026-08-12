import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  CHART_COLORS,
  ChartTooltip,
  WEEKLY_TICK_INTERVAL,
  formatFullDate,
  formatTickDate,
} from '@/components/charts/chartPrimitives';

export interface ForecastDatum {
  date: string; // ISO yyyy-MM-dd
  count: number;
}

export interface ForecastChartProps {
  data: ForecastDatum[];
}

function formatRow(entry: { value?: number | string | Array<number | string> }) {
  return `${entry.value} revision${entry.value === 1 ? '' : 's'} due`;
}

/**
 * 30-day revision-load forecast: single series, magnitude-over-time -> area, one hue (dataviz
 * skill: "trend over time -> line; area for a single series -> sequential/1 categorical"). No
 * legend box (single series — the card title already says what's plotted). The fill gradient
 * fades from a light wash near the skill's "~10% opacity, never a saturated block" spec down to
 * fully transparent, keeping the requested gradient look without a solid block of color.
 */
export function ForecastChart({ data }: ForecastChartProps) {
  const gradientId = useId();
  // Zero-filled horizon from the caller — "nothing scheduled" means all-zero, not empty.
  const hasAnyLoad = data.some((d) => d.count > 0);

  return (
    <div className="flex flex-col gap-1">
      <p className="sr-only">
        {data.length === 0
          ? 'No forecast data yet.'
          : `Forecasted revision load for ${data.length} days, from ${data[0]!.date} to ${data[data.length - 1]!.date}.`}
      </p>
      {!hasAnyLoad ? (
        <div className="flex h-64 items-center justify-center">
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled yet"
            hint="Solved questions enter the revision ladder and appear here"
          />
        </div>
      ) : (
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.solved} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART_COLORS.solved} stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              cursor={{ stroke: CHART_COLORS.solved, strokeOpacity: 0.4 }}
              content={<ChartTooltip labelFormatter={formatFullDate} rowFormatter={formatRow} />}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Revisions due"
              stroke={CHART_COLORS.solved}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.solved, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
