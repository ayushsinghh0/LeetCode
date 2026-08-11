import { format, parseISO } from 'date-fns';
import { Award, Lock } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { ProgressRing } from '@/components/shared/ProgressRing';
import { cn } from '@/utils/cn';
import { useAppSelector } from '@/store/hooks';
import { ACHIEVEMENTS, type AchievementDef } from '@/utils/engine/achievements';

export interface AchievementGroup {
  name: string;
  items: AchievementDef[];
}

// Every matcher's ids are mutually exclusive by prefix, so a def can match at most one of these
// 5 — Special (below) is the complement of their union, not a 6th independent matcher.
const GROUP_MATCHERS: { name: string; test: (id: string) => boolean }[] = [
  { name: 'Progress', test: (id) => id === 'first-solve' || id.startsWith('solved-') },
  { name: 'Streaks', test: (id) => id.startsWith('streak-') },
  { name: 'Patterns', test: (id) => id.startsWith('pattern-100-') },
  { name: 'Mastery', test: (id) => id === 'first-mastered' || id === 'mastered-100' },
  { name: 'Course', test: (id) => id.startsWith('course-') },
];

/**
 * Groups every def in `defs` into exactly one of 6 sections, derived from the real achievements
 * array rather than a hardcoded id-by-id list. Special is the catch-all: today that's
 * all-easy/all-medium/all-hard/perfect-revision-week/comeback, but it's computed as "whatever
 * matched none of the first 5 matchers" so a future engine addition whose id fits no prefix
 * still lands somewhere instead of being silently dropped.
 */
export function groupAchievements(defs: AchievementDef[]): AchievementGroup[] {
  const assigned = new Set<string>();
  const groups: AchievementGroup[] = GROUP_MATCHERS.map(({ name, test }) => {
    const items = defs.filter((def) => test(def.id));
    for (const item of items) assigned.add(item.id);
    return { name, items };
  });
  groups.push({ name: 'Special', items: defs.filter((def) => !assigned.has(def.id)) });
  return groups;
}

interface AchievementCardProps {
  def: AchievementDef;
  unlockedDate?: string;
}

function AchievementCard({ def, unlockedDate }: AchievementCardProps) {
  const Icon = iconByName(def.icon, Award);
  const unlocked = !!unlockedDate;

  return (
    <div
      className={cn(
        'glass relative flex flex-col items-center gap-1.5 p-4 text-center',
        // Accent border only — DESIGN.md bans glow shadows; the ink border + full opacity
        // already separate unlocked from locked cards.
        unlocked ? 'border-primary/60' : 'opacity-50',
      )}
    >
      {/* Locked state must reach AT too — the visual cues are an icon and reduced opacity. */}
      {!unlocked && (
        <span className="absolute right-2 top-2 text-muted-foreground" role="img" aria-label="Locked">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-full',
          unlocked ? 'bg-accent-gradient text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold">{def.title}</p>
      <p className="text-xs text-muted-foreground">{def.description}</p>
      {unlockedDate && (
        <p className="mt-0.5 text-xs font-medium text-primary">
          Unlocked {format(parseISO(unlockedDate), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}

export default function AchievementsPage() {
  const unlocked = useAppSelector((state) => state.gamification.unlocked);
  const unlockedCount = Object.keys(unlocked).length;
  const total = ACHIEVEMENTS.length;
  const groups = groupAchievements(ACHIEVEMENTS);

  return (
    <div className="flex flex-col gap-6">
      <div className="glass flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Achievements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unlocked {unlockedCount} / {total}
          </p>
        </div>
        <ProgressRing value={unlockedCount} max={total} size={80}>
          <span className="text-sm font-bold">
            {unlockedCount} / {total}
          </span>
        </ProgressRing>
      </div>

      {groups.map((group) => (
        <section key={group.name} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.name}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {group.items.map((def) => (
              <AchievementCard key={def.id} def={def} unlockedDate={unlocked[def.id]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
