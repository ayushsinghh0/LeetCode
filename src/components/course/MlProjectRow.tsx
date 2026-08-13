import { useState } from 'react';
import { Meta } from '@/components/layout/Page';
import { EYEBROW, Field, RowToggle, StepList, weekLabel } from '@/components/course/MlRowParts';
import { ML_TIER_LABEL, type MlProject } from '@/data/mlProjects';
import { mlTrackById } from '@/data/mlTracks';
import { cn } from '@/utils/cn';

/**
 * One project on the ladder.
 *
 * What stays outside the disclosure is the argument of this whole surface: the **baseline** and
 * the **metric with its justification**. A project with a stated dumb model and its measured
 * score is engineering; the identical project without one is a tutorial, because nothing tells
 * you whether the model you built helped. And a metric with no argument against its obvious
 * alternative is accuracy-by-default wearing a different name. Both are therefore readable
 * without opening anything — the objective, the experiments and the retrospective are not.
 *
 * Where `baseline.score` is null the row says so in full: the figure is a property of the
 * learner's own system (a judge's base rate, an unoptimised endpoint's p95), so the note that
 * names who must measure it is the instruction, not provenance, and it renders inline. For a
 * stated score the same field is provenance, and it sits one click away under "Where that
 * number comes from".
 */
function Baseline({ project }: { project: MlProject }) {
  const { baseline } = project;

  return (
    <Field label="Baseline to beat">
      <p className="text-sm leading-relaxed">{baseline.model}</p>
      {baseline.score !== null ? (
        <p className="figures max-w-prose border-l-2 border-primary/40 pl-4 text-sm leading-relaxed">
          {baseline.score}
        </p>
      ) : (
        <div className="max-w-prose border-l-2 border-medium/60 pl-4">
          <p className="text-sm font-medium leading-relaxed">
            No published number exists — you have to establish this one first.
          </p>
          {baseline.note && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{baseline.note}</p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">measured in {baseline.metric}</p>
    </Field>
  );
}

export function MlProjectRow({ project }: { project: MlProject }) {
  const [open, setOpen] = useState(false);
  const prereqs = project.prereqTracks.map((id) => mlTrackById[id]?.title ?? id);

  return (
    <li className="flex flex-col gap-4 border-t border-border p-4 first:border-t-0">
      <RowToggle open={open} onToggle={() => setOpen(!open)}>
        <span className={cn(EYEBROW, 'block')}>
          {ML_TIER_LABEL[project.tier]} · {project.order}
        </span>
        <span className="mt-1 block font-medium">{project.title}</span>
        <Meta
          className="mt-1 text-xs"
          items={[
            <span className="figures">~{project.hours}h</span>,
            project.dataset.name,
            weekLabel(project.weekId),
          ]}
        />
      </RowToggle>

      {/* Always visible — see the note above. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Baseline project={project} />
        <Field label="Metric">
          <p className="text-sm leading-relaxed">{project.metric.name}</p>
          {/* The argument against the obvious alternative. This is the teaching, not a footnote. */}
          <p className="text-sm leading-relaxed text-muted-foreground">{project.metric.why}</p>
        </Field>
      </div>

      {open && (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <Field label="Objective">
            <p className="max-w-prose text-sm leading-relaxed">{project.objective}</p>
          </Field>

          <Field label="Data">
            <p className="text-sm leading-relaxed">{project.dataset.name}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{project.dataset.size}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{project.dataset.source}</p>
            {project.dataset.note && (
              <p className="max-w-prose border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
                {project.dataset.note}
              </p>
            )}
            <p className="figures text-xs text-muted-foreground">
              {project.dataset.license} · checked {project.dataset.checkedAt}
            </p>
          </Field>

          {project.baseline.score !== null && project.baseline.note && (
            <Field label="Where that number comes from">
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {project.baseline.note}
              </p>
            </Field>
          )}

          <Field label="Experiments">
            <StepList items={project.experiments} />
          </Field>

          <Field label="Error analysis">
            <StepList items={project.errorAnalysis} ordered={false} />
          </Field>

          <Field label="How to iterate">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{project.iteration}</p>
          </Field>

          <Field label="Deployment">
            {project.deployment ? (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{project.deployment}</p>
            ) : (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Nothing ships at this tier — deploying it would be theatre. The measurement is the
                deliverable.
              </p>
            )}
          </Field>

          <Field label="Retrospective">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              Deliberately unanswered — every answer is a property of your own runs.
            </p>
            <StepList items={project.retrospective} ordered={false} />
          </Field>

          {prereqs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Build these first: <span className="text-foreground">{prereqs.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}
