import { ProgressRing } from '@/components/shared/ProgressRing';

export interface LevelRingProps {
  level: number;
  intoLevel: number;
  needed: number;
  size?: number;
}

// ProgressRing filled by levelProgress()'s intoLevel/needed, with "Lv N" centered.
export function LevelRing({ level, intoLevel, needed, size = 96 }: LevelRingProps) {
  return (
    <ProgressRing value={intoLevel} max={needed} size={size}>
      <span className={size <= 56 ? 'text-[10px] font-bold' : 'text-sm font-bold'}>Lv {level}</span>
    </ProgressRing>
  );
}
