import { Shapes } from 'lucide-react';
import { iconByName } from '@/components/shared/iconMap';
import type { PatternMeta } from '@/types';

/**
 * `chip` — the bordered, tinted pattern identity. Correct where the pattern stands alone as an
 * object: the question sheet's masthead, focus mode.
 *
 * `bare` — the pattern's ink dot beside its name, no box. Correct inside a `Meta` line or a list
 * row, where the pattern is one fact among several describing the same question. This is the
 * idiom AnalyticsPage already uses for its weakness list, and DESIGN.md § Related facts look like
 * one fact is why: a boxed chip inside a line of plain metadata says "separate thing".
 *
 * In both variants the pattern ink stays on the icon/dot, border and tint — never on label text,
 * which wears the foreground token so it meets body-text contrast on both grounds (the ink
 * midtones can't).
 */
export type PatternChipVariant = 'chip' | 'bare';

export interface PatternChipProps {
  pattern: PatternMeta;
  variant?: PatternChipVariant;
}

export function PatternChip({ pattern, variant = 'chip' }: PatternChipProps) {
  if (variant === 'bare') {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: pattern.color }}
          aria-hidden="true"
        />
        {pattern.name}
      </span>
    );
  }

  // pattern.icon is a lucide component name stored as a string (src/data/patterns.ts) —
  // resolved through the explicit ICON_MAP so the icon library stays tree-shakeable.
  const Icon = iconByName(pattern.icon, Shapes);

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
