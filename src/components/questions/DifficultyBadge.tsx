import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import type { Difficulty } from '@/types';

const LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const COLOR_CLASSES: Record<Difficulty, string> = {
  easy: 'border-easy/40 bg-easy/10 text-easy',
  medium: 'border-medium/40 bg-medium/10 text-medium',
  hard: 'border-hard/40 bg-hard/10 text-hard',
};

// The same semantic, unboxed: the difficulty ink carried by the word itself. This is the idiom
// ContestPage already uses for its outcome readings (`text-easy`/`text-medium`/`text-hard`).
const INK_CLASSES: Record<Difficulty, string> = {
  easy: 'text-easy',
  medium: 'text-medium',
  hard: 'text-hard',
};

/**
 * `chip` — a bordered, tinted rectangle. Correct where the difficulty stands alone as an object:
 * the question sheet's masthead, focus mode.
 *
 * `bare` — the label in its difficulty ink, no box. Correct inside a `Meta` line or a list row,
 * where the surrounding facts already describe one object. A chip there is a plate nested in a
 * line of plain text: DESIGN.md § Related facts look like one fact says four boxed chips read as
 * "four things", and a browse list of thirty rows was rendering sixty of them.
 */
export type DifficultyBadgeVariant = 'chip' | 'bare';

export interface DifficultyBadgeProps {
  difficulty: Difficulty;
  variant?: DifficultyBadgeVariant;
}

export function DifficultyBadge({ difficulty, variant = 'chip' }: DifficultyBadgeProps) {
  if (variant === 'bare') {
    return <span className={cn('font-medium', INK_CLASSES[difficulty])}>{LABEL[difficulty]}</span>;
  }

  return (
    <Badge variant="outline" className={cn(COLOR_CLASSES[difficulty])}>
      {LABEL[difficulty]}
    </Badge>
  );
}
