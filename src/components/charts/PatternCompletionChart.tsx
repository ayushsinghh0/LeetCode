import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PatternId } from '@/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CHART_COLORS, ChartTooltip, type TooltipEntry } from '@/components/charts/chartPrimitives';

export interface PatternCompletionDatum {
  pattern: PatternId;
  name: string;
  color: string;
  pct: number;
  solved: number;
  total: number;
}

export interface PatternCompletionChartProps {
  data: PatternCompletionDatum[];
}

const ROW_HEIGHT = 28;
// A fixed 180px label gutter eats over half the drawing area inside a 375px-wide plate, so
// narrow viewports get a compact gutter (labels ellipsize) and keep readable bars.
const Y_AXIS_WIDTH = 180;
const Y_AXIS_WIDTH_NARROW = 104;

function formatRow(entry: TooltipEntry) {
  const datum = entry.payload as PatternCompletionDatum;
  return `${datum.pct}% (${datum.solved}/${datum.total})`;
}

/**
 * Horizontal bar list, one row per pattern (28 rows), bar fill = the pattern's own established
 * brand color (src/data/patterns.ts — used app-wide for this pattern's chips/icons). Per the
 * dataviz skill's "job -> type" table this is a magnitude comparison ("pct 0-100, low -> high"),
 * whose default color job is sequential/one-hue rather than categorical — but every row already
 * carries its own text label on the Y-axis (the actual identity channel here, always in a text
 * token, never dyed by the pattern color), so hue is a decorative reinforcement of an
 * already-established per-entity color, not the reader's only way to tell rows apart. That's why
 * this chart is exempt from the categorical validator's series cap (which governs charts where
 * hue *is* the identity channel, e.g. scatter/legend forms) — a deliberate, documented departure
 * driven by the fact labels, not color, carry identity here. No legend box: a single value per
 * row, already directly labeled — a 28-swatch legend would be pure redundancy.
 */
export function PatternCompletionChart({ data }: PatternCompletionChartProps) {
  const narrow = useMediaQuery('(max-width: 640px)');
  return (
    <div className="flex flex-col gap-1">
      <p className="sr-only">
        Completion percentage for {data.length} patterns, from {data[0]?.name ?? 'none'} to{' '}
        {data[data.length - 1]?.name ?? 'none'}.
      </p>
      <div style={{ height: data.length * ROW_HEIGHT + 24 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barCategoryGap={4}
          >
            <CartesianGrid stroke={CHART_COLORS.grid} strokeOpacity={0.5} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              stroke={CHART_COLORS.axis}
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={narrow ? Y_AXIS_WIDTH_NARROW : Y_AXIS_WIDTH}
              tick={{ fontSize: narrow ? 11 : 12, fill: 'hsl(var(--foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} content={<ChartTooltip rowFormatter={formatRow} />} />
            <Bar dataKey="pct" name="Completion" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.pattern} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
