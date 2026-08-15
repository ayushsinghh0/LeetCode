# V11 — The Flowing Application (2026-08-16)

## Why V10's zero-scroll contract was retired the same week it shipped

V10 locked the shell to `100dvh` above `lg` and made every route *divide* that height:
`Screen`/`ScreenBody` handed a definite height down, and `Panel` regions took `min-h-0` +
`overflow-y-auto` and scrolled internally. It was measured and verified at 1280×800, 1280×720 and
1366×768 — and the user's actual machine is a 1080p display at 150% Windows scaling, which is a
1280×~590 CSS viewport once browser chrome and the taskbar take their share.

At 590px of height the architecture inverts its own goal. Every panel's share of the viewport
shrinks below its content, so **every** panel grows a scrollbar; on Windows those bars are drawn
loudly; the AI/ML syllabus rendered as a ~60px clipped scroll box; `overflow-y: auto` computes
`overflow-x` to `auto` as well, so 1px of interior overflow put *horizontal* scrollbars under
Patterns and Companies. Fifteen screenshots from the user's machine showed the failure on nearly
every route.

The V10 record itself contained the warning: "every zero-scroll claim is a claim about a state."
It is also a claim about a viewport, and the app does not control its viewport.

## The contract that replaced it

**Content flows; chrome stays.** Above `lg` the shell is still a fixed `100dvh` row — the sidebar
is stationary, which is the application feel V10 wanted — and `<main>` is the single scroll
container, now with `scrollbar-gutter: stable` so route length cannot shift the column. Pages
render at natural height and scroll inside `main`. Nothing below `main` owns a scrollbar:

- `Screen` is a flow column (`gap-5 lg:gap-6`) — one step denser than `Page`, no height claim.
- `ScreenBody`'s `main-rail` / `split` grids gained `items-start` (flowing tracks must not
  stretch each other) and lost `grid-rows-[minmax(0,1fr)]`.
- `Panel` no longer scrolls. It stays in the vocabulary as the named primary region and as the
  single place an inner scroll would ever be argued for again.
- Every per-page `lg:min-h-0 lg:flex-1` / `lg:overflow-y-auto` leftover was removed (Today,
  Dashboard, Analytics, AI/ML, Bookmarks — work columns, rails, and all ten forced-flex
  `TabsContent`s).
- The shell's gutter got its `max-w-6xl` ceiling back (DESIGN.md had never stopped claiming it)
  and `md:pb-12` so a scrolled page's last block does not kiss the viewport edge.

Sanctioned scrollbars, and their manners:

- `main` — visible, thin, themed (`scrollbar-color: border/transparent`), stable gutter.
- The sidebar nav — engages only when 15 rows exceed the viewport; `.scrollbar-quiet` keeps its
  bar invisible until pointer or keyboard focus is inside the rail.
- The tab strip — `.scrollbar-none`, pans silently below `md` (a 6-trigger strip is 510px and
  overflowed a 390px phone by 120px, dragging the document sideways), **wraps** from `md` up,
  because a pointer user gets no cue that a strip pans and would simply lose the last tabs.

## Measured result

Probe (real Chrome via puppeteer-core, `documentElement`/`main` scroll metrics + nested-scroller
census) across all 15 routes × {1280×590, 1280×800, 1024×700, 768×900, 390×780}: **zero document
overflow, zero main horizontal overflow, zero nested scrollers** (the tab strip's sanctioned pan
excluded). The AI/ML syllabus that clipped to ~60px now flows (≈2,800px of scrollable content at
1280×590). 1175/1175 tests, `tsc` clean, app chunk 280.44 kB (V10: 280.54).

## Polish shipped alongside

- `Progress` draws from zero on first paint through its existing 500ms transition —
  `aria-valuenow` is correct from the first render; only the paint animates; reduced motion gets
  the bar already full.
- Nav icons (sidebar, bottom nav, More sheet) transition their ink instead of snapping.
- `EmptyState` gained the pressed-seal treatment: hairline ring, ring of ground
  (`shadow-[inset_0_0_0_4px_hsl(var(--background))]`), tonal well — an icon pressed into the
  paper rather than floating over it.
- Settings' Save button tucks under the form's own closing rule (`-mt-4`) instead of floating on
  bare ground; `SettingRows` already draws that rule, so the footer adds none.

## Findings worth keeping

- **A layout that only works above a height it cannot control is a layout bug.** Verify at 590px
  of effective height (150%-scaled 1080p), not just at laptop-spec 720/800.
- **`overflow-y: auto` implies `overflow-x: auto`.** Any inner scroll region converts 1px of
  horizontal overflow into a drawn horizontal scrollbar. Removing the inner region removes the
  class of bug.
- **Scrollbar manners are part of the design system.** A permanently drawn track on navigation
  chrome reads as a defect; on content it reads as an affordance. `.scrollbar-quiet` /
  `.scrollbar-none` encode the distinction.
- **Windows Git Bash mangles `/route` CLI args into filesystem paths** — `MSYS_NO_PATHCONV=1`
  when passing routes to node scripts.
- The browser-pane MCP tools were unavailable again this session (extension/account mismatch);
  `puppeteer-core` (`npm i --no-save`) against the installed Chrome is a reliable substitute for
  both measurement and screenshots, including forced-`.light` captures.
