import { Link } from 'react-router-dom';
import { Section, Meta, RuledItem, RuledList } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { contestProblemBySlug } from '@/data/contestLibrary';
import type { ContestLibraryProblem } from '@/types';

/**
 * Contest reviews that have come due — Today's one window onto the second question universe.
 *
 * WHAT IT DELIBERATELY IS NOT. It is not part of the day's plan. `rankWork` never sees these,
 * the roadmap never sees these, and the day's counts never move for them: the plan's finishability
 * caps are calibrated to the 539, and PRODUCT.md's two-universes rule says the library is a pool
 * you draw from rather than work the day assigns. This block sits in the context rail, beside the
 * day, which is exactly what it is.
 *
 * IT ALSO DOES NOT GRADE. Recording a verdict here would reintroduce the bug Contest Revision was
 * fixed for: grading pushes the ladder date out, so the row would vanish from under the learner
 * the moment they answered it. Grading belongs on a surface that freezes its list for the sitting,
 * and that surface already exists one link away.
 *
 * Lazily mounted from `TodayPage` (which must never import the 336 kB dataset) and only when the
 * setting is on AND `selectDueContestSlugs` — which needs no dataset — has found something. So a
 * learner with nothing due, or with the setting off, never fetches the chunk at all.
 */

/** Titles listed in the rail before it defers to the full surface. */
const SHOWN = 3;

function contestLabel(problem: ContestLibraryProblem): string | null {
  const { contest } = problem;
  if (contest.number === null) return null;
  return `${contest.type === 'biweekly' ? 'B' : 'W'}${contest.number} · Q${contest.index}`;
}

export default function ContestDue({ slugs }: { slugs: string[] }) {
  // A slug the dataset no longer carries is inert, never an error — the same rule the persisted
  // validator follows for retired problems.
  const problems = slugs
    .map((slug) => contestProblemBySlug.get(slug))
    .filter((p): p is ContestLibraryProblem => p !== undefined);

  if (problems.length === 0) return null;

  const shown = problems.slice(0, SHOWN);
  const hidden = problems.length - shown.length;

  return (
    <Section
      title="Contest reviews"
      support="From the contest library — separate from the day's plan."
    >
      <RuledList aria-label="Contest problems due for review">
        {shown.map((problem) => (
          <RuledItem key={problem.slug} className="flex flex-col gap-1">
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium transition-colors duration-150 ease-swift hover:text-primary"
            >
              {problem.title}
            </a>
            <Meta
              items={[
                <DifficultyBadge difficulty={problem.officialDifficulty} variant="bare" />,
                <span className="figures text-xs">{problem.contestRating}</span>,
                contestLabel(problem),
              ]}
            />
          </RuledItem>
        ))}
      </RuledList>

      <Link
        to="/revision"
        className="text-sm font-medium text-primary hover:underline"
      >
        {hidden > 0
          ? `Review these and ${hidden} more →`
          : `Review ${problems.length === 1 ? 'it' : 'them'} in Contest Revision →`}
      </Link>
    </Section>
  );
}
