import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppDispatch } from '@/store/hooks';
import { reviseMlTrack } from '@/store/actions';
import { mlTrackById } from '@/data/mlTracks';
import { mlTrackProgressFor } from '@/utils/engine/mlTrack';
import type { MlTrackProgress } from '@/types';
import { format, parseISO } from 'date-fns';

const monthDay = (iso: string): string => format(parseISO(iso), 'MMM d');

interface MlRebuildListProps {
  trackIds: string[];
  tracksById: Record<string, MlTrackProgress>;
}

/**
 * Tracks due for a rebuild, with the same Pass/Fail grading a course review gets — one rendering,
 * shared by /aiml and /revision so the two surfaces cannot drift.
 *
 * What is being graded is deliberately not "do you remember this". It is: open a blank file, write
 * the core loop again, and say whether it came out. Anyone can answer yes to the first question;
 * only the second one is evidence.
 */
export function MlRebuildList({ trackIds, tracksById }: MlRebuildListProps) {
  const dispatch = useAppDispatch();

  return (
    <ul className="list-none">
      {trackIds.map((trackId) => {
        const track = mlTrackById[trackId];
        if (!track) return null;
        const progress = mlTrackProgressFor(tracksById, trackId);
        return (
          <li
            key={trackId}
            className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0 md:flex-row md:items-center"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">{track.title}</p>
              <p className="figures text-xs text-muted-foreground/80">
                stage {progress.revisionStage} of 5
                {progress.nextRevision && ` · due ${monthDay(progress.nextRevision)}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                aria-label={`Pass ${track.title} rebuild`}
                onClick={() => dispatch(reviseMlTrack(trackId, true))}
              >
                <CheckCircle2 /> Rebuilt it
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Fail ${track.title} rebuild`}
                onClick={() => dispatch(reviseMlTrack(trackId, false))}
              >
                <XCircle /> Not yet
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
