import { useMemo, useState } from 'react';
import { Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { Link } from 'react-router-dom';
import { Page, PageHeader, RuledItem, RuledList } from '@/components/layout/Page';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { patternById } from '@/data/patterns';
import { useAppSelector } from '@/store/hooks';
import { selectPatternStats, selectQuestions, selectSolvedNewCount } from '@/store/selectors';
import { weakestPatterns } from '@/utils/engine/recommendations';
import type { PatternStat } from '@/utils/engine/stats';

type SortMode = 'course' | 'completion' | 'weakest';

const SORT_LABEL: Record<SortMode, string> = {
  course: 'Course order',
  completion: 'Completion %',
  weakest: 'Weakest first',
};

// Pure sort over the (already course-ordered, since patternStats maps PATTERNS in order) stats
// array. "weakest" places weakestPatterns()'s ascending-score order first, then appends any
// pattern that function excluded as ineligible (< 3 solved and no revision attempts yet) —
// those keep the stats array's original course order relative to each other.
// Exported (rather than kept module-private) so it's directly unit-testable: it's a pure,
// dependency-free function, and nothing about verifying it is blocked by jsdom's lack of
// pointer-capture support (unlike driving the sort-mode Select open via the DOM).
export function sortStats(stats: PatternStat[], mode: SortMode): PatternStat[] {
  if (mode === 'course') return stats;
  if (mode === 'completion') return [...stats].sort((a, b) => b.pct - a.pct);

  const weakOrder = new Map(weakestPatterns(stats).map((w, i) => [w.pattern, i]));
  const eligible = stats
    .filter((s) => weakOrder.has(s.pattern))
    .sort((a, b) => weakOrder.get(a.pattern)! - weakOrder.get(b.pattern)!);
  const ineligible = stats.filter((s) => !weakOrder.has(s.pattern));
  return [...eligible, ...ineligible];
}

interface PatternRowProps {
  stat: PatternStat;
}

/**
 * One pattern, as a line in a contents page: its ink-marked icon, its name, one bar, one figure.
 *
 * This was a plate holding a four-column micro-table (solved / in revision / mastered /
 * remaining). Those four numbers are one progression, and at 375px each column got ~75px, so
 * "in revision" and "remaining" wrapped and the row rendered ragged. The progression is a bar
 * plus a fraction here; the breakdown lives on the pattern's own page, which has room for it.
 */
function PatternRow({ stat }: PatternRowProps) {
  const meta = patternById[stat.pattern];
  const Icon = iconByName(meta.icon, Shapes);

  return (
    <RuledItem className="py-0">
      <Link
        to={`/patterns/${meta.id}`}
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3.5 transition-colors duration-150 ease-swift hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{meta.name}</span>
            <span className="figures shrink-0 text-xs text-muted-foreground">
              {stat.solved}/{stat.total}
            </span>
          </span>
          <Progress value={stat.pct} className="h-1" aria-label={`${meta.name} completion`} />
        </span>
      </Link>
    </RuledItem>
  );
}

export default function PatternsPage() {
  const questions = selectQuestions();
  const solvedCount = useAppSelector(selectSolvedNewCount);
  const stats = useAppSelector(selectPatternStats);
  const [sortMode, setSortMode] = useState<SortMode>('course');

  const sortedStats = useMemo(() => sortStats(stats, sortMode), [stats, sortMode]);

  return (
    <Page>
      <PageHeader
        title="Patterns"
        support={`${solvedCount} of ${questions.length} solved across ${stats.length} patterns`}
        action={
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger aria-label="Sort patterns" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {SORT_LABEL[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <RuledList>
        {sortedStats.map((stat) => (
          <PatternRow key={stat.pattern} stat={stat} />
        ))}
      </RuledList>
    </Page>
  );
}
