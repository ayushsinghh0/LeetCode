# V10 — The Zero-Scroll Application

**Status: shipped 2026-08-16**, immediately after V9. Where V9 recomposed pages, V10 stops them
being pages at all.

## The problem V9 did not solve

V9 made the app a well-composed document. It was still a document: `/aiml` 4,313px, `/analytics`
3,451px, the body growing without limit and the sidebar stretching to the height of whatever the
current route happened to be. A beautifully set 4,000px page is a website, not an application.

## The contract

Above the `md` breakpoint the shell root is `h-[100dvh] overflow-hidden`. Therefore:

- `documentElement.scrollHeight === innerHeight` on every route
- `scrollTo(0, 500)` leaves `scrollY` at 0
- the rail is exactly one viewport tall, `top: 0`, on every route

Below `md` the constraint is simply absent (`min-h-dvh`): a phone has no room to be an application
viewport, and mobile keeps an intentional document scroll with the primary action above the fold.

Scoped to the shell rather than `html, body { overflow: hidden }` because `/focus` is routed
**outside** `AppShell` and owns its own `main`; a global lock would have applied to it silently.

## The vocabulary

`Screen` / `ScreenHeader` / `ScreenBody` / `Panel` in `src/components/layout/Page.tsx`.

`Page` composes a document that stacks downward. `Screen` takes a definite height and *divides* it:
a compact header, and a body that takes exactly the rest. Content beyond that does not extend the
screen — it opens. `ScreenHeader` is ~56px against `PageHeader`'s ~107px for the same four facts,
and drops the hairline (a screen is bounded by the shell's own edge, so a rule under the title
divides nothing).

There is exactly **one** scroll container by default — `<main>` — plus at most one intentional
`Panel` per screen, plus the rail's own nav when it genuinely overflows.

## Results (overflow inside `main`, 1280×800, mid-course state)

| Route | Before | After |
|---|---|---|
| `/aiml` | 3461 | **0** |
| `/analytics` | 2599 | **0** |
| `/patterns` | 1048 | **0** |
| `/roadmap` | 536 | **0** |
| `/today` | 523 | **0** |
| `/settings` | 447 | **0** |
| `/companies` | 305 | **0** |
| `/` | 237 | **0** |

All fifteen routes verified at **1280×800, 1280×720 and 1366×768**, across **three store states**:
fresh/empty, mid-course (95 solved), and heavy (300 solved, ~130 due). Zero horizontal overflow at
375 / 768 / 1024 / 1280 / 1366.

## The three moves

1. **Tabs where sections were siblings.** `/aiml` was three complete catalogues stacked head to
   toe — 26 syllabus weeks, 11 tracks, 14 projects — so opening the course meant scrolling a
   document to find the lesson. They are unchanged and now sit behind Syllabus / Implement / Ship /
   Extras with the current sprint above the strip. `/analytics`'s five question-sections became
   five panels; each still *opens with its question as the heading* — the tab label is navigation,
   the heading is the claim. "What next" leads the strip, because on a screen the reading you act
   on should be the one already open.
2. **Panels where a list can legitimately grow.** Today's plan, the pattern index, the roadmap
   weeks, the settings form, the bookmark list, the company evidence.
3. **Destinations where a band was reference data.** Dashboard's 53-week heatmap closed the page as
   a 234px band — the largest object on a screen whose largest object should be the decision.
   `/calendar` already renders the same record and fits its own viewport, so the rail keeps streak,
   longest, level and XP in full and links to it.

## Findings worth keeping

- **`overflow` clips absolutely-positioned descendants only when the scroll container is their
  containing block.** `main` was `static`, so every Tailwind `sr-only` span (which is
  `position:absolute`) resolved against the initial containing block, sat below the clipped
  viewport, and extended `documentElement.scrollHeight` to 1208px on `/today` — from ten 1px spans.
  The body reported 800px and looked correct; the document scrolled anyway. `relative` on `main`
  and on `Panel` fixes it. **This is invisible to every measurement except an actual scroll test.**
- **`grid-rows-[minmax(0,1fr)]` is as load-bearing as `min-h-0`.** A grid's implicit rows are
  `auto`, so a body with a definite height still handed its children a content-sized row, every
  `min-h-0` below resolved against that, and a panel that should have scrolled simply grew.
- **Radix `TabsContent` is `display:block`** — a `flex-1` panel inside it does nothing and
  overflows visibly. Tab bodies need `md:flex md:flex-col`.
- **`Screen` collides with the DOM's global `Screen` type.** Forgetting the import yields a
  confusing "cannot be used as a JSX component" rather than "cannot find name".
- **Measure under a heavy store, not a convenient one.** `/bookmarks` measured 0 under the
  mid-course seed because it had five bookmarks; with a real list it overflowed by 304px. Every
  zero-scroll claim is a claim about a *state*.

## Tests

1175, unchanged in count. The `/aiml` and `/analytics` assertions now open a tab before querying
its panel — Radix mounts only the active one, which is exactly what a learner now does. No
assertion was weakened: the analytics order test moved from heading order to tab order, and the
five questions are still pinned by name inside their panels.

## Known limitations

- **No screenshots.** The Browser pane was not displayed for this session, so `computer.screenshot`
  failed throughout. Every figure here is from `getBoundingClientRect`, `scrollHeight` and a real
  `scrollTo` probe. The brief asked for screenshot-driven verification and that part is **not
  done**.
- **Pane resize leaves `100dvh` stale.** Resizing the embedded pane does not invalidate the
  computed height, so a resize without reload shows phantom document scroll equal to the height
  delta. Reloading clears it; real browsers recalculate on resize. Measure after a reload.
- **The tablet band (768–1023px) is not held to the contract.** Below `lg` the two-column bodies
  stack, and `/revision` under a heavy store overflows ~141px at 900px wide. The brief's hard
  contract is laptop viewports; this band scrolls inside `main`, which is still the shell
  behaviour, not a document scroll.
- **Browser zoom was not tested** (the pane offers no zoom control). At 125–150% the effective
  viewport shrinks and some screens will overflow into `main`'s scroll.
