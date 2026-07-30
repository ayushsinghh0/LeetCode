import { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { ConfidenceRating } from '@/components/questions/ConfidenceRating';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { patternById } from '@/data/patterns';
import { useAppSelector } from '@/store/hooks';
import { selectPatternStats, selectQuestions, selectSolvedNewCount } from '@/store/selectors';
import { weakestPatterns } from '@/utils/engine/recommendations';
import type { PatternStat } from '@/utils/engine/stats';
import type { Confidence } from '@/types';

// Dynamic icon lookup: pattern.icon is a lucide-react component name stored as a plain string
// (see src/data/patterns.ts) — same approach as PatternChip.
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

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

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

interface PatternCardProps {
  stat: PatternStat;
}

function PatternCard({ stat }: PatternCardProps) {
  const meta = patternById[stat.pattern];
  const Icon = Icons[meta.icon] ?? LucideIcons.Shapes;
  const roundedConfidence = stat.avgConfidence !== null ? (Math.round(stat.avgConfidence) as Confidence) : null;

  return (
    <motion.div variants={cardVariants} whileHover={{ y: -4 }} transition={{ duration: 0.15 }}>
      <Link
        to={`/patterns/${meta.id}`}
        className="glass flex flex-col gap-3 p-4 transition-colors duration-150 ease-swift hover:border-primary/40"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold leading-snug">{meta.name}</h3>
            <p className="text-xs text-muted-foreground">{stat.total} Questions</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center text-[11px] text-muted-foreground">
          <div aria-label={`${stat.solved} solved`}>
            <p className="font-semibold text-foreground">{stat.solved}</p>
            <p>solved</p>
          </div>
          <div aria-label={`${stat.inRevision} in revision`}>
            <p className="font-semibold text-foreground">{stat.inRevision}</p>
            <p>in revision</p>
          </div>
          <div aria-label={`${stat.mastered} mastered`}>
            <p className="font-semibold text-foreground">{stat.mastered}</p>
            <p>mastered</p>
          </div>
          <div aria-label={`${stat.remaining} remaining`}>
            <p className="font-semibold text-foreground">{stat.remaining}</p>
            <p>remaining</p>
          </div>
        </div>

        <div>
          <Progress value={stat.pct} className="h-1.5" />
          <p className="mt-1 text-right text-xs text-muted-foreground">{stat.pct}%</p>
        </div>

        {roundedConfidence !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Avg. confidence</span>
            <ConfidenceRating value={roundedConfidence} />
          </div>
        )}
      </Link>
    </motion.div>
  );
}

export default function PatternsPage() {
  const questions = selectQuestions();
  const solvedCount = useAppSelector(selectSolvedNewCount);
  const stats = useAppSelector(selectPatternStats);
  const [sortMode, setSortMode] = useState<SortMode>('course');

  const sortedStats = useMemo(() => sortStats(stats, sortMode), [stats, sortMode]);

  return (
    <div className="flex flex-col gap-6">
      <header className="glass flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Patterns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {solvedCount} of {questions.length} solved across {stats.length} patterns
          </p>
        </div>

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
      </header>

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        variants={gridVariants}
        initial="hidden"
        animate="show"
      >
        {sortedStats.map((stat) => (
          <PatternCard key={stat.pattern} stat={stat} />
        ))}
      </motion.div>
    </div>
  );
}
