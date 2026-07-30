import { Award } from 'lucide-react';
import { cn } from '@/utils/cn';
import { MASTERED_STAGE } from '@/utils/engine/spacedRepetition';

export interface RevisionStagePipsProps {
  stage: number;
}

export function RevisionStagePips({ stage }: RevisionStagePipsProps) {
  const mastered = stage >= MASTERED_STAGE;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`Revision stage ${stage} of 5`}
    >
      {mastered && <Award className="h-3.5 w-3.5 text-medium" aria-hidden="true" />}
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            mastered ? 'bg-medium' : i < stage ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}
