import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import type { Difficulty } from '@/types';

const LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const COLOR_CLASSES: Record<Difficulty, string> = {
  easy: 'border-easy/40 bg-easy/10 text-easy',
  medium: 'border-medium/40 bg-medium/10 text-medium',
  hard: 'border-hard/40 bg-hard/10 text-hard',
};

export interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return (
    <Badge variant="outline" className={cn(COLOR_CLASSES[difficulty])}>
      {LABEL[difficulty]}
    </Badge>
  );
}
