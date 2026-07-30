import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface XpBadgeProps {
  xp: number;
}

export function XpBadge({ xp }: XpBadgeProps) {
  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1">
      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
      {xp} XP
    </Badge>
  );
}
