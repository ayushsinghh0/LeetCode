import { Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import type { PatternMeta } from '@/types';

export interface PatternChipProps {
  pattern: PatternMeta;
}

export function PatternChip({ pattern }: PatternChipProps) {
  // pattern.icon is a lucide component name stored as a string (src/data/patterns.ts) —
  // resolved through the explicit ICON_MAP so the icon library stays tree-shakeable.
  const Icon = iconByName(pattern.icon, Shapes);

  // The pattern ink stays on the icon, border, and tint; the label wears the text token so it
  // meets body-text contrast on both grounds (the ink midtones can't).
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium text-foreground"
      style={{
        borderColor: `${pattern.color}59`,
        backgroundColor: `${pattern.color}1f`,
      }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: pattern.color }} aria-hidden="true" />
      {pattern.name}
    </span>
  );
}
