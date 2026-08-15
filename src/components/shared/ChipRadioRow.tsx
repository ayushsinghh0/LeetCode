import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * The capacity-chip idiom (DESIGN.md § Capacity chips): small bordered toggles, ink fill for the
 * one that is active. Small `rounded-sm`, figure face at the call site, 44px tall.
 *
 * This is the only place in the app where several ink fills sit adjacent, and it is permitted
 * because exactly one is ever active — which is also why the row is a `role="radiogroup"` and not
 * a set of `aria-pressed` toggles. Six toggle buttons announce six independent on/off controls for
 * what is one choice.
 */
const CHIP_CLASS =
  'inline-flex min-h-[44px] items-center justify-center rounded-sm border px-3 text-xs transition-colors duration-150 ease-swift focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const CHIP_ON = 'border-primary bg-primary text-primary-foreground';
const CHIP_OFF = 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground';

export interface ChipRadioRowProps<T extends string | number> {
  /** Names the group for assistive tech. The visible legend, where there is one, is separate. */
  label: string;
  options: readonly T[];
  value: T | undefined;
  onSelect: (option: T) => void;
  /** Visible chip text; defaults to the option itself. */
  format?: (option: T) => ReactNode;
  /** Accessible name per chip, when the visible text is too terse to stand alone ("15m"). */
  optionLabel?: (option: T) => string;
  chipClassName?: string;
  className?: string;
  /** Flanking non-interactive text (a scale's low/high anchors). */
  before?: ReactNode;
  after?: ReactNode;
}

/**
 * A single-choice chip row for "exactly one of these is true" controls. Used by Today's capacity
 * chips and by Interview's stage self-report and five self-assessment scales.
 *
 * It exists because the idiom had become three hand-written copies. DESIGN.md § Capacity chips
 * states that "arrow-key selection is the contract the radio role promises", and RevisionPage's own
 * comment claimed it carried "the same correction Today's capacity chips already carry" — but
 * Today's chips shipped `role="radiogroup"` with no `onKeyDown` and no roving `tabIndex`, so all
 * six sat in the tab sequence and the arrow keys did nothing. The documentation was true of two of
 * the three implementations, which is exactly the failure mode a duplicated idiom produces: the
 * divergence is invisible in any single file.
 *
 * **Revision's session-length chooser is the third copy and has NOT been migrated.** Its own
 * implementation is correct (it has the roving tabindex and the arrow keys), which is why it was
 * left alone rather than rewritten under a green suite; but it omits the
 * `focus-visible:ring` classes `CHIP_CLASS` carries, so the two rows differ on focus appearance.
 * Migrating `RevisionPage`'s `SessionPreview` is the outstanding half of this extraction — do not
 * read the existence of this file as evidence that it is finished.
 *
 * Roving tabindex keeps the group to one tab stop — and with nothing chosen yet, the first chip
 * stays tabbable, because a radiogroup every one of whose radios is `tabIndex -1` cannot be
 * reached at all.
 */
export function ChipRadioRow<T extends string | number>({
  label,
  options,
  value,
  onSelect,
  format,
  optionLabel,
  chipClassName,
  className,
  before,
  after,
}: ChipRadioRowProps<T>) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option === value);
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function moveTo(index: number) {
    const option = options[index];
    if (option === undefined) return;
    onSelect(option);
    chipRefs.current[index]?.focus();
  }

  // Arrow keys move selection inside a radiogroup — a group that only responds to Tab and click is
  // announcing one thing and behaving as another.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = selectedIndex === -1 ? 0 : (selectedIndex + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = selectedIndex === -1 ? last : (selectedIndex + last) % options.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    moveTo(next);
  }

  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {before}
      {options.map((option, i) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={optionLabel ? optionLabel(option) : undefined}
            tabIndex={i === focusIndex ? 0 : -1}
            ref={(node) => {
              chipRefs.current[i] = node;
            }}
            onClick={() => onSelect(option)}
            // `chipClassName` goes LAST. `cn` is `twMerge` and last wins, so with the call-site
            // class first every override it passed was silently discarded by the base — Today's
            // `px-1`, which exists so six chips fit a `grid-cols-6` row at 375px, resolved back to
            // `px-3`. A base-classes-last order makes a `chipClassName` prop that cannot actually
            // override anything in the same property group, which is worse than not having one.
            className={cn(CHIP_CLASS, active ? CHIP_ON : CHIP_OFF, chipClassName)}
          >
            {format ? format(option) : option}
          </button>
        );
      })}
      {after}
    </div>
  );
}
