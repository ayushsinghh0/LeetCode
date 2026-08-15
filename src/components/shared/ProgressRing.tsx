import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
}

// Animated SVG ring: a hairline track circle plus a solid ink progress circle whose
// stroke-dashoffset framer-motion animates from "empty" to the current value/max fraction.
// `children` (e.g. a level number) render centered via an absolute overlay.
export function ProgressRing({ value, max, size = 96, strokeWidth = 8, children }: ProgressRingProps) {
  // `MotionConfig reducedMotion="user"` (App.tsx) suppresses only *transform* and *layout*
  // animations, and index.css's reduced-motion block zeroes only CSS transitions. `strokeDashoffset`
  // is an SVG attribute driven by JS, so it is covered by neither — this 600ms sweep ran at full
  // length under `prefers-reduced-motion: reduce`. The sidebar's level ring mounts this on every
  // route, which made it the most-repeated uncovered motion in the app.
  const reduced = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 0.6, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
