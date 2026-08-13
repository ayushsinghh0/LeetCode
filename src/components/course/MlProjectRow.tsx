import { useState } from 'react';
import { Meta } from '@/components/layout/Page';
import { EYEBROW, Field, ROW_INSET, RowToggle, StepList, weekLabel } from '@/components/course/MlRowParts';
import { ML_TIER_LABEL, type MlProject } from '@/data/mlProjects';
import { mlTrackById } from '@/data/mlTracks';
import { cn } from '@/utils/cn';

/**
 * One project on the ladder.
 *
 * The **baseline** and the **metric with its justification** are the argument of this whole
 * surface — a project with a stated dumb model and its measured score is engineering, the
 * identical project without one is a tutorial — and they open the disclosure for exactly that
 * reason: they are the first two fields inside, ahead of the objective.
 *
 * They used to render on the closed row instead, which defeated the point. Fourteen rows each
 * printing three or four lines of baseline prose plus two of metric prose is ~8 identical-weight
 * paragraphs per screen with no scannable spine, so the argument was not read *more* for being
 * always-on; the list simply became unreadable and the disclosure mechanism sat unused directly
 * above it. Closed, a project now states what a project is — tier, title, cost, data, week —
 * exactly as a track does, and the argument is one click away at the top of the document.
 *
 * Where `baseline.score` is null the field says so in full: the figure is a property of the
 * learner's own system (a judge's base rate, an unoptimised endpoint's p95), so the note that
 * names who must measure it is the instruction, not provenance, and it renders inline. For a
 * stated score the same field is provenance, and it sits further down under "Where that number
 * comes from".
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
    // Hairlines come from the `RuledList` parent's `divide-y`; the row does not redeclare them.
    <li className="flex flex-col">
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

      {open && (
        <div className={cn(ROW_INSET, 'flex flex-col gap-5 pb-3.5')}>
          {/* The first two fields, ahead of the objective — see the note above. */}
          <Baseline project={project} />

          <Field label="Metric">
            <p className="text-sm leading-relaxed">{project.metric.name}</p>
            {/* The argument against the obvious alternative. This is the teaching, not a footnote. */}
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{project.metric.why}</p>
          </Field>

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
