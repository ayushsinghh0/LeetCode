import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Lead, RuledItem, RuledList } from '@/components/layout/Page';
import type { Insight, InsightTone } from '@/utils/engine/insights';

const TONE_ICON: Record<InsightTone, typeof AlertCircle> = {
  attention: AlertCircle,
  steady: Minus,
  strength: CheckCircle2,
};

// Tone rides the difficulty inks, on the icon only — never on the headline text (DESIGN.md's
// One Ink Rule). `steady` stays in a text token: "nothing is wrong" needs no colour at all.
const TONE_CLASS: Record<InsightTone, string> = {
  attention: 'text-medium',
  steady: 'text-muted-foreground',
  strength: 'text-easy',
};

/**
 * The evidence rail. Prose, not figures — evidence lines are full sentences and several carry no
 * numbers at all (DESIGN.md's Three Voices Rule: mono speaks figures, never prose).
 */
function Evidence({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-col gap-1 border-l-2 border-border pl-3">
      {lines.map((line) => (
        <li key={line} className="text-sm text-muted-foreground">
          {line}
        </li>
      ))}
    </ul>
  );
}

/**
 * The one finding worth reading before any figure on the page — the page's `Lead`, and the only
 * plate on it.
 *
 * A learner who opens analytics has a decision to make. Nine stat cards and six charts hand the
 * interpreting work straight back to them; one reading, its evidence, and a button that performs
 * the recommendation does not. The three bands are fixed and appear in that order: a headline
 * without evidence is an assertion, and evidence without a recommendation is a chart that has
 * made the reader do the work.
 *
 * `null` is a real, correct outcome — early on there genuinely is not enough history to say
 * anything, and saying so is more useful than a padded card.
 */
export function InsightLead({ insight }: { insight: Insight | null }) {
  if (!insight) {
    return (
      <Lead>
        <div className="flex flex-col gap-3">
          <p className="figures text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Primary finding
          </p>
          <h2 className="text-xl font-semibold leading-snug md:text-2xl">Not enough history yet.</h2>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Findings appear once there are enough graded recalls and recorded drills to say
            something that would not just be noise — a few days of practice, not a few minutes.
            Nothing on this page is padded to fill a section.
          </p>
        </div>
      </Lead>
    );
  }

  const Icon = TONE_ICON[insight.tone];

  return (
    <Lead>
      <article className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${TONE_CLASS[insight.tone]}`} aria-hidden="true" />
          <p className="figures text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Primary finding
          </p>
        </div>

        <h2 className="text-xl font-semibold leading-snug md:text-2xl">{insight.headline}</h2>

        <Evidence lines={insight.evidence} />

        <p className="max-w-prose text-sm leading-relaxed">{insight.recommendation}</p>

        <Button asChild className="self-start">
          <Link to={insight.action.href}>{insight.action.label}</Link>
        </Button>
      </article>
    </Lead>
  );
}

/**
 * The remaining findings, as a ruled document rather than a grid of plates.
 *
 * These are secondary by construction — `buildInsights` returns the most actionable first and the
 * lead has already taken it. A list of hairline-separated readings says "there is more here if you
 * want it"; the same content in six bordered rectangles says "six more things demand you".
 */
export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <RuledList aria-label="Other findings">
      {insights.map((insight) => {
        const Icon = TONE_ICON[insight.tone];
        return (
          <RuledItem key={insight.id} className="flex flex-col gap-2">
            <h3 className="flex items-start gap-2 text-base font-medium leading-snug">
              <Icon
                className={`mt-1 h-3.5 w-3.5 shrink-0 ${TONE_CLASS[insight.tone]}`}
                aria-hidden="true"
              />
              {insight.headline}
            </h3>
            <Evidence lines={insight.evidence} />
            <p className="max-w-prose text-sm">{insight.recommendation}</p>
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link to={insight.action.href}>{insight.action.label}</Link>
            </Button>
          </RuledItem>
        );
      })}
    </RuledList>
  );
}
