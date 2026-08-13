import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Insight, InsightTone } from '@/utils/engine/insights';

const TONE_ICON: Record<InsightTone, typeof AlertCircle> = {
  attention: AlertCircle,
  steady: Minus,
  strength: CheckCircle2,
};

const TONE_CLASS: Record<InsightTone, string> = {
  attention: 'text-medium',
  steady: 'text-muted-foreground',
  strength: 'text-easy',
};

/**
 * One finding: what is true, what says so, and what to do about it.
 *
 * The three parts are non-negotiable and appear in that order. A headline without evidence is an
 * assertion; evidence without a recommendation is a chart that has made the reader do the work.
 * The button performs the recommendation rather than linking to a page where it could be
 * arranged — a step the reader still has to translate is not really a recommendation.
 */
export function InsightCard({ insight }: { insight: Insight }) {
  const Icon = TONE_ICON[insight.tone];

  return (
    <article className="glass flex flex-col gap-3 p-5">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_CLASS[insight.tone]}`} aria-hidden="true" />
        <h3 className="text-base font-medium leading-snug">{insight.headline}</h3>
      </div>

      {/* Prose, not figures — evidence lines are full sentences and several carry no numbers at
          all. DESIGN.md's Three Voices Rule: mono speaks figures, never prose. */}
      <ul className="flex flex-col gap-1 border-l-2 border-border pl-3">
        {insight.evidence.map((line) => (
          <li key={line} className="text-sm text-muted-foreground">
            {line}
          </li>
        ))}
      </ul>

      <p className="max-w-prose text-sm">{insight.recommendation}</p>

      <Button asChild size="sm" variant="outline" className="self-start">
        <Link to={insight.action.href}>{insight.action.label}</Link>
      </Button>
    </article>
  );
}

/**
 * The findings section. An empty list is a real, correct outcome — early on there genuinely is
 * not enough history to say anything, and saying so is more useful than a padded card.
 */
export function InsightPanel({ insights }: { insights: Insight[] }) {
  return (
    <section className="flex flex-col gap-3" aria-label="What to do about it">
      <div>
        <h2 className="text-lg font-semibold">What the data says to do</h2>
        <p className="text-sm text-muted-foreground">
          Only findings the current evidence actually supports. Nothing here is padded to fill the
          section.
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="glass p-5">
          <p className="max-w-prose text-sm text-muted-foreground">
            Not enough history yet. Recommendations appear once there are enough graded recalls and
            recorded drills to say something that would not just be noise — a few days of practice,
            not a few minutes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </section>
  );
}
