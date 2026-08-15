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
//
// The vocabulary above solved the *vertical* problem — a page stopped being a pile of boxes. It
// left the *horizontal* one untouched: every surface was one column, so a 1280px desktop rendered
// the same document a 600px phone did, only wider, and reading it meant scroll → read → scroll →
// read → hunt for the action. `PageColumns`, `Disclosure` and `Figures` below are the three moves
// that fix that without touching the ink: put related things beside each other, put rare things
// behind a latch, and put small counted facts on one line instead of four.
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
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
  // The section step is `gap-8 md:gap-10` (32/40px), not the 40/48px it was. Two reasons, and
  // neither is "make it smaller": the ladder is now 32 : 16 : 8, a clean 4 : 2 : 1 doubling
  // series where 40 : 16 : 8 was 5 : 2 : 1 and arbitrary; and this is the single highest-leverage
  // number in the app — it renders ~138 times across the eighteen pages, so 8px off it is roughly
  // a content row recovered above the fold on every one of them. The step still reads as a
  // section boundary; it just stops being the loudest gap on the page.
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-8 md:gap-10', WIDTH_CLASS[width], className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Screen — the V10 vocabulary                                                                  */
/* ------------------------------------------------------------------------------------------- */

/**
 * A screen, as opposed to a page.
 *
 * `Page` composes a document: it stacks sections downward and the reader travels through them.
 * That was the right model while the shell let the document grow. It no longer does — `AppShell`
 * is a fixed 100dvh row above `md` — so a surface built to stack simply overflows into `main`'s
 * scroll and the application becomes a webpage again inside its own frame.
 *
 * `Screen` inverts the relationship. It takes a definite height from the shell and *divides* it:
 * a compact header that costs what it costs, and a body that takes exactly the rest. Content
 * beyond that does not extend the screen — it opens. A tab, a drawer, a dialog, a detail route.
 *
 * The rule that makes this work is `min-h-0`, and it appears on every level of the chain. A flex
 * child defaults to `min-height:auto`, which refuses to shrink below its content; one missing
 * `min-h-0` anywhere between `main` and a scrollable panel hands the scroll back to the ancestor
 * and the whole contract silently fails. If a screen is scrolling when it should not be, look for
 * the level that is missing it before looking at the content.
 *
 * Below `md` this is deliberately an ordinary column: a phone has no room to be an application
 * viewport, and the brief keeps an intentional document scroll there.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-5 md:h-full md:min-h-0 md:gap-4', className)}>
      {children}
    </div>
  );
}

export interface ScreenHeaderProps {
  /** Quiet context: a date, a chapter, a count. Runs inline with the title, not above it. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One short line. A screen header is not the place for a paragraph. */
  support?: ReactNode;
  /** Controls, right-aligned. Two at most. */
  action?: ReactNode;
}

/**
 * The screen masthead — one line where `PageHeader` was four.
 *
 * `PageHeader` renders eyebrow / title / support / rule as a vertical stack costing ~107px before
 * a single piece of content. On a 1280×800 laptop the shell has ~760px of usable height, so that
 * masthead was 14% of the screen spent restating the item already highlighted in the rail beside
 * it. Here the eyebrow sits *inline* under a `text-2xl` title and the action shares the row: ~56px
 * for the same four facts.
 *
 * The hairline is gone too. A screen is bounded by the shell's own edge, so a rule under the title
 * divides nothing — it was the duplicate-separator problem again, this time against a frame.
 */
export function ScreenHeader({ eyebrow, title, support, action }: ScreenHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="text-2xl font-semibold md:text-[1.75rem]">{title}</h1>
        {support && <p className="max-w-prose text-sm text-muted-foreground">{support}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

/**
 * The body of a screen: everything under the header, taking exactly the height that is left.
 *
 * `cols` lays the body out horizontally, which is the other half of the zero-scroll answer — a
 * 1280px laptop that renders one narrow column beside 400px of nothing has not run out of room,
 * it has run out of composition. The tracks are asymmetric on purpose (work wide, context narrow);
 * a symmetric three-up would be the card grid this vocabulary exists to prevent.
 */
export function ScreenBody({
  children,
  cols,
  className,
}: {
  children: ReactNode;
  /** `main-rail` = work + context. `split` = two equal halves. Omit for a single column. */
  cols?: 'main-rail' | 'split';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5 md:min-h-0 md:flex-1 md:gap-4',
        // `grid-rows-[minmax(0,1fr)]` is as load-bearing as `min-h-0` and fails the same way.
        // A grid's implicit rows are `auto`, which sizes to content — so a body with a definite
        // height still gave its children a content-sized row, every `min-h-0` below resolved
        // against that, and a panel that was supposed to scroll simply grew instead. One explicit
        // row that is exactly the container's height is what makes the whole chain resolve.
        cols === 'main-rail' &&
          'lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]',
        cols === 'split' && 'lg:grid lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:gap-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A region inside a screen body that may scroll when its content genuinely exceeds it.
 *
 * This is the sanctioned exception to "the application does not scroll": a queue, an index, a
 * syllabus. It is `min-h-0` + `overflow-y-auto` and it never nests inside another one — the shell
 * allows `main` plus at most one intentional panel, and a scroll inside a scroll inside a page is
 * the failure the brief names.
 *
 * `overscroll-contain` keeps a finished scroll from chaining out into `main`.
 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // `relative` for the same reason `main` carries it: a scroll container only clips
    // absolutely-positioned descendants when it is their containing block. Without it an `sr-only`
    // span inside a panel escapes to the initial containing block and silently re-extends the
    // document.
    <div className={cn('relative flex flex-col md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain', className)}>
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
  // The support line is tucked to the title at `gap-2` rather than sitting a full `gap-4` away:
  // it is a subtitle, not a sibling block, and spacing it like a sibling was what made every
  // masthead read as three stacked things instead of one. The outer step drops to `gap-3` for the
  // same reason — the hairline below already marks the boundary, and paying for that boundary
  // twice (a rule *and* a large gap) is the duplicate-separator problem this pass exists to fix.
  //
  // `leading-tight` is gone from the h1 and not replaced here: Tailwind's own `text-4xl` line
  // height is 40px and `leading-tight` computes to 45px, so the class was adding 5px while
  // claiming to remove it. Real display leading now lives once, in index.css's h1/h2/h3 base.
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {/* Support stays a sibling of the title *row*, not a child of the title *column*: putting it
          inside the column makes `items-end` align the action button to the bottom of a two-line
          support paragraph instead of to the title it belongs beside. */}
      {support && <p className="max-w-prose text-sm text-muted-foreground">{support}</p>}
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
/* PageColumns — the editorial grid                                                             */
/* ------------------------------------------------------------------------------------------- */

export interface PageColumnsProps {
  /** The page's work: the hero and whatever the learner acts on. */
  children: ReactNode;
  /** Context that supports the work but is never the decision. Stacks *below* main on narrow. */
  rail: ReactNode;
  className?: string;
  /** Landmark label for the rail's `<aside>`. Every rail should name itself. */
  railLabel?: string;
}

/**
 * Main column plus context rail — the one composition `Page.tsx` was missing.
 *
 * The vertical vocabulary made each page a well-set document, but a document is still a single
 * column, and a single column is why a 1280px screen behaved like a 600px one: nine sections of
 * descending importance stacked head to toe, so reaching the ninth meant travelling past eight,
 * and reaching the *first* meant scrolling past the masthead that introduced it. Width was
 * available the whole time — roughly 400px of it — and nothing was allowed to use it.
 *
 * The rule this encodes: **priority runs left-to-right before it runs top-to-bottom.** Anything a
 * learner acts on goes in `children`; anything that only explains, records or reassures goes in
 * `rail`. That split is what lets the first viewport carry the decision *and* its context instead
 * of choosing between them.
 *
 * Three properties make it safe:
 *
 *  - **DOM order is priority order.** Main is first in the markup, so the single-column fallback
 *    below `lg` (and every screen reader, and every tab sequence) reads the work before the
 *    context. A rail implemented as a float or an `order-` swap would reverse that on phones,
 *    which is the exact failure the mobile section of the directive names.
 *  - **The gap *is* the section step.** `gap-10 lg:gap-12` matches `Page`'s own rhythm, so a
 *    column boundary costs the same space as the section boundary it replaced and the vertical
 *    rhythm survives the transposition. A page-local `lg:grid-cols-[…]` would have drifted.
 *  - **`minmax(0,1fr)` on main, not `1fr`.** Grid items default to `min-width:auto`, so one long
 *    unbroken string (a question title, a URL) would otherwise widen the track and push the rail
 *    off-screen instead of truncating.
 *
 * The rail only exists at `lg` and above. Below that it is not hidden — it stacks under main,
 * where it costs nothing that the previous single-column page did not already cost.
 */
export function PageColumns({ children, rail, className, railLabel = 'Context' }: PageColumnsProps) {
  return (
    <div
      className={cn(
        // The rail steps 15rem → 20rem rather than holding one width, because the shell's own
        // content box steps too: ~751px at 1024, ~1007px at 1280, ~1088px at 1440. A fixed 20rem
        // rail would leave the main column 431px on a 1024 laptop — narrower than the hero needs.
        // These three tracks give main 463 / 639 / 720px, which rises with the viewport instead of
        // dipping in the middle of it.
        'grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-8 md:gap-10">{children}</div>
      {/* The rail's own step is one rung quieter than the main column's — `gap-6` against
          `gap-8/10`. That is deliberate and it is the only place the two differ: a column of
          supporting facts should read as a denser, calmer body of text than the column carrying
          the decision, and matching the steps exactly made the rail look like a second main. */}
      <aside aria-label={railLabel} className="flex min-w-0 flex-col gap-6">
        {rail}
      </aside>
    </div>
  );
}

/**
 * Two related blocks side by side, from `md` up — the second horizontal move, and the one that
 * serves tablets.
 *
 * `PageColumns` is a page-level asymmetry (work vs. context). This is a local symmetry: two
 * sections that describe *related* things and were only stacked because stacking was the only
 * option. It starts at `md` rather than `lg` precisely because 768px is wide enough for two
 * columns of small facts and the directive is explicit that a tablet must not simply become a
 * tall phone.
 *
 * It is deliberately fixed at two. A `columns` prop would make it a card grid, and a card grid is
 * the thing this whole file exists to prevent.
 */
export function PagePair({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-10', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Figures — the compact status line                                                            */
/* ------------------------------------------------------------------------------------------- */

export interface FigureItem {
  value: ReactNode;
  label: ReactNode;
}

/**
 * Several counted facts as one sentence-like line: **539** questions · **18%** complete · **7** due.
 *
 * `Ledger` renders a figure at 1.75rem, which is the right voice when the number *is* the point —
 * an analytics reading, a course total. It is the wrong voice for orientation, where four numbers
 * at 1.75rem are four things shouting equally and the reader gets no hierarchy at all. That is the
 * stat-card wall with the borders removed, which is what the directive means by "one coherent
 * typographic block": the figures stay in the mono ledger voice and the labels stay quiet, and the
 * whole state of the course reads as a single line rather than as a row of monuments.
 *
 * Use `Figures` for "where am I", `Ledger` for "what does the record say".
 */
export function Figures({ items, className }: { items: FigureItem[]; className?: string }) {
  return (
    <dl className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-sm', className)}>
      {items.map((item, i) => (
        // Index keys are correct here for the same reason they are in `Meta`: this is positional
        // metadata with no identity of its own.
        //
        // The interpunct is a CSS `::before`, not an element. A `<div>` child of a `<dl>` may
        // contain only `<dt>`/`<dd>` — a bare `<span>` beside them is an invalid content model,
        // and this is a primitive that now renders on nearly every page, so the mistake would have
        // multiplied. A pseudo-element also keeps the separator out of `dd.textContent`, which
        // matters because it is decoration rather than data.
        //
        // `<dt>` precedes `<dd>` in the DOM because a `<div>` inside a `<dl>` may only contain
        // "one or more dt followed by one or more dd" — and because a screen reader walking the
        // list should hear the term before its definition, not "539 … questions". The visual order
        // is the reverse (the figure leads), which `order-1`/`order-2` supplies without touching
        // the document order.
        <div
          key={i}
          className="flex items-baseline gap-1.5 before:order-none before:pr-0.5 before:text-border before:content-['·'] first:before:hidden"
        >
          <dt className="order-2 text-muted-foreground">{item.label}</dt>
          <dd className="figures order-1 font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Disclosure                                                                                   */
/* ------------------------------------------------------------------------------------------- */

export interface DisclosureProps {
  /** The always-visible line. Keep it a real summary — a label plus its count, never just "More". */
  summary: ReactNode;
  children: ReactNode;
  /** Open on first render. Use for the group the learner is standing in, never for all of them. */
  defaultOpen?: boolean;
  className?: string;
  /** Quiet right-aligned figure on the summary row — a count, an estimate, a fraction. */
  meta?: ReactNode;
}

/**
 * Progressive disclosure, built on native `<details>`/`<summary>`.
 *
 * The directive's instruction is "do not remove useful information — move it behind appropriate
 * disclosure", and the constraint is "add no new UI library". Those two together point at exactly
 * one answer: `<details>` is in the platform, needs no JavaScript, no state, no `aria-expanded`
 * bookkeeping and no bytes. It is keyboard-operable and correctly announced as a disclosure by
 * every screen reader that matters, which a `div` with an `onClick` is not. The three Radix
 * packages that would otherwise be candidates are not installed, and installing one to render a
 * triangle would fail the performance clause.
 *
 * It renders as a ruled row, not a plate: the summary is a row you can click, the body is the same
 * page ground underneath it. Nesting a disclosure's content inside a bordered box would put a
 * plate inside a plate, which § The plate rule forbids.
 *
 * The chevron is the *only* affordance and it rotates rather than swapping glyph, so nothing
 * reflows on open. `motion-reduce:transition-none` is belt-and-braces over index.css's global
 * reduced-motion zeroing — a 150ms rotation is exactly the kind of decorative movement that rule
 * exists for.
 */
export function Disclosure({ summary, children, defaultOpen = false, className, meta }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn('group border-b border-border', className)}>
      {/* `list-none` + the WebKit marker reset: without both, Safari and Chrome each draw their
          own triangle beside ours. `min-h-11` is the 44px target the accessibility contract
          requires of every control, and this is a control. */}
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-2.5 text-sm transition-colors duration-150 ease-swift marker:content-none hover:text-primary [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-swift group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="min-w-0 flex-1">{summary}</span>
        {meta && <span className="figures shrink-0 text-xs text-muted-foreground">{meta}</span>}
      </summary>
      {/* Indented to the summary's text, so the chevron column reads as a margin and the open
          group is visibly subordinate to its heading rather than a sibling of it. */}
      <div className="flex flex-col gap-3 pb-4 pl-7">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------------------------------- */
/* Surfaces                                                                                     */
/* ------------------------------------------------------------------------------------------- */

export interface LeadProps {
  children: ReactNode;
  className?: string;
  /**
   * Names the plate as a landmark, and makes it render `<section>` instead of `<div>`.
   *
   * Every call site that wanted a named region was writing `<Lead><section aria-label="…">` — two
   * elements, one job, and a second flex container inside the first whose only purpose was to
   * re-declare a gap the plate could have owned. Taking the label here collapses that pair.
   */
  'aria-label'?: string;
}

/**
 * The lead plate — the page's single most important thing. Bigger padding than anything else on
 * the page, and that size difference *is* the hierarchy, so nothing else may match it.
 *
 * It now owns its own internal stack (`flex flex-col gap-4`). Every one of its call sites was
 * passing `className="flex flex-col gap-6"`, which meant a 24px step existed in exactly one place
 * in the product — a fourth section-scale rung, invented per-plate, on the one surface where
 * vertical space is most expensive. Folding it in at `gap-4` puts the plate's interior on the same
 * heading→content step as everything else, and removes ~24px from every hero.
 *
 * `cn` is `twMerge`, so a call site with a genuine reason to differ can still override — but it
 * has to say so, which is the point.
 */
export function Lead({ children, className, 'aria-label': ariaLabel }: LeadProps) {
  const Tag = ariaLabel ? 'section' : 'div';
  return (
    <Tag aria-label={ariaLabel} className={cn('glass flex flex-col gap-4 p-6 md:p-8', className)}>
      {children}
    </Tag>
  );
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
            {/* Full `muted-foreground`, not `/80`. The qualifier is 12px text and the extra 20%
                transparency bought no hierarchy the size step had not already established, while
                costing real contrast on both grounds — and this is the most repeated small-text
                instance in the product. */}
            {item.sub && <span className="text-xs text-muted-foreground">{item.sub}</span>}
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
