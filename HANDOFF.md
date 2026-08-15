# HANDOFF — V11 Flowing Application shipped (2026-08-16)

**State: V9 (Composed Interface), V10 (Zero-Scroll Application) and V11 (Flowing Application) are
complete, committed on branch `v9-composed-interface`. NOT merged to main and NOT pushed** —
V6–V8 all ended merged, so this branch is the outlier and needs a decision.

V11 retires V10's load-bearing idea while keeping its shell. The user's real machine (1080p at
150% scaling ≈ 1280×590 CSS) crushed V10's fixed-height panels into clipped scroll boxes with
loud Windows scrollbars on nearly every route. The contract is now: **the shell still locks at
`lg` and the sidebar stays put, `<main>` is the single scroll container
(`scrollbar-gutter: stable`), and pages flow at natural height — nothing below `main` owns a
scrollbar.** `docs/superpowers/specs/2026-08-16-flowing-application-design.md` is the authority;
read its "Findings worth keeping".

## Where things stand

- **1175/1175 tests across 83 files. `npx tsc --noEmit` clean. `npm run build` clean**, app chunk
  280.44 kB against the 301 kB budget (V10: 280.54).
- Probe-verified (real Chrome, all 15 routes × 5 viewports incl. 1280×590): zero document
  overflow, zero horizontal overflow, zero nested scrollers. The probe script pattern lives in
  the V11 design record.
- DESIGN.md § Layout now carries "The scroll contract (V11)" — the one paragraph to read before
  touching AppShell/Page/Sidebar overflow behavior.

## What V11 actually changed

- `Screen`/`ScreenBody`/`Panel` (Page.tsx) are flow primitives now — no `lg:h-full`, no
  `min-h-0` chains, no `overflow-y-auto`. `Panel` is a named region, not a scroller.
- Per-page height locks removed: Today, Dashboard, Analytics, AI/ML, Bookmarks (work columns,
  rails, and all ten forced-flex `TabsContent` classNames).
- AppShell's gutter: `max-w-6xl` ceiling restored, `md:py-6 md:pb-12`, no `lg:h-full`;
  `main` gained `lg:[scrollbar-gutter:stable]`. PageTransition dropped its `h-full`.
- Scrollbar manners in index.css: `.scrollbar-quiet` (sidebar nav — invisible until
  hover/focus-within), `.scrollbar-none` (tab strip). TabsList pans below `md`, wraps above —
  it overflowed a 390px phone by 120px before.
- Polish: `Progress` animates from zero on first paint (aria untouched); nav icons transition
  their ink; `EmptyState` got the pressed-seal ring; Settings' Save tucks under the form's own
  closing rule (`-mt-4`, no second hairline).

## Rules that bit during V6–V11 — still standing

- **New (V11): a layout that only works above a height it cannot control is a layout bug.**
  Verify at ~590px effective height (150%-scaled 1080p), not just 720/800.
- **New (V11): `overflow-y: auto` computes `overflow-x` to `auto`** — an inner scroll region
  turns 1px of horizontal overflow into a drawn horizontal scrollbar. Prefer removing the region.
- **New (V11): Git Bash mangles `/route` args into filesystem paths** — `MSYS_NO_PATHCONV=1`
  when passing routes to node CLIs.
- **New (V11): browser-pane MCP unavailable again** (extension account mismatch);
  `npm i --no-save puppeteer-core` + installed Chrome is the reliable measurement/screenshot
  path, including forced-`.light` captures (a partial persisted payload gets quarantined — force
  the class post-load instead).
- A "failed" background agent may have finished its work — `git status` before assuming loss.
- `questionCard.test.tsx`'s markdown-preview timeout is a documented under-load flake; passes solo.
- Never edit source through PowerShell text replacement (mojibake); Edit tool only. Commit
  messages via `git commit -F <file>`. PowerShell chains with `;`, not `&&`.
- Hand-built `QuestionProgress` fixtures must carry every required field or `validatePersisted`
  quarantines the whole payload — build from `initialProgress()`.
- Adding an import of `@/data/mlTracks`, `@/data/mlProjects` or `@/utils/engine/insights` to
  `store/selectors.ts` or `store/actions.ts` silently puts a large chunk back on the app bundle.
- (V10, still true for `main` and dialogs): `overflow` clips absolutely-positioned descendants
  ONLY when the scroll container is their containing block — `main` and `Panel` keep `relative`.
- (V10): Radix `TabsContent` is `display:block`; `[hidden]` is UA-origin, so any author `display`
  (`flex`, `md:flex`) un-hides inactive panels. Use `data-[state=active]:flex` if ever needed.
- (V10): `Screen` collides with the DOM global `Screen` type — a missing import reads as "cannot
  be used as a JSX component".
- (V9): jsdom does not hide closed `<details>` content and `<summary>` has no `button` role —
  assert the `open` attribute (`familyPanel.test.tsx` is the worked example).
- (V9): `text-muted-foreground/80` fails AA on the light theme; full-alpha `muted-foreground` is
  the floor for small text.

## Known limitation carried forward

`button.tsx` ships `h-10` default / `h-9` small (40px / 36px). Both clear WCAG 2.2 AA's 24×24
minimum; neither reaches the 44px AAA/HIG figure, and `size="sm"` has ~68 call sites. Individual
controls that are the primary interaction of their row were raised to `min-h-11`. Moving the
scale itself is a design decision awaiting a call, not an open bug.

## The law books

`CLAUDE.md` (architecture law), `PRODUCT.md` (locked product truth), `DESIGN.md` (visual system +
the mandatory composition contract + § The scroll contract), and the design records under
`docs/superpowers/specs/` (V6 practice engine, V7 adaptive mastery, V8 performance engine, V9
composed interface, V10 zero-scroll — superseded by — V11 flowing application).
