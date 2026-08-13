import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Award } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { Button } from '@/components/ui/button';
import { Page, PageHeader, RuledItem, RuledList, Section } from '@/components/layout/Page';
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

const LOCKED_LIST_ID = 'locked-achievements';

/**
 * One earned milestone: its own icon in ink, what it was, and when. The date is the point of the
 * list — an achievements page with no dates is a checklist, not a record.
 */
function UnlockedRow({ def, date }: { def: AchievementDef; date: string }) {
  const Icon = iconByName(def.icon, Award);

  return (
    <RuledItem className="flex items-baseline gap-3">
      <Icon className="h-4 w-4 shrink-0 translate-y-0.5 text-primary" aria-hidden="true" />
      {/* The date drops under the description on phones rather than squeezing the title column. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{def.title}</p>
          <p className="text-sm text-muted-foreground">{def.description}</p>
        </div>
        <p className="figures shrink-0 text-xs text-muted-foreground">
          Unlocked {format(parseISO(date), 'MMM d, yyyy')}
        </p>
      </div>
    </RuledItem>
  );
}

/**
 * A milestone not yet earned. The `role="img"` label is what carries the locked state to assistive
 * tech — the section heading above says it visually, but a row lifted out of context (search,
 * rotor, a screen-reader list view) must still say which half of the page it came from.
 */
function LockedRow({ def }: { def: AchievementDef }) {
  const Icon = iconByName(def.icon, Award);

  return (
    <li className="flex items-baseline gap-2.5">
      <span
        className="shrink-0 translate-y-0.5 text-muted-foreground/50"
        role="img"
        aria-label="Locked"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <p className="text-sm">
        <span className="font-medium">{def.title}</span>{' '}
        <span className="text-muted-foreground">{def.description}</span>
      </p>
    </li>
  );
}

/**
 * Achievements — the record, not the scoreboard.
 *
 * The page used to render all 59 defs as identical bordered tiles, five across, so the 58 things
 * you have not done shouted exactly as loudly as the one you have. It is now ordered by what the
 * reader actually came for: what you earned and when, as an open ruled list, then the remaining
 * catalogue as a quiet index of six groups that expands only when asked.
 */
export default function AchievementsPage() {
  const unlocked = useAppSelector((state) => state.gamification.unlocked);
  const [showLocked, setShowLocked] = useState(false);

  const total = ACHIEVEMENTS.length;
  const unlockedCount = Object.keys(unlocked).length;

  // Most recent first; `sort` is stable, so same-day unlocks keep the engine's own order.
  const unlockedDefs = ACHIEVEMENTS.filter((def) => unlocked[def.id]).sort((a, b) =>
    unlocked[b.id]!.localeCompare(unlocked[a.id]!),
  );

  const groups = groupAchievements(ACHIEVEMENTS).map((group) => ({
    ...group,
    locked: group.items.filter((def) => !unlocked[def.id]),
  }));
  const lockedTotal = groups.reduce((sum, group) => sum + group.locked.length, 0);

  return (
    <Page>
      <PageHeader
        eyebrow={`Unlocked ${unlockedCount} / ${total}`}
        title="Achievements"
        support="Milestones for solving, revising, holding a streak, and clearing course weeks. They are a record of the work — there is nothing to spend them on."
      />

      <Section title="Earned">
        {unlockedDefs.length === 0 ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            Nothing yet. Solving a single question earns the first one today.
          </p>
        ) : (
          <RuledList>
            {unlockedDefs.map((def) => (
              <UnlockedRow key={def.id} def={def} date={unlocked[def.id]!} />
            ))}
          </RuledList>
        )}
      </Section>

      <Section
        title="Still locked"
        support={
          lockedTotal === 0
            ? 'Every milestone in the roadmap is earned.'
            : `${lockedTotal} left, grouped by what earns them.`
        }
        action={
          lockedTotal > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={showLocked}
              aria-controls={LOCKED_LIST_ID}
              onClick={() => setShowLocked((open) => !open)}
            >
              {showLocked ? 'Hide list' : 'Show list'}
            </Button>
          )
        }
      >
        <div id={LOCKED_LIST_ID}>
          <RuledList>
            {groups.map((group) => (
              <RuledItem key={group.name} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-base font-semibold">{group.name}</h3>
                  <p className="figures text-xs text-muted-foreground">
                    {group.items.length - group.locked.length} / {group.items.length}
                  </p>
                </div>
                {showLocked &&
                  (group.locked.length === 0 ? (
                    <p className="border-l border-border pl-4 text-sm text-muted-foreground">
                      All earned.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2 border-l border-border pl-4">
                      {group.locked.map((def) => (
                        <LockedRow key={def.id} def={def} />
                      ))}
                    </ul>
                  ))}
              </RuledItem>
            ))}
          </RuledList>
        </div>
      </Section>
    </Page>
  );
}
