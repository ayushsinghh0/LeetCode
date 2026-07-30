import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, CalendarCheck, Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SolvedPerDayChart } from '@/components/charts/SolvedPerDayChart';
import { PatternCompletionChart } from '@/components/charts/PatternCompletionChart';
import { DifficultyChart } from '@/components/charts/DifficultyChart';
import { RevisionRateChart } from '@/components/charts/RevisionRateChart';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { patternById } from '@/data/patterns';
import { useToday } from '@/hooks/useToday';
import { useAppSelector } from '@/store/hooks';
import {
  selectDifficultyStats,
  selectForecast,
  selectPatternStats,
  selectProductivityScore,
  selectStreaks,
  selectWeakestPatterns,
} from '@/store/selectors';
import { consistency, solvedPerDaySeries } from '@/utils/engine/stats';

const ACTIVE_WINDOW_DAYS = 14;
type SolvedRange = 30 | 90;

const sectionVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function AnalyticsPage() {
  const today = useToday();
  const [range, setRange] = useState<SolvedRange>(30);

  const streaks = useAppSelector((s) => selectStreaks(s, today));
  const productivity = useAppSelector((s) => selectProductivityScore(s, today));
  const patternStats = useAppSelector(selectPatternStats);
  const difficultyStats = useAppSelector(selectDifficultyStats);
  const weakest = useAppSelector(selectWeakestPatterns);
  const forecast = useAppSelector((s) => selectForecast(s, today));
  const dayLogs = useAppSelector((s) => s.progress.dayLogs);
  const progressById = useAppSelector((s) => s.progress.byId);

  const activeDays = useMemo(
    () => Math.round(consistency(dayLogs, today, ACTIVE_WINDOW_DAYS) * ACTIVE_WINDOW_DAYS),
    [dayLogs, today],
  );

  const solvedPerDay = useMemo(() => solvedPerDaySeries(dayLogs, today, range), [dayLogs, today, range]);

  const patternCompletionData = useMemo(
    () =>
      patternStats.map((s) => ({
        pattern: s.pattern,
        name: patternById[s.pattern].name,
        color: patternById[s.pattern].color,
        pct: s.pct,
        solved: s.solved,
        total: s.total,
      })),
    [patternStats],
  );

  // Not derived from a selector: selectors.ts only exposes overallRevisionPassRate (a ratio, see
  // src/utils/engine/stats.ts) â€” no existing selector/engine function returns raw pass/fail
  // *counts*. This mirrors the same local-reduction-over-byId pattern RevisionPage.tsx already
  // uses for its own page-only aggregates (passedThisWeek, upcomingByDate).
  const revisionCounts = useMemo(() => {
    let passed = 0;
    let failed = 0;
    for (const p of Object.values(progressById)) {
      for (const ev of p.revisionHistory) {
        if (ev.passed) passed += 1;
        else failed += 1;
      }
    }
    return { passed, failed };
  }, [progressById]);

  // weakest is ascending by score (lowest/weakest first â€” see weakestPatterns doc comment).
  // Strong = the highest-scoring tail, reversed so the strongest pattern leads.
  const weakPatterns = weakest.slice(0, 3);
  const strongPatterns = weakest.slice(-3).reverse();

  return (
    <div className="flex flex-col gap-6">
      <header className="glass p-6">
        <h1 className="text-2xl font-bold text-gradient">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your progress, activity, and patterns at a glance</p>
      </header>

      <motion.div className="flex flex-col gap-6" variants={sectionVariants} initial="hidden" animate="show">
        {/* Row: streak/consistency/productivity stat cards */}
        <motion.div variants={cardVariants} className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Current streak" value={streaks.current} icon={Flame} accent={streaks.current > 0} />
          <StatCard label="Longest streak" value={streaks.longest} icon={Trophy} />
          <StatCard label="Active days (14d)" value={activeDays} icon={CalendarCheck} />
          <StatCard label="Productivity score" value={`${productivity} / 100`} icon={Gauge} />
        </motion.div>

        {/* Solved per day */}
        <motion.div variants={cardVariants} className="glass flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Solved Per Day</h2>
            <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as SolvedRange)}>
              <TabsList>
                <TabsTrigger value="30">30 days</TabsTrigger>
                <TabsTrigger value="90">90 days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <SolvedPerDayChart data={solvedPerDay} />
        </motion.div>

        {/* Pattern completion + difficulty breakdown */}
        <motion.div variants={cardVariants} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="glass flex flex-col gap-4 p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Pattern Completion</h2>
            <PatternCompletionChart data={patternCompletionData} />
          </div>
          <div className="glass flex flex-col gap-4 p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Difficulty Breakdown</h2>
            <DifficultyChart stats={difficultyStats} />
          </div>
        </motion.div>

        {/* Revision success rate + forecast */}
        <motion.div variants={cardVariants} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="glass flex flex-col gap-4 p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Revision Success Rate</h2>
            <RevisionRateChart passed={revisionCounts.passed} failed={revisionCounts.failed} />
          </div>
          <div className="glass flex flex-col gap-4 p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Revision Forecast</h2>
            <ForecastChart data={forecast} />
          </div>
        </motion.div>

        {/* Strong / weak patterns */}
        <motion.div variants={cardVariants} className="glass flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Strong & Weak Patterns</h2>
          {weakest.length === 0 ? (
            <EmptyState icon={Gauge} title="Not enough data yet" hint="Solve a few questions in a pattern to see it here" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Strongest
                </p>
                <ul className="flex flex-col gap-1.5">
                  {strongPatterns.map((w) => (
                    <li
                      key={w.pattern}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: patternById[w.pattern].color }}
                          aria-hidden="true"
                        />
                        {patternById[w.pattern].name}
                      </span>
                      <span className="text-xs text-muted-foreground">{Math.round(w.score * 100)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> Weakest
                </p>
                <ul className="flex flex-col gap-1.5">
                  {weakPatterns.map((w) => (
                    <li
                      key={w.pattern}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: patternById[w.pattern].color }}
                          aria-hidden="true"
                        />
                        {patternById[w.pattern].name}
                      </span>
                      <span className="text-xs text-muted-foreground">{Math.round(w.score * 100)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
