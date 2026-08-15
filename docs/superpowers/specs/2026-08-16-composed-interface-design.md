# V9 — The Composed Interface

**Status: shipped 2026-08-16.** A composition, information-architecture and density pass. No new
features, no new dependencies, no change to the visual identity.

## The problem

The product was functionally mature and visually consistent — the tokens were being followed
everywhere — and it still read as a long vertical stack. Reaching a decision meant scroll → read →
scroll → read → hunt. The cause was not too much functionality; it was that functionality of
descending importance was rendered head-to-toe in one column at one weight.

V9 predates this document by one session: the composition vocabulary in
`src/components/layout/Page.tsx` (`PageColumns`, `PagePair`, `Figures`, `Disclosure`) and the
recomposition of Dashboard, Today, Revision, Analytics and Companies were already in the working
tree. This pass audited that work, finished the routes it had not reached, and fixed what it had
broken.

## What governs a decision here

1. **Remove competition, don't shrink things.** P0 gets space, P1 gets compression, P2 gets
   progressive disclosure, P3 gets a destination.
2. **No information loss.** Nothing may be deleted to reduce scrolling — only compressed, grouped,
   collapsed, reordered, or moved behind a latch. Every latch in this pass keeps its content
   verbatim.
3. **Priority runs left-to-right before top-to-bottom**, and DOM order stays priority order so the
   single-column fallback and the screen reader both read the work before the context.
4. **A page that becomes cramped is a failure.** Density is not the goal; unnecessary scrolling is
   the target.

## Measured outcome (1280×800, seeded state: day 12 of 68, 95 solved)

| Route | Before | After | Δ |
|---|---|---|---|
| `/aiml` | 6011px (7.51 screens) | 4313px (5.39) | **−28%** |
| `/analytics` | 3832px (4.79) | 3451px (4.31) | −10% |
| `/` | 1184px, action at 370px | 1090px, action at **327px** | −8% / −43px |
| `/contest` (mobile 375) | action at 883px, below the 812 fold | action at **552px** | above the fold |
| `/today` | 1386px | 1375px | −1% |

`/aiml` was the outlier and stayed the largest single win. Its height was three fully-rendered
catalogues; the syllabus row itself was 102px because the dates and the week's deep links occupied
two separate lines. Merging them to one line (they describe the same week) took the row to 83px —
~520px across 26 rows — and the project ladder moved behind the latch the extras already used.

## The regression this pass found

`TodayTasks` had been moved into Today's new context rail while keeping `sm:flex-row` and
`sm:w-36 sm:flex-none` on its add-task form. Tailwind media queries are **viewport**-scoped; the
rail is 240px at 1024–1279px. So from a 640px viewport upward the form laid a 144px select, a 64px
estimate field and a ~76px button side by side inside 240px, pushed the button 86px past the rail,
and **scrolled the whole document sideways at 1024px** (`scrollWidth` 1067 > 1024).

The general rule this yields: *a component that can be placed in a column narrower than the
viewport cannot use the viewport as a proxy for its own width.*

## Defects fixed that were not layout

- **Two surfaces printed the same sentence over two different numbers.** Dashboard's
  "Revisions queued" spanned both ladders (questions + course); Today's weekly banner says
  "N revisions queued" over the question ladder alone. On any weekly day with course work due,
  Today said 12 and Dashboard said 15 about what read as the same fact. Dashboard's label is now
  "Reviews queued"; its `sub` already carried the split.
- **An interactive control whose only effect was invisible.** Analytics' 30/90-day range tabs sat
  outside the `Disclosure` holding the chart they filter. With the chart shut — the default —
  pressing "90 days" changed nothing on screen. The tabs moved inside; the current range rides the
  summary.
- **A `role="radiogroup"` that was not one.** Today's capacity chips declared the role and
  `aria-checked` but shipped no `onKeyDown` and no roving `tabIndex` — all six sat in the tab
  sequence and arrow keys did nothing — while `DESIGN.md` stated that "arrow-key selection is the
  contract the radio role promises" and RevisionPage's comment claimed Today already carried it.
  Two of the three copies were correct; the documented one was not. All three idioms now resolve
  through one `ChipRadioRow` in `components/shared`.
- **The contest clock scrolled away.** On a 375px phone the first problem row ended at 743px while
  the clock's bottom edge sat at 310px, so a learner working the set could not see the timer the
  page exists to impose. It is now `sticky top-2` — one of the four elements the directive
  pre-authorises as sticky.
- **The primary action of the most-used surface was buried.** In `QuestionDetailModal`, "I solved
  it" sat below four metadata bands: ~1044px inside a dialog whose `max-h-[85vh]` is 680px, so it
  was 364px below the fold on desktop and ~1330px down on a phone. The action row moved to the
  top, directly under the masthead. Nothing else changed rank, and the post-attempt gating
  (complexity, family, companies behind `solved`) is untouched — showing a target bound before an
  attempt would convert a problem into a lookup.

## Dead code removed

`QuestionCard` — a `Card`/`.glass` plate at `p-5` with a hover lift, a 3-line clamp, revision pips,
a confidence rating and up to five buttons. Every call site had already migrated to `QuestionRow`;
by the end of the pass it rendered nowhere. `DESIGN.md` records deleting `StatCard` on exactly this
reasoning — "a dead plate primitive is a re-entry point for the box problem" — and this one was
worse, because it is the *question* plate: the next surface needing a question in a list would have
found it, and the box problem would have grown back out of the component library. `QuestionRow`,
`STATUS_LABEL` and `STATUS_ICON` survive.

`FamilyPanel` also carried a private `Disclosure` that **shadowed** the exported one — same name,
two feet away in the same dialog, but ChevronDown/rotate-180 against ChevronRight/rotate-90, a
`useState` map against native `<details>`, and a 40px summary against `min-h-11`.

## Accessibility

Fixed: a **skip link** (WCAG 2.4.1 level A — fifteen sidebar links preceded content on every route,
with no bypass); six sites of `text-muted-foreground/80`, which computes to **3.75:1 on the light
theme**, under the 4.5:1 AA floor; `ProgressRing`'s `strokeDashoffset` sweep and RoadmapPage's
height/opacity expand, neither of which `MotionConfig reducedMotion="user"` suppresses (it covers
only transform and layout) nor index.css's CSS-only zeroing can reach; a `div role="button"` with a
hand-written Enter/Space handler on the roadmap; sub-24px targets on the resource chips and filter
chips; and a 16px-tall link button on the contest verdict (`h-auto p-0` had cancelled both the
height and the padding).

**Known limitation, stated rather than silently fixed:** `button.tsx` ships `h-10` default / `h-9`
small / `h-11` large, and `size="sm"` appears 68 times. Those are 40px and 36px — both above the
WCAG 2.2 AA floor of 24×24 (2.5.8), both below the 44px AAA/HIG figure. Raising the design system's
button scale would change every surface in the product and work against the density this pass
exists to deliver, so it was **not** done. Individual controls that are the primary interaction of
their row were raised to `min-h-11` instead. Whether to move the whole scale is a design decision,
not a bug fix.

## Progressive disclosure added (all content verbatim, none of it primary)

AI/ML cleared syllabus weeks and the project ladder; Contest's clock/draw mechanics; Analytics'
findings beyond the first four; FamilyPanel's three rungs. The AI/ML syllabus **shrinks as the
learner progresses** rather than growing — the right direction for a reader.

## Deliberately not done

- The AI/ML syllabus and the implementation tracks stay open. The directive's own list for this
  page is "current lesson, progress, next session, retrieval, implementation"; hiding all three
  catalogues would make a course reader a table of contents with nothing on it.
- Drills' advance buttons stay at the foot of the reveal. The explanation is the whole value of a
  drill, and hoisting "Next" above it invites skipping the only part that teaches.
- `RevisionPage`'s "Mastered" toggle and `QuestionDetailModal`'s revision history were left on
  their existing idioms: converting them buys consistency at the cost of rewriting assertions that
  currently pin real behaviour.

## Verification

1175 tests across 83 files (7 fewer than V8's 1182 — the deleted `QuestionCard`'s own tests).
`npx tsc --noEmit` clean. `npm run build` clean; app chunk 280.54 kB against the 301 kB budget, with
`data-ml` and the analytics/insights chunk still split out (the two traps `CLAUDE.md` records).
Browser QA at 375 / 768 / 1024 / 1280, both theme palettes confirmed flipping via CSS custom
properties. **Screenshots were unavailable in this session** (the browser pane was not displayed);
every measurement above came from `getBoundingClientRect()` and `scrollHeight`, which is the method
`HANDOFF.md` already prefers for this repo.
