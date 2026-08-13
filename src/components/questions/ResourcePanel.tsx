import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DifficultyBadge } from '@/components/questions/DifficultyBadge';
import { Eyebrow, RuledItem, RuledList } from '@/components/layout/Page';
import { useAppDispatch } from '@/store/hooks';
import { activeQuestionSet } from '@/store/slices/uiSlice';
import type { Difficulty, Question } from '@/types';

/**
 * Where to go from this question — a hierarchy, not a pile of links.
 *
 * The old header offered one button and called it a resource section. What a learner actually
 * needs is three different things, and the difference between them is worth saying out loud:
 *
 *   Solve    — the exact problem, once.
 *   Explore  — the same idea wearing a different statement.
 *   Practice — the variants that break the standard answer.
 *
 * Every group carries the reason it exists, because a bare list of titles makes the learner
 * reconstruct why they were grouped, which is the work the curriculum data already did.
 *
 * ---------------------------------------------------------------------------------------------
 * NO INVENTED EXTERNAL LINKS. The only verified external identity in this repo is a question's
 * own `url`/`leetcodeId`, resolved against the committed LeetCode catalog snapshot under the
 * generator's closed-world rule (see CLAUDE.md). There is no verified corpus of editorial,
 * NeetCode, or video links, so this panel does not emit any — a plausible-looking URL that
 * nothing checks is precisely the failure the data pipeline exists to prevent. Every non-Solve
 * entry below points at another question in this dataset, and nowhere else.
 * ---------------------------------------------------------------------------------------------
 */

export interface ResourceLink {
  id: number;
  title: string;
  difficulty: Difficulty;
}

export interface ResourceGroup {
  /** Stable key — also the visible label, e.g. `Explore`. */
  label: string;
  /** Why this group exists, in the learner's terms. One sentence. */
  reason: string;
  items: ResourceLink[];
}

export function ResourcePanel({ question, groups }: { question: Question; groups: ResourceGroup[] }) {
  const dispatch = useAppDispatch();
  const shown = groups.filter((g) => g.items.length > 0);

  // `gap-4` is the one interior step in this sheet (DESIGN.md § The rhythm, "inside a group");
  // rows within a group sit at `gap-2`. The panel used to mix `gap-5` with the modal's `gap-6`,
  // which is how a document ends up with four rhythms and no measure.
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Eyebrow>Solve</Eyebrow>
        {question.url ? (
          <>
            <p className="max-w-prose text-sm text-muted-foreground">
              The problem itself, on the page its identity was verified against.
            </p>
            <Button asChild size="sm" className="self-start">
              <a href={question.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Solve on LeetCode
                {question.premium && <span className="ml-1 text-xs opacity-80">· Premium</span>}
              </a>
            </Button>
          </>
        ) : (
          <p className="max-w-prose text-sm text-muted-foreground">
            Course-exclusive problem — practice it from your course material; no public LeetCode page exists.
          </p>
        )}
      </div>

      {shown.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <Eyebrow>{group.label}</Eyebrow>
          <p className="max-w-prose text-sm text-muted-foreground">{group.reason}</p>
          <RuledList aria-label={group.label}>
            {group.items.map((item) => (
              <RuledItem key={item.id} padded={false}>
                {/* The row's own child carries the padding so hover and focus fill the row —
                    see RuledItem's `padded` note. */}
                <button
                  type="button"
                  onClick={() => dispatch(activeQuestionSet(item.id))}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors duration-150 ease-swift hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                  <DifficultyBadge difficulty={item.difficulty} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </RuledItem>
            ))}
          </RuledList>
        </div>
      ))}
    </div>
  );
}
