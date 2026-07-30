import { ClipboardCheck } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChartTooltip, STATUS_COLORS, type TooltipEntry } from '@/components/charts/chartPrimitives';

export interface RevisionRateChartProps {
  passed: number;
  failed: number;
}

function formatRow(entry: TooltipEntry) {
  return `${entry.name}: ${entry.value}`;
}

/**
 * Overall pass rate as a hero figure (>=48px, dataviz skill) + a single horizontal stacked bar
 * (passed vs. failed). Pass/fail is a genuinely good/critical semantic, so — per the skill's
 * status-color collision rule ("when a series means good/bad it wears status tokens, never
 * categorical") — this uses the app's fixed green/red status hexes (the same ones already used
 * for revisionsPassed/revisionsFailed in CalendarPage's day-detail dialog), not the violet/cyan
 * categorical pair used elsewhere in this dashboard.
 */
export function RevisionRateChart({ passed, failed }: RevisionRateChartProps) {
  const total = passed + failed;

  if (total === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No revision attempts yet"
        hint="Pass rate appears once you complete your first revision review."
      />
    );
  }

  const pct = Math.round((passed / total) * 100);
  const data = [{ name: 'Revisions', passed, failed }];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-5xl font-bold leading-none text-gradient">{pct}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Overall pass rate ({passed} passed / {failed} failed)
        </p>
      </div>

      <div className="h-8 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            barCategoryGap={0}
          >
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip cursor={false} content={<ChartTooltip rowFormatter={formatRow} />} />
            <Bar dataKey="passed" stackId="rate" name="Passed" fill={STATUS_COLORS.good} isAnimationActive={false} />
            <Bar
              dataKey="failed"
              stackId="rate"
              name="Failed"
              fill={STATUS_COLORS.critical}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.good }} aria-hidden="true" />
          Passed ({passed})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.critical }} aria-hidden="true" />
          Failed ({failed})
        </span>
      </div>
    </div>
  );
}
