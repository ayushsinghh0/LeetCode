import { Link } from 'react-router-dom';
import { Section, Meta, RuledItem, RuledList } from '@/components/layout/Page';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { contestProblemBySlug } from '@/data/contestLibrary';
import { sheetOnlyBySlug } from '@/data/revisionSheet';
import type { ContestLibraryProblem, Difficulty } from '@/types';

/**
 * Practice reviews that have come due — Today's one window onto the practice pools (V13, widened
 * by V14). The slug register now holds contest-library work AND sheet-only work, so this block
 * resolves each due slug against both datasets: a due sheet review that silently never surfaced
 * would be a scheduled recall the learner cannot see (D8).
 *
 * WHAT IT DELIBERATELY IS NOT. It is not part of the day's plan. `rankWork` never sees these,
 * the roadmap never sees these, and the day's counts never move for them: the plan's finishability
 * caps are calibrated to the 539, and PRODUCT.md's two-universes rule says the pools are drawn
 * from rather than work the day assigns. This block sits in the context rail, beside the day,
 * which is exactly what it is.
 *
 * IT ALSO DOES NOT GRADE. Recording a verdict here would reintroduce the bug Contest Revision was
 * fixed for: grading pushes the ladder date out, so the row would vanish from under the learner
 * the moment they answered it. Grading belongs on a surface that freezes its list for the sitting,
 * and that surface already exists one link away.
 *
 * Lazily mounted from `TodayPage` (which must never import either dataset) and only when the
 * setting is on AND `selectDueContestSlugs` — which needs no dataset — has found something. So a
 * learner with nothing due, or with the setting off, never fetches the chunks at all.
 */

/** Titles listed in the rail before it defers to the full surface. */
const SHOWN = 3;

/** One due row, whichever pool owns it. A sheet-only row is honestly unrated: null, never zero. */
interface DueRow {
  slug: string;
  title: string;
  url: string;
  officialDifficulty: Difficulty;
  contestRating: number | null;
  label: string | null;
}

function contestLabel(problem: ContestLibraryProblem): string | null {
  const { contest } = problem;
  if (contest.number === null) return null;
  return `${contest.type === 'biweekly' ? 'B' : 'W'}${contest.number} · Q${contest.index}`;
}

function resolve(slug: string): DueRow | undefined {
  const library = contestProblemBySlug.get(slug);
  if (library !== undefined) {
    return {
      slug,
      title: library.title,
      url: library.url,
      officialDifficulty: library.officialDifficulty,
      contestRating: library.contestRating,
      label: contestLabel(library),
    };
  }
  const sheet = sheetOnlyBySlug.get(slug);
  if (sheet !== undefined) {
    return {
      slug,
      title: sheet.title,
      url: sheet.url,
      officialDifficulty: sheet.officialDifficulty,
      contestRating: null,
      label: null,
    };
  }
  // A slug neither dataset carries is inert, never an error — the same rule the persisted
  // validator follows for retired problems.
  return undefined;
}

export default function ContestDue({ slugs }: { slugs: string[] }) {
  const rows = slugs
    .map(resolve)
    .filter((row): row is DueRow => row !== undefined);

  if (rows.length === 0) return null;

  const shown = rows.slice(0, SHOWN);
  const hidden = rows.length - shown.length;

  return (
    <Section
      title="Practice reviews"
      support="From your practice pools — separate from the day's plan."
    >
      <RuledList aria-label="Practice problems due for review">
        {shown.map((row) => (
          <RuledItem key={row.slug} className="flex flex-col gap-1">
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium transition-colors duration-150 ease-swift hover:text-primary"
            >
              {row.title}
            </a>
            <Meta
              items={[
                <DifficultyBadge difficulty={row.officialDifficulty} variant="bare" />,
                row.contestRating !== null && (
                  <span className="figures text-xs">{row.contestRating}</span>
                ),
                row.label,
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
          : `Review ${rows.length === 1 ? 'it' : 'them'} in Revision →`}
      </Link>
    </Section>
  );
}
