import { cn } from '@/utils/cn';
import type { Confidence } from '@/types';

const LEVELS: Confidence[] = [1, 2, 3, 4, 5];

export interface ConfidenceRatingProps {
  value: Confidence | null;
  // Presentational when omitted: renders read-only dots (used in compact card contexts).
  // When provided, renders clickable buttons that call onChange(n) (used by the detail modal,
  // wired to the setConfidence thunk).
  onChange?: (value: Confidence) => void;
}

export function ConfidenceRating({ value, onChange }: ConfidenceRatingProps) {
  return (
    <div className="inline-flex items-center gap-1">
      {LEVELS.map((n) => {
        const filled = value !== null && n <= value;
        if (!onChange) {
          return (
            <span
              key={n}
              aria-label={`Confidence ${n}`}
              className={cn('h-2 w-2 rounded-full', filled ? 'bg-primary' : 'bg-muted')}
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            aria-label={`Confidence ${n}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(n);
            }}
            // The visible mark stays a small dot; the button around it provides a ≥40px hit area.
            className="group flex h-10 w-7 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors',
                filled ? 'bg-primary' : 'bg-muted group-hover:bg-primary/50',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
