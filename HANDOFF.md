# HANDOFF — GOD MODE V9 shipped (2026-08-16)

**State: the Composed Interface pass is complete and committed to `main`.** There is no in-flight
work.

## Where things stand

- **1175/1175 tests across 83 files. `npx tsc --noEmit` clean. `npm run build` clean**, app chunk
  280.54 kB against the 301 kB budget. The test count is 7 lower than V8's 1182 because the dead
  `QuestionCard` component and its own tests were deleted — no assertion was weakened or removed.
- The design record `docs/superpowers/specs/2026-08-16-composed-interface-design.md` is the
  authority on what changed and why. It records the measured before/after per route, the four
  non-layout defects the audit turned up, and — importantly — what was **deliberately not done**
  and why.
- V9 spanned two sessions. The first built the composition vocabulary (`PageColumns`, `PagePair`,
  `Figures`, `Disclosure` in `Page.tsx`) and recomposed Dashboard/Today/Revision/Analytics. The
  second audited that work, finished the routes it had not reached (AI/ML, Drills, Contest,
  Interview, Settings, Roadmap, the question sheet), and fixed one real regression it had
  introduced.

## What V9 actually changed

- **Composition.** Priority now runs left-to-right before top-to-bottom (`PageColumns`: work in the
  main column, context in a rail, main first in the DOM so phones and screen readers still read the
  work first). Rare content sits behind native `<details>` latches, always verbatim.
- **The measured wins.** `/aiml` 6011→4313px (−28%), `/analytics` 3832→3451px, Dashboard's primary
  action 370→327px, Contest's start button on a 375px phone 883→552px (from below the fold to
  above it). Nothing was deleted to get there.
- **The regression it found.** `TodayTasks` moved into Today's 240px rail while keeping
  `sm:flex-row` — and Tailwind media queries are *viewport*-scoped, so the form overflowed the rail
  by 86px and scrolled the whole document sideways at 1024px. **General rule: a component placeable
  in a column narrower than the viewport must not use the viewport as a proxy for its own width.**
- **Four defects that were not layout:** two surfaces printing one sentence over two different
  numbers (Dashboard "Revisions queued" vs Today's banner — now "Reviews queued"); Analytics' range
  tabs sitting outside the latch holding the chart they filter, so operating them changed nothing
  visible; Today's capacity chips declaring `role="radiogroup"` with no arrow-key handling while
  the docs claimed otherwise (all three chip idioms now share `components/shared/ChipRadioRow`);
  and the contest clock scrolling out of view on a phone (now `sticky`).

## Rules that bit during V6–V9 — still standing

- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; it passes
  solo, and the file now runs in ~5s rather than ~12s since the dead-component tests went.
- Browser-pane screenshots are unreliable **and were unavailable this session** (pane not
  displayed). Judge composition with `getBoundingClientRect()` / `scrollHeight` / `read_page`.
  Computed `backgroundColor` goes stale in the pane — read the CSS custom properties
  (`getComputedStyle(document.documentElement).getPropertyValue('--background')`), which do flip.
  React state changes are not visible in the same synchronous script that triggered them.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit messages
  via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Hand-built `QuestionProgress` fixtures must carry every required field or `validatePersisted`
  quarantines the whole payload — build from `initialProgress()`.
- Adding an import of `@/data/mlTracks`, `@/data/mlProjects` or `@/utils/engine/insights` to
  `store/selectors.ts` or `store/actions.ts` silently puts a large chunk back on the app bundle.
- **New (V9): jsdom does not hide closed `<details>` content, and `<summary>` carries no `button`
  role.** Tests for a `Disclosure` must assert the `open` attribute, not element absence, and must
  address the control as a summary. `familyPanel.test.tsx` is the worked example.
- **New (V9): `text-muted-foreground/80` fails AA on the light theme** (3.75:1 against the 4.5:1
  floor). Full-alpha `muted-foreground` is the floor for small text; the size step already carries
  the hierarchy.

## Known limitation carried forward

`button.tsx` ships `h-10` default / `h-9` small (40px / 36px). Both clear WCAG 2.2 AA's 24×24
minimum; neither reaches the 44px AAA/HIG figure, and `size="sm"` has 68 call sites. Raising the
whole scale would change every surface and work against the density V9 exists to deliver, so
individual controls that are the primary interaction of their row were raised to `min-h-11`
instead. Moving the scale itself is a design decision awaiting a call, not an open bug.

## The law books

`CLAUDE.md` (architecture law), `PRODUCT.md` (locked product truth), `DESIGN.md` (visual system +
the mandatory composition contract — its rhythm table, progress-bar scale and next-action-plate
description were corrected in V9 to match the shipped code), and the design records under
`docs/superpowers/specs/` (V6 practice engine, V7 adaptive mastery, V8 performance engine, V9
composed interface).
