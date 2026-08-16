import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Award } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import { Ornament } from '@/components/shared/Ornament';
import { Button } from '@/components/ui/button';
import { Page, PageColumns, PageHeader, RuledItem, RuledList, Section } from '@/components/layout/Page';
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
 * reader actually came for: what you earned and when, as an open ruled list, with the remaining
 * catalogue beside it as a quiet index of six groups that expands only when asked.
 */
export default function AchievementsPage() {
  const unlocked = useAppSelector((state) => state.gamification.unlocked);
  const [showLocked, setShowLocked] = useState(false);

  const total = ACHIEVEMENTS.length;

  // Most recent first; `sort` is stable, so same-day unlocks keep the engine's own order.
  const unlockedDefs = ACHIEVEMENTS.filter((def) => unlocked[def.id]).sort((a, b) =>
    unlocked[b.id]!.localeCompare(unlocked[a.id]!),
  );
  // Counted off the rendered list, not off `unlocked`'s key count. A backup imported from an
  // older build carries ids this build no longer defines; counting keys claimed "Unlocked 14 /
  // 59" over 12 rows, and the number a page prints must be the number of things it shows.
  const unlockedCount = unlockedDefs.length;

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

      {/* Record left, catalogue right. Stacked, the locked index — six group headings and their
          tallies — crossed the fold once the earned list held even a handful of rows, and it was
          costing that height as pure context: nothing in it can be acted on, it only says what
          remains. Its rows are a short name and a quiet description, naturally narrow, so the
          rail width costs them nothing. DOM order keeps Earned first below `lg`, where the
          columns restack — the fallback reads exactly as the page always did. */}
      <PageColumns
        railLabel="Still locked"
        rail={
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
            {/* One rule system, not three. The catalogue was a RuledList's hairlines around a
                RuledItem's dividers around a per-group left border — three kinds of line for what is,
                collapsed, six rows reading "Name … 3 / 9". The list keeps its hairlines; the group is
                a real `Section level={3}` so the outline is truthful; and the locked items are held
                together by indentation, which is all that grouping ever needed here. */}
            <div id={LOCKED_LIST_ID}>
              <RuledList>
                {groups.map((group) => (
                  <RuledItem key={group.name}>
                    <Section
                      level={3}
                      title={group.name}
                      action={
                        <span className="figures text-xs text-muted-foreground">
                          {group.items.length - group.locked.length} / {group.items.length}
                        </span>
                      }
                    >
                      {showLocked &&
                        (group.locked.length === 0 ? (
                          <p className="pl-6 text-sm text-muted-foreground">All earned.</p>
                        ) : (
                          <ul className="flex flex-col gap-2 pl-6">
                            {group.locked.map((def) => (
                              <LockedRow key={def.id} def={def} />
                            ))}
                          </ul>
                        ))}
                    </Section>
                  </RuledItem>
                ))}
              </RuledList>
            </div>
          </Section>
        }
      >
        {/* The star in the action slot is an ornament, not a control — the earned shelf is the
            one ceremonial surface, and the device sits where a button would so it costs no row. */}
        <Section title="Earned" action={<Ornament kind="star" className="h-5 w-5 text-muted-foreground/60" />}>
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
      </PageColumns>
    </Page>
  );
}
