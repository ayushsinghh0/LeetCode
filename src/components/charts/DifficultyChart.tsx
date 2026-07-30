import { ProgressRing } from '@/components/shared/ProgressRing';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import type { DifficultyStat } from '@/utils/engine/stats';

export interface DifficultyChartProps {
  stats: DifficultyStat[];
}

/**
 * Three stat tiles (per dataviz skill: "a handful of headline numbers -> KPI row of stat tiles",
 * not a bar/column chart) — one per difficulty, each a completion ring + a pass-rate line.
 * Reuses the app's existing <DifficultyBadge> for the easy/medium/hard identity + color instead
 * of inventing a new color mapping here, for exact visual consistency with how difficulty is
 * colored everywhere else in the app (question cards, filters).
 */
export function DifficultyChart({ stats }: DifficultyChartProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.difficulty} className="glass flex flex-col items-center gap-3 p-4 text-center">
          <ProgressRing value={s.solved} max={s.total} size={84} strokeWidth={7}>
            <span className="text-lg font-bold">{s.pct}%</span>
          </ProgressRing>
          <DifficultyBadge difficulty={s.difficulty} />
          <div>
            <p className="text-xs text-muted-foreground">
              {s.solved} / {s.total} solved
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pass rate: {s.revisionPassRate !== null ? `${Math.round(s.revisionPassRate * 100)}%` : '—'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
