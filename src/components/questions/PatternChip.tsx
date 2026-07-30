import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PatternMeta } from '@/types';

// Dynamic icon lookup: pattern.icon is a lucide-react component name stored as a plain string
// (see src/data/patterns.ts). The namespace import has to be cast — lucide-react's real type is
// a large union of named exports, not an index signature — so we assert it as a lookup table.
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

export interface PatternChipProps {
  pattern: PatternMeta;
}

export function PatternChip({ pattern }: PatternChipProps) {
  const Icon = Icons[pattern.icon] ?? LucideIcons.Shapes;

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
