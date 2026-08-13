// The composition system — the vocabulary every page is built from.
//
// The problem this exists to solve: the app had grown into a stack of `.glass` plates. Every
// fact, however small, arrived inside its own bordered rectangle, so a page read as a pile of
// components rather than a designed document. Borders were carrying work that whitespace,
// alignment, and type hierarchy should have been doing.
//
// The rule this file encodes: **a plate must earn itself.** The default surface is the page
// ground. A section is a heading, an optional support line, and its content — separated from its
// neighbours by space, not by an outline. A plate is spent on exactly three things:
//
//   1. `Lead`   — the one thing the page wants you to do. One per page, ever.
//   2. `Plate`  — a surface that is genuinely liftable: a row you click, a thing you can act on.
//   3. Dialogs and overlays, which need to detach from the ground to be legible.
//
// Everything else is `Section`.
//
// The second thing it encodes is one rhythm. Pages previously mixed `gap-3`, `gap-4`, `gap-6`
// and `space-y-6` within a single screen, which is why nothing felt aligned even when it was.
// There are now three vertical steps and no others: between sections (40/48px), between a
// heading and its content (16px), between sibling rows (8px, or zero with a hairline).
//
// Visual language is unchanged — same tokens, same serif voice, same single fountain ink. This is
// composition, not a new identity. See DESIGN.md § Composition.
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/* ------------------------------------------------------------------------------------------- */
/* Page                                                                                         */
/* ------------------------------------------------------------------------------------------- */

/**
 * The measure. AppShell supplies the outer gutter and the 72rem ceiling; `Page` chooses how wide
 * *this* page's column is inside it, because a reading surface and a data grid do not want the
 * same line length.
 *
 * - `reading` (46rem) — prose-dominant: a question, a family, an insight. Roughly 75 characters.
 * - `default` (60rem) — most pages: lists with metadata, mixed content.
 * - `wide`           — grids and calendars that genuinely use the full shell.
 */
export type PageWidth = 'reading' | 'default' | 'wide';

const WIDTH_CLASS: Record<PageWidth, string> = {
  reading: 'max-w-[46rem]',
  default: 'max-w-[60rem]',
  wide: 'max-w-none',
};

export interface PageProps {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}

export function Page({ children, width = 'default', className }: PageProps) {
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-10 md:gap-12', WIDTH_CLASS[width], className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* PageHeader                                                                                   */
/* ------------------------------------------------------------------------------------------- */

/**
 * The eyebrow register: quiet mono capitals above a title.
 *
 * This exists as a component because the register was being re-declared inline on eight surfaces,
 * and half of them omitted `.figures` — so the identical eyebrow rendered in the mono face on
 * some pages and the body face on others. That is invisible in any single file and plainly wrong
 * across the product. `PageHeader` and `Section` use it too, so there is exactly one definition.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('figures text-xs uppercase tracking-[0.14em] text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export interface PageHeaderProps {
  /** Quiet context above the title — a date, a chapter number, a count. Never the title again. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One sentence on what this page is for. Capped at the reading measure. */
  support?: ReactNode;
  /** At most one control. If a page needs two, one of them is not a page-level action. */
  action?: ReactNode;
  /** The masthead hairline. On by default; drop it only when the next block draws its own edge. */
  rule?: boolean;
}

/**
 * The masthead. Every page opens the same way, which is what makes them feel like one product:
 * quiet eyebrow, serif title, one line of purpose, one action, hairline.
 */
export function PageHeader({ eyebrow, title, support, action, rule = true }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{title}</h1>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {support && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{support}</p>}
      {rule && <div className="rule" />}
    </header>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Section                                                                                      */
/* ------------------------------------------------------------------------------------------- */

export interface SectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  support?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** h2 by default; pass 3 for a subsection so the outline stays truthful. */
  level?: 2 | 3;
  /** Hairline above the section. Opt-in — 40px of space usually separates well enough. */
  divider?: boolean;
  className?: string;
  /** Forwarded for the pages that label a landmark region. */
  'aria-label'?: string;
}

/**
 * An open section: heading, support, content. No border, no background, no padding — the whole
 * point. If content inside needs a surface, that content asks for `Plate`; the section does not
 * hand one out by default.
 */
export function Section({
  eyebrow,
  title,
  support,
  action,
  children,
  level = 2,
  divider = false,
  className,
  'aria-label': ariaLabel,
}: SectionProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const hasHeader = Boolean(eyebrow || title || support || action);

  return (
    <section className={cn('flex flex-col gap-4', className)} aria-label={ariaLabel}>
      {divider && <div className="rule" />}
      {hasHeader && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 flex-col gap-1">
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              {title && (
                <Heading className={cn('font-semibold', level === 2 ? 'text-xl' : 'text-base')}>
                  {title}
                </Heading>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {support && (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{support}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Surfaces                                                                                     */
/* ------------------------------------------------------------------------------------------- */

export interface LeadProps {
  children: ReactNode;
  className?: string;
}

/**
 * The lead plate — the page's single most important thing. Bigger padding than anything else on
 * the page, and that size difference *is* the hierarchy, so nothing else may match it.
 */
export function Lead({ children, className }: LeadProps) {
  return <div className={cn('glass p-6 md:p-8', className)}>{children}</div>;
}

export interface PlateProps {
  children: ReactNode;
  /** `sm` for rows in a list, `md` for a standalone surface. */
  size?: 'sm' | 'md';
  className?: string;
}

/** A surface for something genuinely liftable or actionable. Not a wrapper for text. */
export function Plate({ children, size = 'md', className }: PlateProps) {
  return <div className={cn('glass', size === 'sm' ? 'p-3.5' : 'p-5', className)}>{children}</div>;
}

/** A hairline between document blocks — the syllabus ruling off its weeks. */
export function Rule({ className }: { className?: string }) {
  return <div className={cn('rule', className)} role="presentation" />;
}

/**
 * A list whose rows are separated by hairlines rather than by being individually boxed. This is
 * the replacement for "map every row into its own plate", which is what produced most of the
 * box-stacking.
 */
export interface RuledListProps {
  children: ReactNode;
  className?: string;
  /** `ol` where the sequence is the meaning — a 68-day roadmap is ordered, a bookmark list is not. */
  as?: 'ul' | 'ol';
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function RuledList({ children, className, as = 'ul', ...aria }: RuledListProps) {
  const List = as;
  return (
    <List className={cn('flex flex-col divide-y divide-border border-y border-border', className)} {...aria}>
      {children}
    </List>
  );
}

export interface RuledItemProps {
  children: ReactNode;
  className?: string;
  /**
   * Off when the row's own child is the interactive element. A link or button must carry the
   * padding itself, or its hover and focus surfaces stop short of the row they appear to fill.
   */
  padded?: boolean;
}

export function RuledItem({ children, className, padded = true }: RuledItemProps) {
  return <li className={cn(padded && 'py-3.5', className)}>{children}</li>;
}

/* ------------------------------------------------------------------------------------------- */
/* Ledger                                                                                       */
/* ------------------------------------------------------------------------------------------- */

export interface LedgerItem {
  label: string;
  value: ReactNode;
  /** One short qualifier under the number — units, a comparison, a caveat. */
  sub?: ReactNode;
}

/**
 * The figure strip: several counted facts on one ruled line.
 *
 * This replaces the four-stat-cards-in-a-grid arrangement, whose real cost was four bordered
 * rectangles each holding one word and one number — the single loudest source of the box problem.
 * Hairlines between columns do the separating; nothing is boxed; the numbers keep the serif stat
 * voice they already had.
 */
/** Wide-screen column counts the grid classes below are written for. */
const LEDGER_COLUMNS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
};

export function Ledger({
  items,
  columns = 4,
  className,
}: {
  items: LedgerItem[];
  /** How many figures share a row above `sm`. The hairlines follow it — they are not hardcoded. */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-5 gap-y-6', LEDGER_COLUMNS[columns], className)}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'flex flex-col gap-1.5',
            // Column rules from the second item on each row. Two columns on phones, `columns` above.
            i % 2 !== 0 && 'border-l border-border pl-5 sm:border-l-0 sm:pl-0',
            i % columns !== 0 && 'sm:border-l sm:border-border sm:pl-5',
          )}
        >
          <dt className="text-xs font-medium tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="flex flex-col gap-1">
            <span className="font-serif text-[1.75rem] font-semibold leading-none tracking-tight">
              {item.value}
            </span>
            {item.sub && <span className="text-xs text-muted-foreground/80">{item.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Meta                                                                                         */
/* ------------------------------------------------------------------------------------------- */

/**
 * Inline metadata: pattern · difficulty · estimate · relevance, on one line.
 *
 * Facts that describe the same object should look like one object. Four chips in four plates
 * says "four things"; one interpunct-separated line says "one thing, described".
 */
export function Meta({
  items,
  className,
}: {
  items: (ReactNode | null | undefined | false)[];
  className?: string;
}) {
  // Empty strings are dropped too, not just falsy slots: the calling idiom is
  // `question.url && <a…/>`, which yields `'' | Element` when the field is an empty string, and
  // rendering that leaves a stray interpunct separating nothing from nothing.
  const shown = items.filter((item): item is ReactNode => Boolean(item) && item !== '');
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground', className)}>
      {shown.map((item, i) => (
        // Index keys are correct here: the list is positional metadata with no identity of its own.
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="text-border">&middot;</span>}
          {item}
        </span>
      ))}
    </div>
  );
}
