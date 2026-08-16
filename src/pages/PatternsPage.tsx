import { useMemo, useState } from 'react';
import { Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { Link } from 'react-router-dom';
import { Panel, RuledItem, RuledList, Screen, ScreenBody, ScreenHeader } from '@/components/layout/Page';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { patternById } from '@/data/patterns';
import { useAppSelector } from '@/store/hooks';
import {
  selectPatternStats,
  selectPatternWeakness,
  selectQuestions,
  selectSolvedNewCount,
} from '@/store/selectors';
import { useToday } from '@/hooks/useToday';
import type { PatternStat } from '@/utils/engine/stats';
import type { PatternId } from '@/types';

type SortMode = 'course' | 'completion' | 'weakest';

const SORT_LABEL: Record<SortMode, string> = {
  course: 'Course order',
  completion: 'Completion %',
  weakest: 'Weakest first',
};

// Pure sort over the (already course-ordered, since patternStats maps PATTERNS in order) stats
// array. "weakest" places the weakness model's order first, then appends every pattern the model
// did not score — those are UNMEASURED, not strong (engine/weakness.ts rule 4) — and those keep
// the stats array's original course order relative to each other.
//
// `weakestFirst` is passed in rather than computed here: weakness is claimed in exactly one place
// (`selectPatternWeakness`), and this page used to run a second, contradictory formula that
// imputed a perfect pass rate and neutral confidence for unmeasured patterns, i.e. ranked them as
// if they had been tested and found wanting.
//
// Exported (rather than kept module-private) so it's directly unit-testable: it's a pure,
// dependency-free function, and nothing about verifying it is blocked by jsdom's lack of
// pointer-capture support (unlike driving the sort-mode Select open via the DOM).
export function sortStats(
  stats: PatternStat[],
  mode: SortMode,
  weakestFirst: PatternId[] = [],
): PatternStat[] {
  if (mode === 'course') return stats;
  if (mode === 'completion') return [...stats].sort((a, b) => b.pct - a.pct);

  const weakOrder = new Map(weakestFirst.map((id, i) => [id, i]));
  const eligible = stats
    .filter((s) => weakOrder.has(s.pattern))
    .sort((a, b) => weakOrder.get(a.pattern)! - weakOrder.get(b.pattern)!);
  const ineligible = stats.filter((s) => !weakOrder.has(s.pattern));
  return [...eligible, ...ineligible];
}

interface PatternRowProps {
  stat: PatternStat;
  /** Course-order chapter number — stable across re-sorts, which is what makes it an identity. */
  index: number;
}

/**
 * One pattern, as a line in a contents page: its chapter number, its ink-marked icon, its name,
 * one bar, one figure.
 *
 * This was a plate holding a four-column micro-table (solved / in revision / mastered /
 * remaining). Those four numbers are one progression, and at 375px each column got ~75px, so
 * "in revision" and "remaining" wrapped and the row rendered ragged. The progression is a bar
 * plus a fraction here; the breakdown lives on the pattern's own page, which has room for it.
 *
 * The numeral is the course position, not the current sort position — re-sorting by "weakest"
 * shuffles the rows but chapter 14 stays chapter 14, which is exactly what tells the reader the
 * list has been re-ordered.
 */
function PatternRow({ stat, index }: PatternRowProps) {
  const meta = patternById[stat.pattern];
  const Icon = iconByName(meta.icon, Shapes);

  return (
    <RuledItem className="py-0">
      <Link
        to={`/patterns/${meta.id}`}
        // py-2 + a 32px icon plate: 28 rows at the old 62px were 1,730px of contents page —
        // 12px per row buys a third of that back without touching what the row says.
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 ease-swift hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="figures w-5 shrink-0 text-right text-xs text-muted-foreground">
          {index}
        </span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
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
  const today = useToday();
  const weakness = useAppSelector((s) => selectPatternWeakness(s, today));
  const [sortMode, setSortMode] = useState<SortMode>('course');

  const weakestFirst = useMemo(() => weakness.map((w) => w.id), [weakness]);
  const sortedStats = useMemo(
    () => sortStats(stats, sortMode, weakestFirst),
    [stats, sortMode, weakestFirst],
  );

  return (
    <Screen>
      <ScreenHeader
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

      {/* The 28-row contents page scrolls inside its own panel rather than as a document: a
          chapter index is exactly the "question list panel" the brief sanctions, and the sort
          control above it stays put while you read down it. */}
      <ScreenBody>
        <Panel>
          <RuledList>
            {sortedStats.map((stat) => (
              <PatternRow
                key={stat.pattern}
                stat={stat}
                // `stats` is course-ordered (patternStats maps PATTERNS in order), so the course
                // position is the pattern's index there, not its position after sorting.
                index={stats.indexOf(stat) + 1}
              />
            ))}
          </RuledList>
        </Panel>
      </ScreenBody>
    </Screen>
  );
}
