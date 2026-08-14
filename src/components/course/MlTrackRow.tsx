import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Meta } from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { completeMlRung } from '@/store/actions';
import { ML_LADDER_RUNG, isRungDone, mlTrackProgressFor, rungsDone } from '@/utils/engine/mlTrack';
import { format, parseISO } from 'date-fns';
import { CodeChips, EYEBROW, Field, ROW_INSET, RowToggle, StepList, weekLabel } from '@/components/course/MlRowParts';
import {
  ML_STAGE_LABEL,
  ML_STAGE_ORDER,
  ML_STAGE_PURPOSE,
  mlTrackById,
  type MlStageId,
  type MlTrack,
} from '@/data/mlTracks';
import { formatMinutes } from '@/utils/engine/planner';
import { cn } from '@/utils/cn';

const monthDay = (iso: string): string => format(parseISO(iso), 'MMM d');

/**
 * One from-scratch implementation track, opening into its five-stage ladder.
 *
 * Two disclosure decisions carry the whole design:
 *
 * 1. **The ladder is always legible, the detail is not.** Opening a track shows all five stages
 *    with their numbers and one-line summaries — the shape of the work — while the derivation,
 *    the checklist, the API and the measured run stay one click away. Dumping five stages of
 *    prose on screen is the failure this avoids; hiding the fact that there *are* five stages is
 *    the other one.
 *
 * 2. **The failure stage does not collapse.** It is the fifth rung, so it keeps its place in the
 *    progression, but it renders open whenever the track is open. It is the highest-value content
 *    in the dataset — symptoms reproduced deliberately, with the numbers observed — and content
 *    that good only pays off if people actually read it. A second click is where it would die.
 */
function StageDetail({ track, stage }: { track: MlTrack; stage: Exclude<MlStageId, 'failure'> }) {
  if (stage === 'math') {
    const { detail, symbols } = track.stages.math;
    return (
      <>
        <pre className="figures overflow-x-auto whitespace-pre rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
          {detail}
        </pre>
        <Field label="What each symbol is">
          <dl className="flex flex-col gap-1.5">
            {symbols.map((s) => (
              <div key={s.symbol} className="flex gap-3 text-sm">
                <dt className="figures w-16 shrink-0 text-foreground">{s.symbol}</dt>
                <dd className="min-w-0 text-muted-foreground">{s.meaning}</dd>
              </div>
            ))}
          </dl>
        </Field>
      </>
    );
  }

  if (stage === 'scratch') {
    const { checklist, shapes } = track.stages.scratch;
    return (
      <>
        <Field label="Write these, in this order">
          <StepList items={checklist} />
        </Field>
        <CodeChips label="Every shape between them" items={shapes} />
      </>
    );
  }

  if (stage === 'library') {
    const { api, version, detail } = track.stages.library;
    return (
      <>
        <CodeChips label="What you'll import" items={api} />
        <Field label="Verified against">
          <p className="figures text-sm text-muted-foreground">{version}</p>
        </Field>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{detail}</p>
      </>
    );
  }

  const { dataset, metric, expect } = track.stages.experiment;
  return (
    <>
      <Field label="Data">
        <p className="text-sm leading-relaxed text-muted-foreground">{dataset}</p>
      </Field>
      <Field label="Measure">
        <p className="text-sm leading-relaxed text-muted-foreground">{metric}</p>
      </Field>
      <Field label="What you should see">
        {/* Measured, not remembered — so it gets the ink rail rather than a muted footnote. */}
        <p className="max-w-prose border-l-2 border-primary/40 pl-4 text-sm leading-relaxed">{expect}</p>
      </Field>
    </>
  );
}

function FailureModes({ track }: { track: MlTrack }) {
  return (
    <ul className="flex flex-col gap-4">
      {track.stages.failure.map((f) => (
        <li key={f.symptom} className="flex flex-col gap-1.5 border-l-2 border-hard/50 pl-4">
          <p className="text-sm font-medium leading-relaxed">{f.symptom}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className={cn(EYEBROW, 'mr-1.5 inline')}>Cause</span>
            {f.cause}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className={cn(EYEBROW, 'mr-1.5 inline')}>Fix</span>
            {f.fix}
          </p>
        </li>
      ))}
    </ul>
  );
}

function StageLadder({ track }: { track: MlTrack }) {
  // One acquisition stage open at a time, starting at the top: it is a ladder, not a tab strip.
  const [openStage, setOpenStage] = useState<MlStageId | null>('math');
  const dispatch = useAppDispatch();
  const progress = useAppSelector((state) => mlTrackProgressFor(state.ml.tracksById, track.id));

  return (
    <ol className="flex flex-col border-t border-border">
      {ML_STAGE_ORDER.map((stage, i) => {
        const isFailure = stage === 'failure';
        const open = isFailure || openStage === stage;
        const summary = isFailure
          ? ML_STAGE_PURPOSE.failure
          : track.stages[stage].summary;

        return (
          <li key={stage} className="flex gap-3 border-b border-border py-3.5">
            <span
              className={cn(
                'figures w-5 shrink-0 text-sm leading-6',
                open ? 'text-foreground' : 'text-muted-foreground/60',
              )}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {isFailure ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    {ML_STAGE_LABEL.failure}
                    <span className="figures ml-2 text-xs font-normal text-muted-foreground">
                      {track.stages.failure.length} modes
                    </span>
                  </p>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{summary}</p>
                </div>
              ) : (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenStage(open ? null : stage)}
                  className="-mx-2 flex flex-col gap-1 rounded-md px-2 py-1 text-left transition-colors duration-150 ease-swift hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{ML_STAGE_LABEL[stage]}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform duration-150 ease-swift',
                        open && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="max-w-prose text-sm leading-relaxed text-muted-foreground">{summary}</span>
                </button>
              )}

              {open && (
                <div className="flex flex-col gap-4">
                  {isFailure ? <FailureModes track={track} /> : <StageDetail track={track} stage={stage} />}
                  {/* The stamp. A date, not a counter — pressing it again does nothing and pays
                      nothing, which is what keeps a work register from becoming a farm. Stamping
                      "From scratch" also puts the track on the rebuild ladder: that is the rung
                      where an implementation starts existing, and therefore starts being
                      forgettable. */}
                  {isRungDone(progress, stage) ? (
                    <p className="figures text-xs text-muted-foreground">
                      Done {monthDay(progress.rungs[stage]!)}
                      {stage === ML_LADDER_RUNG && ' · on the rebuild ladder'}
                    </p>
                  ) : (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dispatch(completeMlRung(track.id, stage))}
                      >
                        <Check /> Mark {ML_STAGE_LABEL[stage].toLowerCase()} done
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function MlTrackRow({ track }: { track: MlTrack }) {
  const [open, setOpen] = useState(false);
  const prereqs = track.prereqs.map((id) => mlTrackById[id]?.title ?? id);
  const progress = useAppSelector((state) => mlTrackProgressFor(state.ml.tracksById, track.id));
  const done = rungsDone(progress);

  return (
    // The `RuledList` parent already draws the hairline between rows via `divide-y`; this row
    // used to redeclare `border-t … first:border-t-0` on top of it, a leftover from when these
    // lists lived inside a plate. Padding is the toggle's, so hover fills the row.
    <li className="flex flex-col">
      <RowToggle open={open} onToggle={() => setOpen(!open)}>
        <span className="block font-medium">{track.title}</span>
        <Meta
          className="mt-1 text-xs"
          items={[
            <span className="figures">~{formatMinutes(track.minutes)}</span>,
            weekLabel(track.weekId),
            // Surfaced on the closed row on purpose: the failure modes are the reason to open it.
            <span className="figures">{track.stages.failure.length} failure modes</span>,
            done > 0 && (
              <span className="figures text-foreground">
                {done} of {ML_STAGE_ORDER.length} rungs done
              </span>
            ),
          ]}
        />
      </RowToggle>

      {open && (
        <div className={cn(ROW_INSET, 'flex flex-col gap-4 pb-3.5')}>
          <p className="max-w-prose text-sm leading-relaxed">{track.tests}</p>
          {prereqs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Do these first: <span className="text-foreground">{prereqs.join(', ')}</span>
            </p>
          )}
          <StageLadder track={track} />
        </div>
      )}
    </li>
  );
}
