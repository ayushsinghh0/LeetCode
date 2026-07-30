import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';

// Shared styling + a couple of Recharts customizations that keep every chart in this app
// compliant with the `dataviz` skill, applied within the app's warm-editorial theme
// (fountain-ink + ochre series family) rather than the skill's generic default palette:
//  - Text (tooltip rows, legend labels) always stays in text tokens, never the series color.
//    Recharts' *built-in* Tooltip/Legend inline the series color directly onto the label text —
//    the "text wears the data color" anti-pattern — so both are overridden below: a colored dot
//    carries identity, the text next to it stays muted-foreground/foreground.
//  - Gridlines/axes are recessive (drawn from --border / --muted-foreground, one step off the
//    chart surface), never the loudest thing on the chart.

/**
 * The two data-series colors shared by the multi-series charts (solved vs. revisions), sourced
 * from :root/.light --chart-1/--chart-2 in index.css — the app's own ink-blue accent and its
 * ochre counterpoint, not the dataviz skill's default blue/orange/aqua palette. Both sit inside
 * the skill's per-theme categorical lightness bands (see the index.css comments) with hue
 * separation far above the CVD floor.
 */
export const CHART_COLORS = {
  solved: 'hsl(var(--chart-1))',
  revisions: 'hsl(var(--chart-2))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
  surface: 'hsl(var(--card))',
} as const;

// Status colors for the one genuinely pass/fail (good/critical) encoding in this dashboard
// (RevisionRateChart). Per the dataviz skill's collision rule, a series that *means* good/bad
// wears status tokens, never the categorical ink/ochre pair — these reference the same
// per-theme easy/hard difficulty inks the rest of the app uses for that semantic
// (DifficultyBadge, the pass/fail icons in CalendarPage's day-detail dialog).
export const STATUS_COLORS = {
  good: 'hsl(var(--easy))',
  critical: 'hsl(var(--hard))',
} as const;

// Show a date tick only every 7th category (~weekly) so 30/90 daily categories never collide.
export const WEEKLY_TICK_INTERVAL = 6;

export function formatTickDate(iso: string): string {
  return format(parseISO(iso), 'MMM d');
}

export function formatFullDate(iso: string): string {
  return format(parseISO(iso), 'EEEE, MMM d, yyyy');
}

export interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number;
  payload?: unknown;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  labelFormatter?: (label: string) => string;
  rowFormatter?: (entry: TooltipEntry) => ReactNode;
}

// Custom Recharts tooltip content (passed via `<Tooltip content={<ChartTooltip .../>} />`): a
// swatch dot carries series identity, the row text stays in text tokens. Every bar/line/area
// chart in this dashboard uses this instead of Recharts' default tooltip.
export function ChartTooltip({ active, payload, label, labelFormatter, rowFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label !== undefined && label !== '' && (
        <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(String(label)) : String(label)}</p>
      )}
      <div className="flex flex-col gap-0.5">
        {payload.map((entry, i) => (
          <p key={`${entry.dataKey ?? entry.name ?? i}`} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {rowFormatter ? rowFormatter(entry) : `${entry.name}: ${entry.value}`}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

export interface LegendPayloadEntry {
  value: string;
  color?: string;
}

// Custom Recharts legend content (passed via `<Legend content={renderChartLegend} />`) — same
// rationale as ChartTooltip: a colored dot carries identity, the label stays text-token colored.
export function renderChartLegend(props: { payload?: LegendPayloadEntry[] }) {
  const { payload } = props;
  if (!payload || payload.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      {payload.map((entry) => (
        <li key={entry.value} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}
