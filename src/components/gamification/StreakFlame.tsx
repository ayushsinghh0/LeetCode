import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface StreakFlameProps {
  current: number;
}

// Flame + streak count. Pulses (framer-motion scale loop) once the streak is "hot" (>= 3 days);
// gray at 0, ember-ochre otherwise (the theme's per-ground `medium` ink, not a raw palette hue).
export function StreakFlame({ current }: StreakFlameProps) {
  const pulse = current >= 3;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold',
        current === 0 ? 'text-muted-foreground' : 'text-medium',
      )}
    >
      <motion.span
        className="inline-flex"
        animate={pulse ? { scale: [1, 1.18, 1] } : undefined}
        transition={pulse ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <Flame className="h-4 w-4" aria-hidden="true" />
      </motion.span>
      {current}
    </span>
  );
}
